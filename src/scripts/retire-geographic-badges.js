const mongoose = require('mongoose');

require('dotenv').config();

const { BadgeDefinition } = require('../models/badge-definition');
const { EarnedBadge } = require('../models/earned-badge');

const retiredBadgeIds = [
  'traveler_badge',
  'explorer_badge',
  'globetrotter_badge'
];

async function main() {
  await mongoose.connect(
    process.env.MONGODB_URI,
    {
      connectTimeoutMS: 30000,
      useCreateIndex: true,
      useNewUrlParser: true
    }
  );

  const definitions = await BadgeDefinition.find({
    badgeId: { $in: retiredBadgeIds }
  })
    .select('_id badgeId')
    .lean();
  const definitionIds = definitions.map(definition => definition._id);
  const earnedBefore = definitionIds.length
    ? await EarnedBadge.countDocuments({ badge: { $in: definitionIds } })
    : 0;
  const earnedResult = definitionIds.length
    ? await EarnedBadge.deleteMany({ badge: { $in: definitionIds } })
    : { deletedCount: 0 };
  const definitionResult = await BadgeDefinition.deleteMany({
    badgeId: { $in: retiredBadgeIds }
  });

  const remainingDefinitions = await BadgeDefinition.countDocuments({});
  const remainingRetired = await BadgeDefinition.countDocuments({
    badgeId: { $in: retiredBadgeIds }
  });

  console.log(
    JSON.stringify(
      {
        retiredBadgeIds,
        definitionsFound: definitions.length,
        definitionsRemoved: definitionResult.deletedCount || 0,
        earnedFound: earnedBefore,
        earnedRemoved: earnedResult.deletedCount || 0,
        remainingDefinitions,
        remainingRetired
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
  if (remainingDefinitions !== 20 || remainingRetired !== 0)
    process.exitCode = 1;
}

main().catch(async error => {
  console.error(error.stack || error.message);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
