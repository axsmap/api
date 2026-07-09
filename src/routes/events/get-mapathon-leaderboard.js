const { ObjectId } = require('mongodb');
const { isMongoId } = require('validator');

const { getDb, normalizeLeaderboardItem } = require('./leaderboard-helpers');

const MAPATHON_LEADERBOARD_LIMIT = 10;

const getLeaderboardLimit = query => {
  const requestedLimit = parseInt(query.limit, 10);

  if (!requestedLimit || requestedLimit < 1) {
    return MAPATHON_LEADERBOARD_LIMIT;
  }

  return Math.min(requestedLimit, MAPATHON_LEADERBOARD_LIMIT);
};

const logTrace = (requestId, step, startedAt, extra = {}) => {
  console.log('[events:mapathon-leaderboard:trace]', {
    requestId,
    step,
    elapsedMs: Date.now() - startedAt,
    ...extra
  });
};

module.exports = async (req, res, next) => {
  const startedAt = Date.now();
  const mapathonId = req.params.eventId;
  const leaderboardLimit = getLeaderboardLimit(req.query);
  const requestId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  logTrace(requestId, 'start', startedAt, {
    eventId: mapathonId,
    limit: leaderboardLimit,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  if (!isMongoId(mapathonId)) {
    logTrace(requestId, 'invalid-id', startedAt, { eventId: mapathonId });
    return res.status(400).json({ general: 'Event not found' });
  }

  let contributors;

  try {
    const db = await getDb();
    logTrace(requestId, 'db-ready', startedAt);

    contributors = await db
      .collection('reviews')
      .aggregate([
        {
          $match: {
            event: new ObjectId(mapathonId),
            isBanned: false,
            user: { $ne: null }
          }
        },
        {
          $group: {
            _id: '$user',
            placesMapped: { $sum: 1 }
          }
        },
        {
          $sort: {
            placesMapped: -1,
            _id: 1
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        },
        {
          $match: {
            'user.isArchived': false,
            'user.isBlocked': false
          }
        },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            avatar: '$user.avatar',
            displayName: '$user.displayName',
            firstName: '$user.firstName',
            lastName: '$user.lastName',
            username: '$user.username',
            placesMapped: 1
          }
        },
        {
          $sort: {
            placesMapped: -1,
            username: 1,
            firstName: 1,
            lastName: 1
          }
        },
        { $limit: leaderboardLimit }
      ])
      .toArray();
    logTrace(requestId, 'contributors-ready', startedAt, {
      contributorCount: contributors.length
    });
  } catch (err) {
    console.log(
      'Mapathon leaderboard failed to be found at get-mapathon-leaderboard'
    );
    return next(err);
  }

  logTrace(requestId, 'response', startedAt, { status: 200 });
  return res.status(200).json({
    mapathon: contributors.map(normalizeLeaderboardItem(mapathonId))
  });
};
