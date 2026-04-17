const mongoose = require('mongoose');
const { isMongoId } = require('validator');

const { Event } = require('../../models/event');
const { EventParticipant } = require('../../models/event-participant');
const { Review } = require('../../models/review');

module.exports = async (req, res, next) => {
  const { eventId, userId } = req.params;

  if (!isMongoId(eventId) || !isMongoId(userId)) {
    return res.status(400).json({ general: 'Invalid parameters' });
  }

  const eventOid = new mongoose.Types.ObjectId(eventId);
  const userOid = new mongoose.Types.ObjectId(userId);

  let event;
  try {
    event = await Event.findOne({ _id: eventOid, isArchived: false });
  } catch (err) {
    console.log(`Event ${eventId} failed to be found at get-participant`);
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

  // Lookup user info
  const userArr = await mongoose.connection.db.collection('users').aggregate([
    { $match: { _id: userOid } },
    {
      $project: {
        _id: 0,
        id: '$_id',
        avatar: 1,
        firstName: 1,
        lastName: 1
      }
    }
  ]).toArray();

  if (!userArr.length) {
    return res.status(404).json({ general: 'User not found' });
  }

  const user = userArr[0];

  // Count reviews for this event
  let reviewsAmount = 0;
  try {
    reviewsAmount = await Review.countDocuments({ user: userOid, event: eventOid });
  } catch (err) {
    console.log(`Reviews count failed at get-participant for user ${userId} event ${eventId}`);
    return next(err);
  }

  // Get personal message
  let personalMessage = '';
  try {
    const ep = await EventParticipant.findOne({ event: eventOid, user: userOid });
    if (ep) {
      personalMessage = ep.personalMessage || '';
    }
  } catch (err) {
    console.log(`EventParticipant lookup failed at get-participant for user ${userId} event ${eventId}`);
    return next(err);
  }

  return res.status(200).json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    reviewsAmount,
    personalMessage
  });
};
