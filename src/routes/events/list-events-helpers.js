function buildEventsQuery(queryParams, user, currentDate) {
  const eventsQuery = {};

  if (queryParams.keywords && queryParams.keywords !== "") {
    eventsQuery.$text = { $search: queryParams.keywords };
  }

  eventsQuery.isArchived = false;

  if (queryParams.status === "draft") {
    if (!user) {
      return null;
    }

    const mongoose = require("mongoose");
    eventsQuery.status = "draft";
    eventsQuery.managers = new mongoose.Types.ObjectId(user.id);
  } else {
    eventsQuery.status = { $ne: "draft" };

    if (queryParams.status === "active") {
      eventsQuery.startDate = { $lte: currentDate };
      eventsQuery.endDate = { $gte: currentDate };
    } else if (queryParams.status === "upcoming") {
      eventsQuery.startDate = { $gt: currentDate };
    } else if (queryParams.status === "inactive") {
      eventsQuery.endDate = { $lt: currentDate };
    }
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

  return eventsQuery;
}

module.exports = {
  buildEventsQuery,
};
