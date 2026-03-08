const { Event } = require("../../models/event");
const { sendError } = require("../../helpers/Error");

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: "You are blocked" });
  }

  const eventId = req.params.eventId;

  let event;
  try {
    event = await Event.findOne({ _id: eventId });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json(sendError({ general: "Event not found" }));
    }
    console.log(`Event ${eventId} failed to be found at publish-event`);
    return next(err);
  }

  if (!event) {
    return res.status(404).json(sendError({ general: "Event not found" }));
  }

  // Only the event manager can publish
  if (
    !event.managers.find((m) => m.toString() === req.user.id) &&
    !req.user.isAdmin
  ) {
    return res.status(403).json(sendError({ general: "Forbidden action" }));
  }

  // Only draft events can be published
  if (event.status !== "draft") {
    return res.status(400).json(
      sendError({ general: "Only draft mapathons can be published" })
    );
  }

  try {
    event.status = "active";
    await event.save();
  } catch (err) {
    console.log(`Event ${eventId} failed to be published at publish-event`);
    return next(err);
  }

  let eventLocation;
  if (event.location && event.location.coordinates) {
    eventLocation = {
      lat: event.location.coordinates[1],
      lng: event.location.coordinates[0],
    };
  }

  const dataResponse = {
    id: event.id,
    address: event.address,
    description: event.description,
    endDate: event.endDate,
    startDate: event.startDate,
    isOpen: event.isOpen,
    location: eventLocation,
    managers: event.managers,
    name: event.name,
    participantsGoal: event.participantsGoal,
    poster: event.poster,
    reviewsGoal: event.reviewsGoal,
    status: event.status,
    teamManager: event.teamManager,
  };

  return res.status(200).json(dataResponse);
};
