const authenticateSocket = require('./authenticate');
const { registerConnectionRoomHandlers } = require('./connection-room');
const { registerMessageHandlers } = require('./messages');
const registerReadMessageHandlers = require('./read-messages');
const { userRoomName } = require('./user-room');

function configureSocketServer(io) {
  io.use(authenticateSocket);

  io.on('connection', socket => {
    socket.join(userRoomName(socket.data.userId));
    registerConnectionRoomHandlers(socket);
    registerMessageHandlers(io, socket);
    registerReadMessageHandlers(io, socket);

    socket.emit('chat:ready', {
      userId: socket.data.userId
    });
  });
}

module.exports = configureSocketServer;
