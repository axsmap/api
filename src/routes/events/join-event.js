const moment = require('moment');

const { Event } = require('../../models/event');
const { Petition } = require('../../models/petition');

module.exports = async (req, res, next) => {
  const eventId = req.params.eventId;

  let event;
  try {
    event = await Event.findOne({ _id: eventId, isArchived: false });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Event not found' });
    }

    console.log(`Event ${eventId} failed to be found at join-event`);
    return next(err);
  }

  if (!event) {
    return res.status(404).json({ general: 'Event not found' });
  }

  const eventParticipants = event.participants.map(p => p.toString());
  if (eventParticipants.includes(req.user.id)) {
    return res
      .status(400)
      .json({ general: 'You already are a participant in this event' });
  }

  const eventManagers = event.managers.map(m => m.toString());
  if (eventManagers.includes(req.user.id)) {
    return res
      .status(400)
      .json({ general: 'You already are a participant in this event' });
  }

  if (event.isOpen) {
    req.user.events = [...req.user.events, event.id];
    req.user.updatedAt = moment.utc().toDate();

    try {
      await req.user.save();
    } catch (err) {
      console.log(`User ${req.user.id} failed to be updated at join-event`);
      return next(err);
    }

    event.participants = [...event.participants, req.user.id];
    event.updatedAt = moment.utc().toDate();

    try {
      await event.save();
    } catch (err) {
      console.log(`Event ${event.id} failed to be updated at join-event`);
      return next(err);
    }

    return res.status(200).json({ general: 'Joined' });
  } else {
    let petition;
    try {
      petition = await Petition.findOne({
        event: event.id,
        sender: req.user.id,
        type: 'request-user-event'
      });
    } catch (err) {
      console.log(
        `Petition from user ${req.user.id} to event ${
          event.id
        } failed to be found at join-event`
      );
      return next(err);
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        general: 'You already have a pending petition with this event'
      });
    }

    if (
      petition &&
      (petition.state === 'rejected' || petition.state === 'canceled')
    ) {
      try {
        await petition.remove();
      } catch (err) {
        console.log(
          `Petition ${petition.id} failed to be removed at join-event`
        );
        return next(err);
      }
    }

    const endDate = moment(event.endDate).utc();
    const today = moment.utc();
    if (endDate.isBefore(today)) {
      return res
        .status(423)
        .json({ general: 'This event has already finished' });
    }

    const petitionData = {
      event: event.id,
      sender: req.user.id,
      type: 'request-user-event'
    };
    try {
      await Petition.create(petitionData);
    } catch (err) {
      if (typeof err.errors === 'object') {
        const validationErrors = {};

        Object.keys(err.errors).forEach(key => {
          validationErrors[key] = err.errors[key].message;
        });

        return res.status(400).json(validationErrors);
      }

      console.log(
        `Petition failed to be created at join-event.\nData: ${JSON.stringify(
          petitionData
        )}`
      );
      return next(err);
    }

    return res.status(200).json({ general: 'Requested' });
  }
};
