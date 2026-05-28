const moment = require('moment');

const { validateListEvents } = require('./validations');
const {
  applyStatusFilter,
  eventListPipeline
} = require('./event-list-helpers');
const { getDb } = require('./leaderboard-helpers');

const logTrace = (requestId, step, startedAt, extra = {}) => {
  console.log('[events:list-events:trace]', {
    requestId,
    step,
    elapsedMs: Date.now() - startedAt,
    ...extra
  });
};

module.exports = async (req, res, next) => {
  const startedAt = Date.now();
  const requestId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const queryParams = req.query;

  logTrace(requestId, 'start', startedAt, {
    query: queryParams,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  const { errors, isValid } = validateListEvents(queryParams);
  if (!isValid) {
    logTrace(requestId, 'invalid-query', startedAt, { errors });
    return res.status(400).json(errors);
  }

  const eventsQuery = {};

  if (queryParams.keywords) {
    eventsQuery.$text = { $search: queryParams.keywords };
  }

  eventsQuery.isArchived = false;
  applyStatusFilter(eventsQuery, queryParams.status);

  if (!queryParams.status) {
    let afterDate;
    let beforeDate;
    if (queryParams.afterDate && queryParams.beforeDate) {
      afterDate = moment(queryParams.afterDate)
        .utc()
        .toDate();
      beforeDate = moment(queryParams.beforeDate)
        .utc()
        .toDate();

      eventsQuery.startDate = { $gte: afterDate, $lte: beforeDate };
    } else if (queryParams.afterDate) {
      afterDate = moment(queryParams.afterDate)
        .utc()
        .toDate();
      eventsQuery.startDate = { $gte: afterDate };
    } else if (queryParams.beforeDate) {
      beforeDate = moment(queryParams.beforeDate)
        .utc()
        .toDate();
      eventsQuery.startDate = { $lte: beforeDate };
    }
  }

  let sortBy = queryParams.sortBy || '-startDate';
  let page = queryParams.page ? parseInt(queryParams.page, 10) - 1 : 0;
  const pageLimit = parseInt(queryParams.pageLimit, 10) || 12;

  let events;
  let total;
  try {
    const db = await getDb();
    logTrace(requestId, 'db-ready', startedAt, {
      eventsQuery,
      page: page + 1,
      pageLimit,
      sortBy
    });
    [events, total] = await Promise.all([
      db
        .collection('events')
        .aggregate(eventListPipeline({ eventsQuery, sortBy, page, pageLimit }))
        .toArray(),
      db.collection('events').countDocuments(eventsQuery)
    ]);
    logTrace(requestId, 'events-and-count-ready', startedAt, {
      resultCount: events.length,
      total
    });
  } catch (err) {
    console.log('Events failed to be found or count at list-events');
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

  logTrace(requestId, 'response', startedAt, {
    status: 200,
    resultCount: events.length,
    total,
    lastPage
  });
  return res.status(200).json({
    page: page + 1,
    lastPage,
    pageLimit,
    total,
    sortBy,
    results: events
  });
};
