const moment = require('moment');
const { isMongoId } = require('validator');

const { getDb } = require('../events/leaderboard-helpers');
const { toObjectId } = require('../connections/helpers');

module.exports = async (req, res, next) => {
  const userId = req.params.userId;

  if (!isMongoId(userId || '')) {
    return res.status(400).json({ userId: 'Should be a valid id' });
  }

  try {
    const db = await getDb();
    await db.collection('users').updateOne(
      { _id: toObjectId(req.user.id) },
      {
        $pull: { blockedUsers: toObjectId(userId) },
        $set: { updatedAt: moment.utc().toDate() }
      }
    );
  } catch (err) {
    console.log(`User ${req.user.id} failed to unblock user ${userId}`);
    return next(err);
  }

  return res.status(200).json({ general: 'User unblocked' });
};
