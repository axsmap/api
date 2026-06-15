const mongoose = require('mongoose');
const { isMongoId } = require('validator');

const { Event } = require('../../models/event');
const { EventParticipant } = require('../../models/event-participant');

module.exports = async (req, res, next) => {
  const { eventId, userId } = req.params;

  if (!isMongoId(eventId) || !isMongoId(userId)) {
    return res.status(400).json({ general: 'Invalid parameters' });
  }
  if (req.user.id !== userId) {
    return res.status(403).json({ general: 'Forbidden' });
  }

  const { hiddenFromProfile } = req.body;
  if (typeof hiddenFromProfile !== 'boolean') {
    return res.status(400).json({
      hiddenFromProfile: 'Should be a boolean'
    });
  }

  let event;
  try {
    event = await Event.findOne({ _id: eventId, isArchived: false });
  } catch (error) {
    return next(error);
  }
  if (!event) {
    return res.status(404).json({ general: 'Event not found' });
  }
  const belongsToEvent =
    event.participants.some(participant => participant.toString() === userId) ||
    event.managers.some(manager => manager.toString() === userId);
  if (!belongsToEvent) {
    return res.status(404).json({ general: 'Participant not found' });
  }

  try {
    const participant = await EventParticipant.findOneAndUpdate(
      {
        event: new mongoose.Types.ObjectId(eventId),
        user: new mongoose.Types.ObjectId(userId)
      },
      { $set: { hiddenFromProfile } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.status(200).json(participant);
  } catch (error) {
    return next(error);
  }
};
