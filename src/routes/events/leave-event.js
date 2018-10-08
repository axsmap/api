const moment = require('moment');

const { Event } = require('../../models/event');

module.exports = async (req, res, next) => {
  const eventId = req.params.eventId;

  let event;
  try {
    event = await Event.findOne({ _id: eventId, isArchived: false });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Event not found' });
    }

    console.log(`Event ${eventId} failed to be found at leave-event`);
    return next(err);
  }

  if (!event) {
    return res.status(404).json({ general: 'Event not found' });
  }

  const endDate = moment(event.endDate).utc();
  const today = moment.utc();

  if (endDate.isBefore(today)) {
    return res.status(400).json({
      general: 'You cannot leave because it already ended'
    });
  }

  if (event.managers.find(m => m.toString() === req.user.id)) {
    event.managers = event.managers.filter(m => m.toString() !== req.user.id);

    if (event.managers.length === 0) {
      return res.status(400).json({
        general: 'You cannot leave because you are the only manager'
      });
    }
  } else if (event.participants.find(p => p.toString() === req.user.id)) {
    event.participants = event.participants.filter(
      p => p.toString() !== req.user.id
    );
  } else {
    return res.status(400).json({ general: 'You are not a participant' });
  }

  event.updatedAt = today.toDate();

  try {
    await event.save();
  } catch (err) {
    console.log(`Event ${event.id} failed to be updated at leave-event`);
    return next(err);
  }

  req.user.events = req.user.events.filter(e => e.toString() !== event.id);
  req.user.updatedAt = today.toDate();

  try {
    await req.user.save();
  } catch (err) {
    console.log(`User ${req.user.id} failed to be updated at leave-event`);
    return next(err);
  }

  return res.status(200).json({ general: 'Success' });
};
