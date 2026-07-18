const { ConnectionMessage } = require('../../models/connection-message');
const { getDb } = require('../events/leaderboard-helpers');
const { toObjectId } = require('../connections/helpers');
const { authorizeChatConnection } = require('./helpers');

function createListMessagesHandler(dependencies = {}) {
  const databaseProvider = dependencies.getDb || getDb;
  const authorize =
    dependencies.authorizeChatConnection || authorizeChatConnection;

  return async (req, res, next) => {
    const { connectionId } = req.params;
    const userId = req.user.id;

    try {
      await authorize(connectionId, userId);

      const db = await databaseProvider();
      const limit = Math.min(
        Math.max(parseInt(req.query.limit, 10) || 30, 1),
        100
      );

      const query = {
        connection: toObjectId(connectionId)
      };

      if (req.query.before) {
        const before = new Date(req.query.before);

        if (Number.isNaN(before.getTime())) {
          return res.status(400).json({
            before: 'Should be a valid date'
          });
        }

        query.createdAt = {
          $lt: before
        };
      }

      const messages = await db
        .collection(ConnectionMessage.collection.name)
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit + 1)
        .toArray();

      const hasMore = messages.length > limit;
      const page = messages.slice(0, limit).reverse();

      return res.status(200).json({
        results: page.map(message => ({
          id: message._id.toString(),
          connectionId: message.connection.toString(),
          senderId: message.sender.toString(),
          text: message.text,
          readBy: (message.readBy || []).map(id => id.toString()),
          createdAt: message.createdAt,
          updatedAt: message.updatedAt
        })),
        hasMore,
        nextCursor:
          hasMore && page.length > 0 ? page[0].createdAt.toISOString() : null
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

module.exports = createListMessagesHandler();
module.exports.createListMessagesHandler = createListMessagesHandler;
