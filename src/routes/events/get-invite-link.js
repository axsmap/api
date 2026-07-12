const crypto = require('crypto');

const { Event } = require('../../models/event');

const createInviteCode = () => crypto.randomBytes(24).toString('hex');

module.exports = async (req, res, next) => {
  const eventId = req.params.eventId;

  let event;
  try {
    event = await Event.findOne({ _id: eventId, isArchived: false }).select(
      '+inviteCode'
    );
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Event not found' });
    }

    console.log(`Event ${eventId} failed to be found at get-invite-link`);
    return next(err);
  }

  if (!event) {
    return res.status(404).json({ general: 'Event not found' });
  }

  const eventManagers = event.managers.map(m => m.toString());
  if (!eventManagers.includes(req.user.id)) {
    return res.status(403).json({ general: 'Forbidden action' });
  }

  if (!event.inviteCode) {
    event.inviteCode = createInviteCode();

    try {
      await event.save();
    } catch (err) {
      console.log(`Invite link failed to save for event ${event.id}`);
      return next(err);
    }
  }

  return res.status(200).json({ inviteCode: event.inviteCode });
};
