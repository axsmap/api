const jwt = require('jsonwebtoken');

const { User } = require('../models/user');

function socketAuthenticationError(message, code) {
  const error = new Error(message);
  error.data = { code };
  return error;
}

async function authenticateSocket(socket, next) {
  const suppliedToken = socket.handshake.auth?.token;
  const token =
    typeof suppliedToken === 'string'
      ? suppliedToken.replace(/^Bearer\s+/i, '').trim()
      : '';

  if (!token) {
    return next(
      socketAuthenticationError('No token provided', 'NO_TOKEN_PROVIDED')
    );
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_error) {
    return next(
      socketAuthenticationError(
        'Failed to authenticate',
        'AUTHENTICATION_FAILED'
      )
    );
  }

  let user;
  try {
    user = await User.findOne({
      _id: decoded.userId,
      isArchived: false
    }).select('_id isBlocked');
  } catch (error) {
    return next(error);
  }

  if (!user) {
    return next(socketAuthenticationError('User not found', 'USER_NOT_FOUND'));
  }

  if (user.isBlocked) {
    return next(socketAuthenticationError('You are blocked', 'USER_BLOCKED'));
  }

  socket.data.userId = user._id.toString();
  return next();
}

module.exports = authenticateSocket;
