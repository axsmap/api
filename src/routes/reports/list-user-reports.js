const { getDb } = require('../events/leaderboard-helpers');

module.exports = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ general: 'Forbidden action' });
  }

  let reports;
  try {
    const db = await getDb();
    reports = await db
      .collection('userreports')
      .aggregate([
        { $sort: { createdAt: -1 } },
        { $limit: 100 },
        {
          $lookup: {
            from: 'users',
            localField: 'reporter',
            foreignField: '_id',
            as: 'reporter'
          }
        },
        { $unwind: { path: '$reporter', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'target',
            foreignField: '_id',
            as: 'target'
          }
        },
        { $unwind: { path: '$target', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            id: '$_id',
            comments: 1,
            createdAt: 1,
            status: { $ifNull: ['$status', 'open'] },
            type: 1,
            reporter: {
              id: '$reporter._id',
              avatar: '$reporter.avatar',
              firstName: '$reporter.firstName',
              lastName: '$reporter.lastName',
              username: '$reporter.username'
            },
            target: {
              id: '$target._id',
              avatar: '$target.avatar',
              firstName: '$target.firstName',
              lastName: '$target.lastName',
              username: '$target.username'
            }
          }
        }
      ])
      .toArray();
  } catch (err) {
    console.log('User reports failed to be found');
    return next(err);
  }

  return res.status(200).json({ results: reports });
};
