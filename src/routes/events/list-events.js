const moment = require("moment");
const mongoose = require("mongoose");

const { Event } = require("../../models/event");

const { validateListEvents } = require("./validations");

module.exports = async (req, res, next) => {
  const queryParams = req.query;

  const { errors, isValid } = validateListEvents(queryParams);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  const eventsQuery = {};

  if (queryParams.keywords && queryParams.keywords !== "") {
    eventsQuery.$text = { $search: queryParams.keywords };
  }

  eventsQuery.isArchived = false;

  let sortBy = "-startDate";
  let page = queryParams.page ? parseInt(queryParams.page, 10) - 1 : 0;
  const pageLimit = queryParams.pageLimit ? parseInt(queryParams.pageLimit, 10) : 12;
  const currentDate = moment().startOf("day").utc().toDate();

  // Handle status filter for active/inactive/upcoming/draft mapathons
  // status=draft: only drafts created by the authenticated user
  // status=active: currently running (startDate <= today AND endDate >= today)
  // status=upcoming: future events (startDate > today)
  // status=inactive: past events (endDate < today)
  // status=all or no status: return all non-draft events (no date filter)
  if (queryParams.status === "draft") {
    if (!req.user) {
      // Unauthenticated users cannot see drafts
      return res.status(200).json({
        page: 1,
        lastPage: null,
        pageLimit,
        total: 0,
        sortBy,
        results: [],
      });
    }
    eventsQuery.status = "draft";
    eventsQuery.managers = new mongoose.Types.ObjectId(req.user.id);
  } else {
    // Exclude drafts from all public listings
    eventsQuery.status = { $ne: "draft" };

    if (queryParams.status === "active") {
      eventsQuery.startDate = { $lte: currentDate };
      eventsQuery.endDate = { $gte: currentDate };
    } else if (queryParams.status === "upcoming") {
      eventsQuery.startDate = { $gt: currentDate };
    } else if (queryParams.status === "inactive") {
      eventsQuery.endDate = { $lt: currentDate };
    }
    // If status is "all" or not provided, no date filter is applied
  }

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
