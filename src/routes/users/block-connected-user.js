const moment = require('moment');
const { isMongoId } = require('validator');

const { Connection } = require('../../models/connection');
const { User } = require('../../models/user');

module.exports = async (req, res, next) => {
  const userId = req.params.userId;

  if (!isMongoId(userId || '')) {
    return res.status(400).json({ userId: 'Should be a valid id' });
  }

  if (userId === req.user.id) {
    return res.status(400).json({ general: 'You cannot block yourself' });
  }

  try {
    await Promise.all([
      User.updateOne(
        { _id: req.user.id },
        {
          $addToSet: { blockedUsers: userId },
          $set: { updatedAt: moment.utc().toDate() }
        }
      ),
      Connection.deleteMany({
        $or: [
          { requester: req.user.id, recipient: userId },
          { requester: userId, recipient: req.user.id }
        ]
      })
    ]);
  } catch (err) {
    console.log(`User ${req.user.id} failed to block user ${userId}`);
    return next(err);
  }

  return res.status(200).json({ general: 'User blocked' });
};
