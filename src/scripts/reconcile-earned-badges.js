const mongoose = require('mongoose');

require('dotenv').config();

const { User } = require('../models/user');
const { evaluateUserBadges } = require('../services/badge-evaluator');

async function main() {
  if (!process.env.MONGODB_URI)
    throw new Error('MONGODB_URI is not configured');
  await mongoose.connect(
    process.env.MONGODB_URI,
    {
      connectTimeoutMS: 30000,
      useCreateIndex: true,
      useNewUrlParser: true
    }
  );
  // Every supported catalog badge requires at least five reviews or five event
  // participations. Geographic badges are evaluated only after country data is
  // complete, so users outside this set cannot currently receive an award.
  const cursor = User.find({
    isArchived: false,
    isBlocked: false,
    $or: [{ reviewsAmount: { $gte: 5 } }, { 'events.0': { $exists: true } }]
  })
    .select('_id')
    .lean()
    .cursor();
  const summary = {
    usersProcessed: 0,
    badgesAwarded: 0,
    badgesRevoked: 0,
    errors: [],
    unsupportedCriteria: {}
  };
  await cursor.eachAsync(
    async user => {
      try {
        const result = await evaluateUserBadges(user._id, {
          revokeUnearned: true
        });
        summary.usersProcessed += 1;
        summary.badgesAwarded += result.awarded.length;
        summary.badgesRevoked += result.revoked.length;
        result.unsupported.forEach(item => {
          summary.unsupportedCriteria[item.badgeId] = item.reason;
        });
      } catch (error) {
        summary.errors.push({
          userId: String(user._id),
          message: error.message
        });
      }
      if (summary.usersProcessed % 100 === 0)
        console.log(
          JSON.stringify({ service: 'badge-reconcile', progress: summary })
        );
    },
    { parallel: 1 }
  );
  console.log(JSON.stringify({ service: 'badge-reconcile', summary }, null, 2));
  await mongoose.disconnect();
  if (summary.errors.length) process.exitCode = 1;
}

main().catch(async error => {
  console.error(error.stack || error.message);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
