const { connectionRoomName } = require('./connection-room');

async function revokeChatAccess(io, connectionIds, reason) {
  if (!io) return;

  const uniqueIds = [...new Set(connectionIds.map(id => id.toString()))];

  await Promise.all(
    uniqueIds.map(async connectionId => {
      const room = connectionRoomName(connectionId);
      io.to(room).emit('chat:access:revoked', {
        connectionId,
        reason
      });
      await io.in(room).socketsLeave(room);
    })
  );
}

module.exports = { revokeChatAccess };
