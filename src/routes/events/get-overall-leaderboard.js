const { getDb, normalizeLeaderboardItem } = require('./leaderboard-helpers');

module.exports = async (req, res, next) => {
  let contributors;

  try {
    const db = await getDb();

    contributors = await db
      .collection('reviews')
      .aggregate([
        {
          $match: {
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
