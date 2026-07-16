const { ConnectionMessage } = require('../models/connection-message');
const { toObjectId } = require('../routes/connections/helpers');
const { authorizeChatConnection } = require('../routes/messages/helpers');
const { connectionRoomName } = require('./connection-room');
const { userRoomName } = require('./user-room');
const { consumeMessageRateLimit } = require('./message-rate-limit');

const MAX_MESSAGE_LENGTH = 2000;

function acknowledgement(callback, socket) {
  if (typeof callback === 'function') return callback;
  return response => socket.emit('chat:message:result', response);
}

function serializeMessage(message) {
  return {
    id: message._id.toString(),
    connectionId: message.connection.toString(),
    senderId: message.sender.toString(),
    text: message.text,
    readBy: (message.readBy || []).map(id => id.toString()),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
  };
}

function validateText(text) {
  if (typeof text !== 'string') return 'Message text is required';

  const trimmedText = text.trim();
  if (!trimmedText) return 'Message cannot be empty';
  if (trimmedText.length > MAX_MESSAGE_LENGTH) {
    return `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`;
  }

  return null;
}

function registerMessageHandlers(io, socket, dependencies = {}) {
  const authorize =
    dependencies.authorizeChatConnection || authorizeChatConnection;
  const createMessage =
    dependencies.createMessage || (values => ConnectionMessage.create(values));
  const consumeRateLimit =
    dependencies.consumeMessageRateLimit || consumeMessageRateLimit;

  socket.on('chat:message:send', async (payload = {}, callback) => {
    const respond = acknowledgement(callback, socket);
    const connectionId = payload.connectionId;
    const validationError = validateText(payload.text);

    if (validationError) {
      return respond({
        ok: false,
        error: validationError,
        code: 400
      });
    }

    try {
      const { otherUser } = await authorize(connectionId, socket.data.userId);

      if (!consumeRateLimit(socket.data.userId)) {
        return respond({
          ok: false,
          error: 'Too many messages. Please wait a moment and try again.',
          code: 429
        });
      }

      const message = await createMessage({
        connection: toObjectId(connectionId),
        sender: toObjectId(socket.data.userId),
        text: payload.text.trim(),
        readBy: [toObjectId(socket.data.userId)]
      });

      const savedMessage = serializeMessage(message);
      const room = connectionRoomName(connectionId);

      // Joining here makes sending resilient if the client reconnects before
      // it has time to re-emit chat:join.
      await socket.join(room);
      io.to(room).emit('chat:message:new', savedMessage);
      io.to(userRoomName(otherUser._id.toString())).emit('chat:unread:new', {
        connectionId,
        messageId: savedMessage.id
      });

      return respond({
        ok: true,
        message: savedMessage
      });
    } catch (error) {
      if (error.status && error.status >= 400 && error.status < 500) {
        console.warn('Chat authorization rejected', {
          userId: socket.data.userId,
          connectionId,
          status: error.status
        });
      }
      return respond({
        ok: false,
        error: error.message || 'Unable to send message',
        code: error.status || 500
      });
    }
  });
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  registerMessageHandlers,
  serializeMessage,
  validateText
};
