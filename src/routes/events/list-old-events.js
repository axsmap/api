const moment = require("moment");

const { Event } = require("../../models/event");

const { validateListEvents } = require("./validations");

module.exports = async (req, res, next) => {
  const queryParams = req.query;

  const { errors, isValid } = validateListEvents(queryParams);
  if (!isValid) return res.status(400).json(errors);

  const eventsQuery = {};

  if (queryParams.keywords && queryParams.keywords !== "") {
    eventsQuery.$text = { $search: queryParams.keywords };
  }

  let sortBy = "-startDate";
  let page = queryParams.page ? parseInt(queryParams.page, 10) - 1 : 0;
  const pageLimit = parseInt(queryParams.pageLimit, 10) || 12;

  const currentDate = moment().utc().toDate();
  eventsQuery.endDate = { $lt: currentDate };
  eventsQuery.status = { $ne: "draft" };
  eventsQuery.$or = [
    { managers: req?.user?.id },
    { participants: req?.user?.id },
  ];

  const isTest =
    typeof queryParams.isTest === "boolean"
      ? queryParams.isTest
      : queryParams.isTest?.toLowerCase?.() === "true";

  if (!isTest) {
    eventsQuery.name = {
      $not: /t[\W_0-9]*e[\W_0-9]*s[\W_0-9]*t/i,
    };
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
