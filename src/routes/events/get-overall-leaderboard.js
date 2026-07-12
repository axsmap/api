const { ObjectId } = require('mongodb');

const { getDb, normalizeLeaderboardItem } = require('./leaderboard-helpers');

const AXS_MAP_ACCOUNT_IDS = ['56b4d3c748bf930700f68602'];
const AXS_MAP_USERNAMES = ['axs-map-official-cp60z'];

const getMonthlyDateRange = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );

  return { start, end };
};

module.exports = async (req, res, next) => {
  res.set('Cache-Control', 'no-store');

  let contributors;

  try {
    const db = await getDb();
    const match = {
      isBanned: false,
      user: {
        $ne: null,
        $nin: AXS_MAP_ACCOUNT_IDS.map(id => new ObjectId(id))
      }
    };

    if (req.query.period === 'monthly' || req.query.period === 'month') {
      const { start, end } = getMonthlyDateRange();
      match.createdAt = { $gte: start, $lt: end };
    }

    contributors = await db
      .collection('reviews')
      .aggregate([
        {
          $match: match
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
            'user.isBlocked': false,
            'user.username': { $nin: AXS_MAP_USERNAMES }
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
        { $limit: 20 }
      ])
      .toArray();
  } catch (err) {
    console.log(
      'Overall leaderboard failed to be found at get-overall-leaderboard'
    );
    return next(err);
  }

  return res.status(200).json({
    overall: contributors.map(normalizeLeaderboardItem(null))
  });
};
