const { isMongoId } = require('validator');

const { getDb } = require('../events/leaderboard-helpers');
const { canViewConnection, toObjectId } = require('./helpers');

module.exports = async (req, res, next) => {
  const connectionId = req.params.connectionId;

  if (!isMongoId(connectionId || '')) {
    return res.status(404).json({ general: 'Connection not found' });
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

  try {
    const db = await getDb();
    await db.collection('connections').deleteOne({ _id: connection._id });
  } catch (err) {
    console.log(`Connection ${connection._id.toString()} failed to be removed`);
    return next(err);
  }

  return res.status(200).json({ general: 'Connection removed' });
};
