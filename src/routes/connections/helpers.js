const { ObjectId } = require('mongodb');

const getConnectionUsers = connection => [
  connection.requester && connection.requester.toString(),
  connection.recipient && connection.recipient.toString()
];

const canViewConnection = (connection, userId) =>
  getConnectionUsers(connection).includes(userId);

const isAcceptedConnectionBetween = connection => (userA, userB) =>
  connection &&
  connection.state === 'accepted' &&
  getConnectionUsers(connection).includes(userA) &&
  getConnectionUsers(connection).includes(userB);

const userPublicProjection = {
  _id: 0,
  id: '$_id',
  avatar: 1,
  city: '$zip',
  firstName: 1,
  lastName: 1,
  username: 1
};

const connectionProjection = {
  _id: 0,
  id: '$_id',
  createdAt: 1,
  requester: 1,
  recipient: 1,
  sharedEvents: 1,
  state: 1,
  updatedAt: 1
};

const toObjectId = id => new ObjectId(id);

module.exports = {
  canViewConnection,
  connectionProjection,
  isAcceptedConnectionBetween,
  toObjectId,
  userPublicProjection
};
