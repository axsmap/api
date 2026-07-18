const { authorizeChatConnection } = require('../routes/messages/helpers');

const connectionRoomName = connectionId => `connection:${connectionId}`;

function acknowledgement(callback, socket) {
  if (typeof callback === 'function') return callback;
  return response => socket.emit('chat:join:result', response);
}

function registerConnectionRoomHandlers(socket) {
  socket.on('chat:join', async (payload = {}, callback) => {
    const respond = acknowledgement(callback, socket);
    const connectionId = payload.connectionId;

    try {
      const { otherUser } = await authorizeChatConnection(
        connectionId,
        socket.data.userId
      );

      const room = connectionRoomName(connectionId);
      await socket.join(room);

      return respond({
        ok: true,
        connectionId,
        otherUserId: otherUser._id.toString()
      });
    } catch (error) {
      return respond({
        ok: false,
        error: error.message || 'Unable to join conversation',
        code: error.status || 500
      });
    }
  });
}

module.exports = {
  connectionRoomName,
  registerConnectionRoomHandlers
};
