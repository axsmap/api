const moment = require("moment");

const { Event } = require("../../models/event");
const jwt = require("jsonwebtoken");

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Authorization token missing or invalid" });
  }

  const token = authHeader.split(" ")[1];

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userId = decoded.userId;

  const eventsQuery = {};
  const currentDate = moment().startOf("day").utc().toDate();

  eventsQuery.startDate = { $lte: currentDate };
  eventsQuery.endDate = { $gte: currentDate };
  eventsQuery.status = { $ne: "draft" };
  eventsQuery.$or = [{ managers: userId }, { participants: userId }];

  const queryParams = req.query;
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
      Event.aggregate().match(eventsQuery).project({
        _id: 0,
        id: "$_id",
        name: 1,
        description: 1,
      }),
      Event.countDocuments(eventsQuery),
    ]);

    return res.status(200).json({
      total,
      results: events,
    });
  } catch (err) {
    return res.status(400).json({ err });
  }
};
