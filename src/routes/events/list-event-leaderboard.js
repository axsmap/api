const mongoose = require('mongoose');
const { isInt, isMongoId } = require('validator');

const { Event } = require('../../models/event');
const { Review } = require('../../models/review');

const MAX_LEADERBOARD_USERS = 5;

module.exports = async (req, res, next) => {
  const errors = {};
  const queryParams = req.query;
  let eventId = req.params.eventId;

  if (!isMongoId(eventId)) {
    return res.status(400).json({ general: 'Event not found' });
  }

  if (queryParams.limit && !isInt(queryParams.limit)) {
    errors.limit = 'Should be a integer';
  } else if (parseInt(queryParams.limit, 10) < 1) {
    errors.limit = 'Should be greater than or equal to 1';
  } else if (parseInt(queryParams.limit, 10) > MAX_LEADERBOARD_USERS) {
    errors.limit = `Should be less than or equal to ${MAX_LEADERBOARD_USERS}`;
  }

  if (Object.keys(errors).length) return res.status(400).json(errors);

  eventId = mongoose.Types.ObjectId(eventId);

  let event;
  try {
    event = await Event.findOne({ _id: eventId, isArchived: false })
      .select('_id')
      .lean();
  } catch (err) {
    console.log(
      `Event ${eventId} failed to be found at list-event-leaderboard`
    );
    return next(err);
  }

  if (!event) {
    return res.status(404).json({ general: 'Event not found' });
  }

  const pageLimit = queryParams.limit
    ? parseInt(queryParams.limit, 10)
    : MAX_LEADERBOARD_USERS;

  let users;
  let total;
  try {
    const leaderboardPipeline = [
      {
        $match: {
          event: eventId
        }
      },
      {
        $group: {
          _id: '$user',
          reviewsAmount: { $sum: 1 }
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
          'user.isAdmin': false,
          'user.isArchived': false,
          'user.isBlocked': false
        }
      },
      {
        $sort: { reviewsAmount: -1, 'user.createdAt': 1 }
      }
    ];
    const totalResults = await Review.aggregate([
      ...leaderboardPipeline,
      {
        $count: 'total'
      }
    ]);

    users = await Review.aggregate([
      ...leaderboardPipeline,
      {
        $limit: pageLimit
      },
      {
        $project: {
          _id: 0,
          id: '$user._id',
          avatar: '$user.avatar',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          reviewsAmount: 1,
          username: '$user.username'
        }
      }
    ]);

    total = totalResults.length ? totalResults[0].total : 0;
  } catch (err) {
    console.log('Event leaderboard users failed to be found or count');
    return next(err);
  }

  const results = users.map((user, index) => ({
    id: user.id,
    avatar: user.avatar,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    reviewsAmount: user.reviewsAmount,
    ranking: index + 1
  }));

  return res.status(200).json({
    page: results.length ? 1 : null,
    lastPage: results.length ? 1 : null,
    pageLimit,
    total,
    results
  });
};
