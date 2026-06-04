const { MongoClient } = require('mongodb');

let clientPromise;

const getDb = async () => {
  if (!clientPromise) {
    clientPromise = MongoClient.connect(
      process.env.MONGODB_URI,
      {
        maxPoolSize: 5
      }
    );
  }

  const client = await clientPromise;
  const database = new URL(process.env.MONGODB_URI).pathname
    .replace(/^\//, '')
    .trim();

  if (!database) {
    throw new Error('MONGODB_URI must include a database name');
  }

  return client.db(decodeURIComponent(database));
};

const getUsername = user => {
  const firstName = (user.firstName || '').trim();
  const lastName = (user.lastName || '').trim();

  if (firstName) {
    return lastName ? `${firstName} ${lastName.charAt(0)}` : firstName;
  }

  if (user.username) return user.username;

  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ') || 'AXS Mapper'
  );
};

const normalizeLeaderboardItem = mapathonId => (item, index) => ({
  rank: index + 1,
  username: getUsername(item),
  placesMapped: item.placesMapped || 0,
  userId: item.userId.toString(),
  mapathonId: mapathonId ? mapathonId.toString() : null,
  avatar: item.avatar
});

module.exports = {
  getDb,
  normalizeLeaderboardItem
};
