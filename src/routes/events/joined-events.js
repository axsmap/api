const moment = require("moment");

const { Event } = require("../../models/event");

module.exports = async (req, res, next) => {
  const userId = req?.body?.userId;
  const eventsQuery = {};
  const currentDate = moment().startOf("day").utc().toDate();

  eventsQuery.startDate = { $lte: currentDate };
  eventsQuery.endDate = { $gte: currentDate };
  eventsQuery.$or = [{ managers: userId }, { participants: userId }];

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
