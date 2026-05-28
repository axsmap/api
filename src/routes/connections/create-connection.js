const moment = require('moment');
const mongoose = require('mongoose');
const { isMongoId } = require('validator');

const { Connection } = require('../../models/connection');
const { Event } = require('../../models/event');
const { User } = require('../../models/user');

const sharesMapathon = (event, requesterId, recipientId) => {
  const participantIds = [
    ...(event.participants || []),
    ...(event.managers || [])
  ].map(id => id.toString());

  return (
    participantIds.includes(requesterId) && participantIds.includes(recipientId)
  );
};

module.exports = async (req, res, next) => {
  const { eventId, userId } = req.body;

  if (!isMongoId(userId || '')) {
    return res.status(400).json({ userId: 'Should be a valid id' });
  }

  if (!isMongoId(eventId || '')) {
    return res.status(400).json({ eventId: 'Should be a valid id' });
  }

  if (userId === req.user.id) {
    return res
      .status(400)
      .json({ general: 'You cannot connect with yourself' });
  }

  let recipient;
  let event;
  let existingConnection;
  try {
    [recipient, event] = await Promise.all([
      User.findOne({ _id: userId, isArchived: false, isBlocked: false }),
      Event.findOne({ _id: eventId, isArchived: false })
    ]);
  } catch (err) {
    console.log('Connection target user or event failed to be found');
    return next(err);
  }

  if (!recipient) return res.status(404).json({ userId: 'User not found' });
  if (!event) return res.status(404).json({ eventId: 'Event not found' });

  if (
    (recipient.blockedUsers || [])
      .map(id => id.toString())
      .includes(req.user.id)
  ) {
    return res
      .status(403)
      .json({ general: 'This user is not accepting connections from you' });
  }

  if ((req.user.blockedUsers || []).map(id => id.toString()).includes(userId)) {
    return res
      .status(403)
      .json({ general: 'Unblock this user before connecting' });
  }

  if ((recipient.connectionPreference || 'mapathon') === 'none') {
    return res
      .status(403)
      .json({ general: 'This user is not accepting connection requests' });
  }

  if ((recipient.connectionPreference || 'mapathon') === 'mutual') {
    return res
      .status(403)
      .json({
        general: 'This user only accepts requests from mutual connections'
      });
  }

  if (!sharesMapathon(event, req.user.id, userId)) {
    return res
      .status(403)
      .json({
        general: 'You can only connect with users from the same Mapathon'
      });
  }

  const requester = mongoose.Types.ObjectId(req.user.id);
  const recipientId = mongoose.Types.ObjectId(userId);

  try {
    existingConnection = await Connection.findOne({
      $or: [
        { requester, recipient: recipientId },
        { requester: recipientId, recipient: requester }
      ]
    });
  } catch (err) {
    console.log('Existing connection failed to be found');
    return next(err);
  }

  if (existingConnection) {
    if (!existingConnection.sharedEvents.find(e => e.toString() === event.id)) {
      existingConnection.sharedEvents = [
        ...existingConnection.sharedEvents,
        event.id
      ];
      existingConnection.updatedAt = moment.utc().toDate();
      try {
        await existingConnection.save();
      } catch (err) {
        console.log(
          `Connection ${existingConnection.id} failed to update shared events`
        );
        return next(err);
      }
    }

    return res.status(200).json({
      id: existingConnection.id,
      state: existingConnection.state,
      general: 'Connection already exists'
    });
  }

  let connection;
  try {
    connection = await Connection.create({
      requester,
      recipient: recipientId,
      sharedEvents: [event.id]
    });
  } catch (err) {
    console.log('Connection request failed to be created');
    return next(err);
  }

  return res.status(201).json({
    id: connection.id,
    state: connection.state,
    general: 'Connection requested'
  });
};
