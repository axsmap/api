const { ObjectId } = require('mongodb');
const moment = require('moment');

const { eventListPipeline } = require('./event-list-helpers');
const { getDb } = require('./leaderboard-helpers');

module.exports = async (req, res, next) => {
  const userId = new ObjectId(req.user.id);
  const now = moment()
    .utc()
    .toDate();
  const eventsQuery = {
    isArchived: false,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [{ managers: userId }, { participants: userId }]
  };

  let events;
  try {
    const db = await getDb();
    events = await db
      .collection('events')
      .aggregate(
        eventListPipeline({
          eventsQuery,
          sortBy: '-startDate',
          page: 0,
          pageLimit: 100
        })
      )
      .toArray();
  } catch (err) {
    console.log(`Joined events for user ${req.user.id} failed to be found`);
    return next(err);
  }

  return res.status(200).json({
    results: events
  });
};
