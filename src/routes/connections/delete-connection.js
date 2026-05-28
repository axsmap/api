const { isMongoId } = require('validator');

const { Connection } = require('../../models/connection');
const { canViewConnection } = require('./helpers');

module.exports = async (req, res, next) => {
  const connectionId = req.params.connectionId;

  if (!isMongoId(connectionId || '')) {
    return res.status(404).json({ general: 'Connection not found' });
  }

  let connection;
  try {
    connection = await Connection.findOne({ _id: connectionId });
  } catch (err) {
    console.log(`Connection ${connectionId} failed to be found`);
    return next(err);
  }

  if (!connection || !canViewConnection(connection, req.user.id)) {
    return res.status(404).json({ general: 'Connection not found' });
  }

  try {
    await connection.remove();
  } catch (err) {
    console.log(`Connection ${connection.id} failed to be removed`);
    return next(err);
  }

  return res.status(200).json({ general: 'Connection removed' });
};
