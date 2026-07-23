const { ObjectId } = require('mongodb');

const AXS_MAP_ACCOUNT_IDS = ['56b4d3c748bf930700f68602'];
const AXS_MAP_USERNAMES = ['axs-map-official-cp60z'];
const POSITION_MILESTONES = [
  { maximum: 20, eventType: 'Reached Top 20', key: 'top20' },
  { maximum: 10, eventType: 'Reached Top 10', key: 'top10' },
  { maximum: 5, eventType: 'Reached Top 5', key: 'top5' },
  { maximum: 1, eventType: 'Reached #1', key: 'number1' }
];
const REVIEW_MILESTONES = [10, 25, 50];

function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    '0'
  )}`;
}

function monthRange(date = new Date()) {
  return {
    start: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)),
    end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
  };
}

function positionEvents({
  userId,
  leaderboardType,
  oldPosition,
  newPosition,
  periodKey
}) {
  if (!newPosition) return [];
  if (!oldPosition) {
    return [
      {
        leaderboardType,
        eventType: 'Joined Leaderboard',
        oldPosition: null,
        newPosition,
        uniqueEventKey: [
          userId,
          leaderboardType.toLowerCase(),
          periodKey,
          'joined'
        ]
          .filter(Boolean)
          .join(':')
      }
    ];
  }

  return POSITION_MILESTONES.filter(
    milestone =>
      oldPosition > milestone.maximum && newPosition <= milestone.maximum
  ).map(milestone => ({
    leaderboardType,
    eventType: milestone.eventType,
    oldPosition,
    newPosition,
    uniqueEventKey: [
      userId,
      leaderboardType.toLowerCase(),
      periodKey,
      milestone.key
    ]
      .filter(Boolean)
      .join(':')
  }));
}

function reviewEvents({ userId, oldReviewCount, newReviewCount }) {
  return REVIEW_MILESTONES.filter(
    milestone =>
      oldReviewCount < milestone && newReviewCount >= milestone
  ).map(milestone => ({
    leaderboardType: 'All-Time',
    eventType: `Reached ${milestone} Reviews`,
    oldReviewCount,
    newReviewCount,
    uniqueEventKey: `${userId}:reviews:${milestone}`
  }));
}

async function leaderboardRank(db, userId, range) {
  const objectId = new ObjectId(String(userId));
  const match = {
    isBanned: false,
    user: {
      $ne: null,
      $nin: AXS_MAP_ACCOUNT_IDS.map(id => new ObjectId(id))
    }
  };
  if (range) match.createdAt = { $gte: range.start, $lt: range.end };

  const rows = await db
    .collection('reviews')
    .aggregate([
      { $match: match },
      { $group: { _id: '$user', placesMapped: { $sum: 1 } } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $match: {
          'user.isArchived': false,
          'user.isBlocked': false,
          'user.username': { $nin: AXS_MAP_USERNAMES }
        }
      },
      {
        $sort: {
          placesMapped: -1,
          'user.username': 1,
          'user.firstName': 1,
          'user.lastName': 1,
          _id: 1
        }
      },
      { $project: { _id: 1 } }
    ])
    .toArray();
  const index = rows.findIndex(row => row._id.equals(objectId));
  return index === -1 ? null : index + 1;
}

function stateSyncDocument(user, state, now) {
  return {
    _id: `state:${user._id}`,
    kind: 'contact',
    userId: user._id,
    contactId: user.salesforceContactId || null,
    payload: state,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    updatedAt: now
  };
}

function eventSyncDocument(user, event, now) {
  return {
    _id: `event:${event.uniqueEventKey}`,
    kind: 'event',
    userId: user._id,
    contactId: user.salesforceContactId || null,
    payload: event,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now
  };
}

async function captureLeaderboardProgress(db, userId, now = new Date()) {
  const objectId = new ObjectId(String(userId));
  const user = await db.collection('users').findOne(
    { _id: objectId },
    {
      projection: {
        username: 1,
        salesforceContactId: 1
      }
    }
  );
  if (!user || AXS_MAP_USERNAMES.includes(user.username)) return null;

  const key = monthKey(now);
  const [allTimePosition, monthlyPosition, reviewCount, previous] =
    await Promise.all([
      leaderboardRank(db, objectId),
      leaderboardRank(db, objectId, monthRange(now)),
      db.collection('reviews').countDocuments({
        user: objectId,
        isBanned: false
      }),
      db.collection('leaderboard_states').findOne({ _id: objectId })
    ]);

  const sameMonth = previous && previous.monthKey === key;
  const state = {
    allTimePosition,
    previousAllTimePosition: previous
      ? previous.allTimePosition || null
      : null,
    monthlyPosition,
    previousMonthlyPosition: sameMonth
      ? previous.monthlyPosition || null
      : null,
    monthKey: key,
    reviewCount,
    updatedAt: now
  };
  const oldReviewCount = previous
    ? previous.reviewCount || 0
    : Math.max(reviewCount - 1, 0);
  const events = [
    ...positionEvents({
      userId: String(objectId),
      leaderboardType: 'All-Time',
      oldPosition: previous && previous.allTimePosition,
      newPosition: allTimePosition
    }),
    ...positionEvents({
      userId: String(objectId),
      leaderboardType: 'Monthly',
      oldPosition: sameMonth ? previous.monthlyPosition : null,
      newPosition: monthlyPosition,
      periodKey: key
    }),
    ...reviewEvents({
      userId: String(objectId),
      oldReviewCount,
      newReviewCount: reviewCount
    })
  ];

  await db.collection('leaderboard_states').updateOne(
    { _id: objectId },
    { $set: state },
    { upsert: true }
  );
  await db.collection('salesforce_leaderboard_sync').replaceOne(
    { _id: `state:${objectId}` },
    stateSyncDocument(user, state, now),
    { upsert: true }
  );
  if (events.length) {
    await db.collection('salesforce_leaderboard_sync').bulkWrite(
      events.map(event => ({
        updateOne: {
          filter: { _id: `event:${event.uniqueEventKey}` },
          update: { $setOnInsert: eventSyncDocument(user, event, now) },
          upsert: true
        }
      })),
      { ordered: false }
    );
  }

  return { state, events };
}

async function ensureLeaderboardIndexes(db) {
  await Promise.all([
    db
      .collection('salesforce_leaderboard_sync')
      .createIndex({ status: 1, nextAttemptAt: 1 }),
    db.collection('salesforce_leaderboard_sync').createIndex(
      { 'payload.uniqueEventKey': 1 },
      {
        unique: true,
        partialFilterExpression: { kind: 'event' }
      }
    )
  ]);
}

module.exports = {
  AXS_MAP_ACCOUNT_IDS,
  AXS_MAP_USERNAMES,
  REVIEW_MILESTONES,
  captureLeaderboardProgress,
  ensureLeaderboardIndexes,
  leaderboardRank,
  monthKey,
  monthRange,
  positionEvents,
  reviewEvents,
  stateSyncDocument
};
