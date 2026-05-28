const moment = require('moment');
const { isMongoId } = require('validator');

const { getDb } = require('../events/leaderboard-helpers');
const { toObjectId } = require('../connections/helpers');

module.exports = async (req, res, next) => {
  const userId = req.params.userId;

  if (!isMongoId(userId || '')) {
    return res.status(400).json({ userId: 'Should be a valid id' });
  }

  if (userId === req.user.id) {
    return res.status(400).json({ general: 'You cannot block yourself' });
  }

  try {
    const db = await getDb();
    const requester = toObjectId(req.user.id);
    const target = toObjectId(userId);

    await Promise.all([
      db.collection('users').updateOne(
        { _id: requester },
        {
          $addToSet: { blockedUsers: target },
          $set: { updatedAt: moment.utc().toDate() }
        }
      ),
      db.collection('connections').deleteMany({
        $or: [
          { requester, recipient: target },
          { requester: target, recipient: requester }
        ]
      })
    ]);
  } catch (err) {
    console.log(`User ${req.user.id} failed to block user ${userId}`);
    return next(err);
  }

  return res.status(200).json({ general: 'User blocked' });
};
