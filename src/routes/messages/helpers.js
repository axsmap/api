const { isMongoId } = require('validator');

const { getDb } = require('../events/leaderboard-helpers');
const { toObjectId } = require('../connections/helpers');

class ChatAuthorizationError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.name = 'ChatAuthorizationError';
    this.status = status;
  }
}

function createAuthorizeChatConnection(databaseProvider = getDb) {
  return async function authorizeChatConnection(connectionId, userId) {
    if (!isMongoId(connectionId || '')) {
      throw new ChatAuthorizationError('Invalid connection id', 400);
    }

    if (!isMongoId(userId || '')) {
      throw new ChatAuthorizationError('Invalid user id', 401);
    }

    const db = await databaseProvider();
    const connection = await db.collection('connections').findOne({
      _id: toObjectId(connectionId)
    });

    if (!connection) {
      throw new ChatAuthorizationError('Connection not found', 404);
    }

    const requesterId = connection.requester.toString();
    const recipientId = connection.recipient.toString();

    if (userId !== requesterId && userId !== recipientId) {
      throw new ChatAuthorizationError(
        'You do not have access to this conversation',
        403
      );
    }

    if (connection.state !== 'accepted') {
      throw new ChatAuthorizationError(
        'Only accepted connections can chat',
        403
      );
    }

    const otherUserId =
      userId === requesterId ? connection.recipient : connection.requester;

    const users = await db
      .collection('users')
      .find({
        _id: {
          $in: [toObjectId(userId), otherUserId]
        }
      })
      .project({
        blockedUsers: 1,
        isArchived: 1,
        isBlocked: 1
      })
      .toArray();

    if (users.length !== 2) {
      throw new ChatAuthorizationError('Chat user not found', 404);
    }

    const currentUser = users.find(user => user._id.toString() === userId);
    const otherUser = users.find(
      user => user._id.toString() === otherUserId.toString()
    );

    if (
      currentUser.isArchived ||
      currentUser.isBlocked ||
      otherUser.isArchived ||
      otherUser.isBlocked
    ) {
      throw new ChatAuthorizationError('This conversation is unavailable', 403);
    }

    const currentUserBlockedIds = (currentUser.blockedUsers || []).map(id =>
      id.toString()
    );
    const otherUserBlockedIds = (otherUser.blockedUsers || []).map(id =>
      id.toString()
    );

    if (
      currentUserBlockedIds.includes(otherUserId.toString()) ||
      otherUserBlockedIds.includes(userId)
    ) {
      throw new ChatAuthorizationError('This conversation is blocked', 403);
    }

    return {
      connection,
      currentUser,
      otherUser
    };
  };
}

const authorizeChatConnection = createAuthorizeChatConnection();

module.exports = {
  authorizeChatConnection,
  createAuthorizeChatConnection,
  ChatAuthorizationError
};
