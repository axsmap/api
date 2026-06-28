const moment = require("moment");

const { Event } = require("../../models/event");

const { validateListEvents } = require("./validations");
const { buildEventsQuery } = require("./list-events-helpers");

module.exports = async (req, res, next) => {
  const queryParams = req.query;

  const { errors, isValid } = validateListEvents(queryParams);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  let sortBy = "-startDate";
  let page = queryParams.page ? parseInt(queryParams.page, 10) - 1 : 0;
  const pageLimit = queryParams.pageLimit ? parseInt(queryParams.pageLimit, 10) : 12;
  const currentDate = moment().startOf("day").utc().toDate();
  const eventsQuery = buildEventsQuery(queryParams, req.user, currentDate);

  // Handle status filter for active/inactive/upcoming/draft mapathons
  // status=draft: only drafts created by the authenticated user
  // status=active: currently running (startDate <= today AND endDate >= today)
  // status=upcoming: future events (startDate > today)
  // status=inactive: past events (endDate < today)
  // status=all or no status: return all non-draft events (no date filter)
  if (!eventsQuery) {
    return res.status(200).json({
      page: 1,
      lastPage: null,
      pageLimit,
      total: 0,
      sortBy,
      results: [],
    });
  }

  let events;
  let total;
  try {
    [events, total] = await Promise.all([
      Event.aggregate()
        .match(eventsQuery)
        .project({
          _id: 0,
          id: "$_id",
          address: 1,
          endDate: 1,
          name: 1,
          poster: 1,
          reviewsAmount: 1,
          reviewsGoal: 1,
          startDate: 1,
          status: 1,
          location: 1,
          description: 1,
          isInviteOnly: 1,
          isOpen: 1,
        })
        .sort(sortBy)
        .skip(page * pageLimit)
        .limit(pageLimit),
      Event.countDocuments(eventsQuery),
    ]);
  } catch (err) {
    console.log("Events failed to be found or count at list-events");
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
    results: events,
  });
};
