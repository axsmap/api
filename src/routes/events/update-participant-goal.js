const mongoose = require("mongoose");
const { isMongoId } = require("validator");

const { Event } = require("../../models/event");
const { EventParticipant } = require("../../models/event-participant");

module.exports = async (req, res, next) => {
  const { eventId, userId } = req.params;

  if (!isMongoId(eventId) || !isMongoId(userId)) {
    return res.status(400).json({ general: "Invalid parameters" });
  }

  // Owner-only — only the participant themselves can set their personal goal.
  if (req.user.id !== userId) {
    return res.status(403).json({ general: "Forbidden" });
  }

  const personalGoal = req.body.personalGoal;
  if (typeof personalGoal !== "number" || !Number.isInteger(personalGoal)) {
    return res.status(400).json({ personalGoal: "Should be an integer" });
  }
  if (personalGoal < 1) {
    return res.status(400).json({ personalGoal: "Should be greater than or equal to 1" });
  }
  if (personalGoal > 10000) {
    return res.status(400).json({ personalGoal: "Should be less than or equal to 10000" });
  }

  const eventOid = new mongoose.Types.ObjectId(eventId);
  const userOid = new mongoose.Types.ObjectId(userId);

  let event;
  try {
    event = await Event.findOne({ _id: eventOid, isArchived: false });
  } catch (err) {
    console.log(`Event ${eventId} failed to be found at update-participant-goal`);
    return next(err);
  }

  if (!event) {
    return res.status(404).json({ general: "Event not found" });
  }

  const isParticipant = event.participants.some((p) => p.toString() === userId);
  const isManager = event.managers.some((m) => m.toString() === userId);

  if (!isParticipant && !isManager) {
    return res.status(404).json({ general: "Participant not found in this event" });
  }

  let ep;
  try {
    ep = await EventParticipant.findOneAndUpdate(
      { event: eventOid, user: userOid },
      { $set: { personalGoal } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.log(`EventParticipant goal failed to be updated for user ${userId} event ${eventId}`);
    return next(err);
  }

  return res.status(200).json({
    event: ep.event,
    user: ep.user,
    personalGoal: ep.personalGoal,
    hiddenFromProfile: ep.hiddenFromProfile,
  });
};
