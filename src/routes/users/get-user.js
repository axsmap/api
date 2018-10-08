const mongoose = require('mongoose');

const { User } = require('../../models/user');

module.exports = async (req, res, next) => {
  const userId = req.params.userId;

  const userIdObj = mongoose.Types.ObjectId(userId);
  let user;
  try {
    user = await User.aggregate([
      {
        $match: { _id: userIdObj }
      },
      {
        $lookup: {
          from: 'events',
          let: { events: '$events' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$_id', '$$events']
                }
              }
            },
            {
              $project: {
                _id: 0,
                id: '$_id',
                endDate: 1,
                name: 1,
                poster: 1,
                startDate: 1
              }
            }
          ],
          as: 'events'
        }
      },
      {
        $lookup: {
          from: 'teams',
          let: { teams: '$teams' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$_id', '$$teams']
                }
              }
            },
            {
              $project: {
                _id: 0,
                id: '$_id',
                avatar: 1,
                name: 1
              }
            }
          ],
          as: 'teams'
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { reviewsAmount: '$reviewsAmount' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $gt: ['$reviewsAmount', '$$reviewsAmount']
                }
              }
            },
            {
              $count: 'ranking'
            }
          ],
          as: 'ranking'
        }
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          avatar: 1,
          description: 1,
          disabilities: 1,
          email: 1,
          events: 1,
          firstName: 1,
          gender: 1,
          isSubscribed: 1,
          language: 1,
          lastName: 1,
          phone: 1,
          ranking: 1,
          reviewsAmount: 1,
          showDisabilities: 1,
          showEmail: 1,
          showPhone: 1,
          teams: 1,
          username: 1,
          zip: 1
        }
      }
    ]);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'User not found' });
    }

    console.log(`User ${userId} failed to be found at get-user`);
    return next(err);
  }

  if (!user) {
    return res.status(404).json({ general: 'User not found' });
  }

  const dataResponse = Object.assign({}, user[0], {
    ranking: user[0].ranking.length ? user[0].ranking[0].ranking + 1 : 1
  });
  return res.status(200).json(dataResponse);
};
