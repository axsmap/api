const { ConnectionMessage } = require('../../models/connection-message');
const { getDb } = require('../events/leaderboard-helpers');
const { toObjectId } = require('../connections/helpers');

module.exports = async (req, res, next) => {
  try {
    const db = await getDb();
    const userId = toObjectId(req.user.id);
    const connections = await db
      .collection('connections')
      .find(
        {
          state: 'accepted',
          $or: [{ requester: userId }, { recipient: userId }]
        },
        { projection: { _id: 1 } }
      )
      .toArray();

    if (connections.length === 0) {
      return res.status(200).json({ total: 0, byConnection: {} });
    }

    const counts = await db
      .collection(ConnectionMessage.collection.name)
      .aggregate([
        {
          $match: {
            connection: { $in: connections.map(connection => connection._id) },
            sender: { $ne: userId },
            readBy: { $ne: userId }
          }
        },
        { $group: { _id: '$connection', count: { $sum: 1 } } }
      ])
      .toArray();

    const byConnection = counts.reduce((result, item) => {
      result[item._id.toString()] = item.count;
      return result;
    }, {});

    return res.status(200).json({
      total: counts.reduce((total, item) => total + item.count, 0),
      byConnection
    });
  } catch (error) {
    return next(error);
  }
};
