const mongoose = require('mongoose');
const { isMongoId } = require('validator');

const { Event } = require('../../models/event');
const { EventParticipant } = require('../../models/event-participant');

module.exports = async (req, res, next) => {
  const { eventId, userId } = req.params;

  if (!isMongoId(eventId) || !isMongoId(userId)) {
    return res.status(400).json({ general: 'Invalid parameters' });
  }

  // Only the message owner can edit
  if (req.user.id !== userId) {
    return res.status(403).json({ general: 'Forbidden' });
  }

  let personalMessage = (req.body.personalMessage || '').trim();
  if (personalMessage.length > 280) {
    return res.status(400).json({ personalMessage: 'Should be less than 281 characters' });
  }

  const eventOid = new mongoose.Types.ObjectId(eventId);
  const userOid = new mongoose.Types.ObjectId(userId);

  // Confirm user is part of event
  let event;
  try {
    event = await Event.findOne({ _id: eventOid, isArchived: false });
  } catch (err) {
    console.log(`Event ${eventId} failed to be found at update-participant-message`);
    return next(err);
  }

  if (!event) {
    return res.status(404).json({ general: 'Event not found' });
  }

  const isParticipant = event.participants.some(p => p.toString() === userId);
  const isManager = event.managers.some(m => m.toString() === userId);

  if (!isParticipant && !isManager) {
    return res.status(404).json({ general: 'Participant not found in this event' });
  }

  let ep;
  try {
    ep = await EventParticipant.findOneAndUpdate(
      { event: eventOid, user: userOid },
      { $set: { personalMessage } },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.log(`EventParticipant failed to be updated at update-participant-message for user ${userId} event ${eventId}`);
    return next(err);
  }

  return res.status(200).json({
    event: ep.event,
    user: ep.user,
    personalMessage: ep.personalMessage
  });
};
