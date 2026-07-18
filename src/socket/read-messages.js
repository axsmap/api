const { ConnectionMessage } = require('../models/connection-message');
const { toObjectId } = require('../routes/connections/helpers');
const { authorizeChatConnection } = require('../routes/messages/helpers');
const { connectionRoomName } = require('./connection-room');
const { userRoomName } = require('./user-room');

function registerReadMessageHandlers(io, socket) {
  socket.on('chat:read', async (payload = {}, callback) => {
    const connectionId = payload.connectionId;

    try {
      await authorizeChatConnection(connectionId, socket.data.userId);

      const userId = toObjectId(socket.data.userId);
      const result = await ConnectionMessage.updateMany(
        {
          connection: toObjectId(connectionId),
          sender: { $ne: userId },
          readBy: { $ne: userId }
        },
        {
          $addToSet: { readBy: userId }
        }
      );

      const response = {
        ok: true,
        connectionId,
        userId: socket.data.userId,
        updated: result.nModified ?? result.modifiedCount ?? 0,
        readAt: new Date().toISOString()
      };

      io.to(connectionRoomName(connectionId)).emit(
        'chat:read:update',
        response
      );
      io.to(userRoomName(socket.data.userId)).emit('chat:unread:cleared', {
        connectionId
      });
      if (typeof callback === 'function') callback(response);
    } catch (error) {
      const response = {
        ok: false,
        error: error.message || 'Unable to mark messages read',
        code: error.status || 500
      };
      if (typeof callback === 'function') callback(response);
      else socket.emit('chat:read:result', response);
    }
  });
}

module.exports = registerReadMessageHandlers;
