const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();

const { synchronizeBadges } = require('../services/badge-sync');
const {
  validateBadgeSynchronization
} = require('../services/badge-validation');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const reportArgument = process.argv.find(
    argument => argument.indexOf('--report=') === 0
  );
  const reportPath = reportArgument
    ? path.resolve(reportArgument.slice('--report='.length))
    : path.resolve(process.cwd(), 'badge-sync-report.json');

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
  const summary = await synchronizeBadges({
    dryRun,
    validate: validateBadgeSynchronization
  });
  fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(
    JSON.stringify({ service: 'badge-sync', reportPath, summary }, null, 2)
  );
  await mongoose.disconnect();
  if (!summary.success) process.exitCode = 1;
}

main().catch(async error => {
  console.error(error.stack || error.message);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
