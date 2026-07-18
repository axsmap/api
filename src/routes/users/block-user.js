const moment = require('moment');

const { User } = require('../../models/user');
const { getDb } = require('../events/leaderboard-helpers');
const { toObjectId } = require('../connections/helpers');
const { revokeChatAccess } = require('../../socket/revoke-chat-access');

module.exports = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ general: 'Forbidden action' });
  }

  const userId = req.params.userId;

  let user;
  try {
    user = await User.findOne({ _id: userId, isArchived: false });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'User not found' });
    }

    console.log(`User with Id ${userId} failed to be found at block-user.`);
    return next(err);
  }

  if (!user) {
    return res.status(404).json({ general: 'User not found' });
  }

  user.isBlocked = true;
  user.updatedAt = moment.utc().toDate();

  try {
    await user.save();
    const db = await getDb();
    const connections = await db
      .collection('connections')
      .find({
        state: 'accepted',
        $or: [
          { requester: toObjectId(user.id) },
          { recipient: toObjectId(user.id) }
        ]
      })
      .project({ _id: 1 })
      .toArray();
    await revokeChatAccess(
      req.app.get('io'),
      connections.map(connection => connection._id),
      'This conversation is unavailable because a user was blocked.'
    );
  } catch (err) {
    console.log(`User with Id ${user.id} failed to be updated at block-user.`);
    return next(err);
  }

  return res.status(200).json({ general: 'Success' });
};
