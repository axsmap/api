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

const getDisplayName = user => {
  const displayName = (user.displayName || '').trim();
  if (displayName) return displayName;

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
  displayName: getDisplayName(item),
  username: item.username || '',
  firstName: item.firstName || '',
  lastName: item.lastName || '',
  profilePublic: item.profilePublic !== false,
  publicVisibility: item.publicVisibility || 'displayName',
  anonymous: item.publicVisibility === 'anonymous',
  placesMapped: item.placesMapped || 0,
  userId: item.userId.toString(),
  mapathonId: mapathonId ? mapathonId.toString() : null,
  avatar: item.avatar
});

module.exports = {
  getDb,
  normalizeLeaderboardItem
};
