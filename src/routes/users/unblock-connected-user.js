const moment = require('moment');
const { isMongoId } = require('validator');

const { User } = require('../../models/user');

module.exports = async (req, res, next) => {
  const userId = req.params.userId;

  if (!isMongoId(userId || '')) {
    return res.status(400).json({ userId: 'Should be a valid id' });
  }

  try {
    await User.updateOne(
      { _id: req.user.id },
      {
        $pull: { blockedUsers: userId },
        $set: { updatedAt: moment.utc().toDate() }
      }
    );
  } catch (err) {
    console.log(`User ${req.user.id} failed to unblock user ${userId}`);
    return next(err);
  }

  return res.status(200).json({ general: 'User unblocked' });
};
