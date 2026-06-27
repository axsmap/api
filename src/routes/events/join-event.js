const moment = require("moment");

const { Event } = require("../../models/event");
const { EventParticipant } = require("../../models/event-participant");
const { User } = require("../../models/user");

module.exports = async (req, res, next) => {
  const eventId = req.params.eventId;

  let event;
  try {
    event = await Event.findOne({ _id: eventId, isArchived: false });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({ general: "Event not found" });
    }
    return next(err);
  }

  if (!event) {
    return res.status(404).json({ general: "Event not found" });
  }

  if (event.status === "draft") {
    return res.status(400).json({ general: "Cannot join a draft mapathon" });
  }

  const endDate = moment(event.endDate).utc();
  const today = moment.utc();

  if (endDate.isBefore(today)) {
    return res
      .status(423)
      .json({ general: "This event has already finished" });
  }

  if (event.isOpen === false) {
    return res
      .status(423)
      .json({ general: "This Mapathon is not open for joining" });
  }

  const eventParticipants = event.participants.map((p) => p.toString());
  if (eventParticipants.includes(req.user.id)) {
    return res
      .status(400)
      .json({ general: "You already are a participant in this event" });
  }

  const eventManagers = event.managers.map((m) => m.toString());
  if (eventManagers.includes(req.user.id)) {
    return res
      .status(400)
      .json({ general: "You already are a participant in this event" });
  }

  const inviteCode = req.body?.inviteCode || req.query?.inviteCode;
  if (event.isInviteOnly === true && inviteCode !== event.joinCode) {
    return res.status(403).json({ general: "This Mapathon is invite-only" });
  }

  event.participants = [...event.participants, req.user.id];
  event.updatedAt = moment.utc().toDate();

  try {
    await event.save();
  } catch (err) {
    console.log(`Event ${event.id} failed to be updated at join-event`);
    return next(err);
  }

  try {
    await User.findByIdAndUpdate(req.user.id, {
      $push: { events: event.id },
      $set: { updatedAt: moment.utc().toDate() }
    });
  } catch (err) {
    console.log(`User ${req.user.id} failed to be updated at join-event`);
    return next(err);
  }

  try {
    await EventParticipant.findOneAndUpdate(
      { event: event.id, user: req.user.id },
      { event: event.id, user: req.user.id },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.log(`EventParticipant failed to be created at join-event for user ${req.user.id} event ${event.id}`);
    return next(err);
  }


  return res.status(200).json({ general: "Joined" });
};
