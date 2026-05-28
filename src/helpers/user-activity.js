const { ObjectId } = require('mongodb');

const { getDb } = require('../routes/events/leaderboard-helpers');

async function markUserOpened(userId, openedAt = new Date()) {
  if (!userId) {
    return null;
  }

  const db = await getDb();
  return db.collection('users').updateOne(
    {
      _id: new ObjectId(userId),
      isArchived: false
    },
    {
      $set: {
        lastOpenedAt: openedAt
      }
    }
  );
}

module.exports = {
  markUserOpened
};
