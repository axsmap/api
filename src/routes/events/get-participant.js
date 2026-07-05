const mongoose = require('mongoose');
const { isMongoId } = require('validator');

const { Event } = require('../../models/event');
const { EventParticipant } = require('../../models/event-participant');
const { Review } = require('../../models/review');
const { User } = require('../../models/user');
const { maskUserIdentity } = require('../../helpers/leaderboard-mask');

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

  // Spec section 4.4: blocked relationships must hide the target from the
  // viewer's participant lookup, both directions. If the viewer is signed in,
  // mask the participant out of the response. Anonymous viewers see the
  // participant normally — block is a viewer-side privacy primitive, not a
  // universal hide.
  if (req.user && req.user.id && req.user.id !== userId) {
    let viewer;
    try {
      viewer = await User.findById(req.user.id)
        .select('blockedConnectionUserIds')
        .lean();
    } catch (err) {
      console.log(`Viewer block lookup failed at get-participant: ${err.message}`);
      viewer = null;
    }
    const viewerBlocked = (viewer && viewer.blockedConnectionUserIds ? viewer.blockedConnectionUserIds : [])
      .some((id) => id.toString() === userId);

    let target;
    try {
      target = await User.findById(userOid)
        .select('blockedConnectionUserIds')
        .lean();
    } catch (err) {
      console.log(`Target block lookup failed at get-participant: ${err.message}`);
      target = null;
    }
    const targetBlockedViewer = (target && target.blockedConnectionUserIds ? target.blockedConnectionUserIds : [])
      .some((id) => id.toString() === req.user.id);

    if (viewerBlocked || targetBlockedViewer) {
      return res.status(404).json({ general: 'Participant not found in this event' });
    }
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
        lastName: 1,
        username: 1,
        publicVisibility: { $ifNull: ['$publicVisibility', 'displayName'] }
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

  // Mask if this participant chose publicVisibility="anonymous", unless the
  // viewer is the participant themselves or an admin.
  const { publicVisibility, ...identity } = user;
  const masked = maskUserIdentity(identity, publicVisibility, {
    viewerId: req.user && req.user.id,
    viewerIsAdmin: !!(req.user && req.user.isAdmin === true),
  });

  return res.status(200).json({
    ...masked,
    reviewsAmount,
    personalMessage
  });
};
