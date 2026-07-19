const mongoose = require('mongoose');

require('dotenv').config();

const badgeCatalog = require('../data/badge-catalog');
const { BadgeDefinition } = require('../models/badge-definition');

async function main() {
  await mongoose.connect(
    process.env.MONGODB_URI,
    {
      connectTimeoutMS: 30000,
      useCreateIndex: true,
      useNewUrlParser: true
    }
  );

  const activeDefinitions = badgeCatalog.filter(
    definition => definition.isActive
  );
  const operations = activeDefinitions.map(definition => ({
    updateOne: {
      filter: { badgeId: definition.badgeId },
      update: { $set: { iconUrl: definition.iconUrl } }
    }
  }));
  const result = await BadgeDefinition.bulkWrite(operations, {
    ordered: false
  });
  const matched =
    result.matchedCount == null ? result.nMatched : result.matchedCount;
  const modified =
    result.modifiedCount == null ? result.nModified : result.modifiedCount;
  const missing = activeDefinitions.length - (matched || 0);

  console.log(
    JSON.stringify(
      {
        assetBaseUrl:
          process.env.BADGE_ASSET_BASE_URL || 'https://api.axsmap.com/badges',
        definitions: activeDefinitions.length,
        matched: matched || 0,
        modified: modified || 0,
        missing
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
  if (missing) process.exitCode = 1;
}

main().catch(async error => {
  console.error(error.stack || error.message);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
