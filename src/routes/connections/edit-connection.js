const moment = require('moment');
const { isMongoId } = require('validator');

const { getDb } = require('../events/leaderboard-helpers');
const { canViewConnection, toObjectId } = require('./helpers');

module.exports = async (req, res, next) => {
  const connectionId = req.params.connectionId;
  const state = req.body.state;

  if (!isMongoId(connectionId || '')) {
    return res.status(404).json({ general: 'Connection not found' });
  }

  if (!['accepted', 'declined'].includes(state)) {
    return res.status(400).json({ state: 'Should be accepted or declined' });
  }

  let connection;
  try {
    const db = await getDb();
    connection = await db
      .collection('connections')
      .findOne({ _id: toObjectId(connectionId) });
  } catch (err) {
    console.log(`Connection ${connectionId} failed to be found`);
    return next(err);
  }

  if (!connection || !canViewConnection(connection, req.user.id)) {
    return res.status(404).json({ general: 'Connection not found' });
  }

  if (connection.state !== 'pending') {
    return res
      .status(400)
      .json({ general: 'Connection request is already closed' });
  }

  if (connection.recipient.toString() !== req.user.id) {
    return res.status(403).json({ general: 'Only the recipient can respond' });
  }

  try {
    const db = await getDb();
    await db.collection('connections').updateOne(
      { _id: connection._id },
      {
        $set: {
          state,
          updatedAt: moment.utc().toDate()
        }
      }
    );
  } catch (err) {
    console.log(`Connection ${connection._id.toString()} failed to be updated`);
    return next(err);
  }

  return res.status(200).json({
    id: connection._id.toString(),
    state
  });
};
