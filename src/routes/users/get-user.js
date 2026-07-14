const mongoose = require('mongoose');

const { User } = require('../../models/user');

const getUserResponse = async (matchStage, collation) => {
  const cursor = User.aggregate([
    {
      $match: matchStage
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
        displayName: 1,
        email: 1,
        events: 1,
        firstName: 1,
        gender: 1,
        isArchived: 1,
        isBlocked: 1,
        isSubscribed: 1,
        language: 1,
        lastName: 1,
        phone: 1,
        profilePublic: { $ifNull: ['$profilePublic', true] },
        publicVisibility: { $ifNull: ['$publicVisibility', 'displayName'] },
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

  if (collation) {
    cursor.collation(collation);
  }

  const users = await cursor;
  return users.length ? users[0] : null;
};

const shapeResponse = user => {
  const publicFields = Object.assign({}, user);
  delete publicFields.isArchived;
  delete publicFields.isBlocked;

  return Object.assign({}, publicFields, {
    ranking: user.ranking.length ? user.ranking[0].ranking + 1 : 1
  });
};

const getUser = async (req, res, next) => {
  const userId = req.params.userId;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(404).json({ general: 'User not found' });
  }

  let user;
  try {
    const userIdObj = mongoose.Types.ObjectId(userId);
    user = await getUserResponse({ _id: userIdObj });
  } catch (err) {
    if (err.name === 'CastError' || err.name === 'BSONError') {
      return res.status(404).json({ general: 'User not found' });
    }

    console.log(`User ${userId} failed to be found at get-user`);
    return next(err);
  }

  if (!user) {
    return res.status(404).json({ general: 'User not found' });
  }

  return res.status(200).json(shapeResponse(user));
};

module.exports = getUser;
module.exports.getUserResponse = getUserResponse;
module.exports.shapeResponse = shapeResponse;
