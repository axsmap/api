const moment = require('moment');
const { isMongoId } = require('validator');

const { getDb } = require('../events/leaderboard-helpers');
const { toObjectId } = require('./helpers');

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
  const requester = toObjectId(req.user.id);
  const recipientId = toObjectId(userId);
  const sharedEventId = toObjectId(eventId);

  try {
    const db = await getDb();
    [recipient, event] = await Promise.all([
      db
        .collection('users')
        .findOne({ _id: recipientId, isArchived: false, isBlocked: false }),
      db.collection('events').findOne({ _id: sharedEventId, isArchived: false })
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
    return res.status(403).json({
      general: 'This user only accepts requests from mutual connections'
    });
  }

  if (!sharesMapathon(event, req.user.id, userId)) {
    return res.status(403).json({
      general: 'You can only connect with users from the same Mapathon'
    });
  }

  try {
    const db = await getDb();
    existingConnection = await db.collection('connections').findOne({
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
    if (existingConnection.state === 'declined') {
      try {
        const db = await getDb();
        await db.collection('connections').updateOne(
          { _id: existingConnection._id },
          {
            $set: {
              requester,
              recipient: recipientId,
              state: 'pending',
              updatedAt: moment.utc().toDate()
            },
            $addToSet: { sharedEvents: event._id }
          }
        );
      } catch (err) {
        console.log(
          `Connection ${existingConnection._id.toString()} failed to reopen`
        );
        return next(err);
      }

      return res.status(200).json({
        id: existingConnection._id.toString(),
        state: 'pending',
        general: 'Connection requested'
      });
    }

    if (
      !(existingConnection.sharedEvents || []).find(
        e => e.toString() === event._id.toString()
      )
    ) {
      try {
        const db = await getDb();
        await db.collection('connections').updateOne(
          { _id: existingConnection._id },
          {
            $addToSet: { sharedEvents: event._id },
            $set: { updatedAt: moment.utc().toDate() }
          }
        );
      } catch (err) {
        console.log(
          `Connection ${existingConnection._id.toString()} failed to update shared events`
        );
        return next(err);
      }
    }

    return res.status(200).json({
      id: existingConnection._id.toString(),
      state: existingConnection.state,
      general: 'Connection already exists'
    });
  }

  let connection;
  try {
    const db = await getDb();
    const now = moment.utc().toDate();
    connection = await db.collection('connections').insertOne({
      requester,
      recipient: recipientId,
      state: 'pending',
      sharedEvents: [event._id],
      createdAt: now,
      updatedAt: now
    });
  } catch (err) {
    console.log('Connection request failed to be created');
    return next(err);
  }

  return res.status(201).json({
    id: connection.insertedId.toString(),
    state: 'pending',
    general: 'Connection requested'
  });
};
