const { ConnectionMessage } = require('../../models/connection-message');
const { getDb } = require('../events/leaderboard-helpers');
const { toObjectId } = require('../connections/helpers');
const { authorizeChatConnection } = require('./helpers');

function createMarkMessagesReadHandler(dependencies = {}) {
  const databaseProvider = dependencies.getDb || getDb;
  const authorize =
    dependencies.authorizeChatConnection || authorizeChatConnection;

  return async (req, res, next) => {
    const { connectionId } = req.params;
    const userId = req.user.id;

    try {
      await authorize(connectionId, userId);

      const db = await databaseProvider();
      const connectionObjectId = toObjectId(connectionId);
      const userObjectId = toObjectId(userId);

      const result = await db
        .collection(ConnectionMessage.collection.name)
        .updateMany(
          {
            connection: connectionObjectId,
            sender: { $ne: userObjectId },
            readBy: { $ne: userObjectId }
          },
          {
            $addToSet: {
              readBy: userObjectId
            },
            $set: {
              updatedAt: new Date()
            }
          }
        );

      return res.status(200).json({
        general: 'Messages marked as read',
        updated: result.modifiedCount
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          general: error.message
        });
      }

      return next(error);
    }
  };
}

module.exports = createMarkMessagesReadHandler();
module.exports.createMarkMessagesReadHandler = createMarkMessagesReadHandler;
