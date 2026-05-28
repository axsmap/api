const moment = require('moment');

const { validateListEvents } = require('./validations');
const { eventListPipeline } = require('./event-list-helpers');
const { getDb } = require('./leaderboard-helpers');

module.exports = async (req, res, next) => {
  const queryParams = req.query;

  const { errors, isValid } = validateListEvents(queryParams);
  if (!isValid) return res.status(400).json(errors);

  const eventsQuery = {
    isArchived: false,
    endDate: {
      $lt: moment()
        .utc()
        .toDate()
    }
  };

  if (queryParams.keywords) {
    eventsQuery.$text = { $search: queryParams.keywords };
  }

  const sortBy = queryParams.sortBy || '-startDate';
  let page = queryParams.page ? parseInt(queryParams.page, 10) - 1 : 0;
  const pageLimit = parseInt(queryParams.pageLimit, 10) || 12;

  let events;
  let total;
  try {
    const db = await getDb();
    [events, total] = await Promise.all([
      db
        .collection('events')
        .aggregate(eventListPipeline({ eventsQuery, sortBy, page, pageLimit }))
        .toArray(),
      db.collection('events').countDocuments(eventsQuery)
    ]);
  } catch (err) {
    console.log('Old events failed to be found or count at list-old-events');
    return next(err);
  }

  let lastPage = Math.ceil(total / pageLimit);
  if (lastPage > 0) {
    if (page > lastPage) {
      return res
        .status(400)
        .json({ page: `Should be equal to or less than ${lastPage}` });
    }
  } else {
    page = null;
    lastPage = null;
  }

  return res.status(200).json({
    page: page + 1,
    lastPage,
    pageLimit,
    total,
    sortBy,
    results: events
  });
};
