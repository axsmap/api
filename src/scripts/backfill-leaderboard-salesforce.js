const { MongoClient, ObjectId } = require('mongodb');

require('dotenv').config();

const {
  AXS_MAP_ACCOUNT_IDS,
  AXS_MAP_USERNAMES,
  monthKey,
  monthRange,
  stateSyncDocument
} = require('../services/leaderboard-milestones');
const {
  contactFields
} = require('../services/salesforce-leaderboard-sync');
const salesforce = require('../helpers/salesforce');

function hasArgument(name) {
  return process.argv.includes(name);
}

function contributorPipeline(range) {
  const match = {
    isBanned: false,
    user: {
      $ne: null,
      $nin: AXS_MAP_ACCOUNT_IDS.map(id => new ObjectId(id))
    }
  };
  if (range) match.createdAt = { $gte: range.start, $lt: range.end };
  return [
    { $match: match },
    { $group: { _id: '$user', reviewCount: { $sum: 1 } } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $match: {
        'user.isArchived': false,
        'user.isBlocked': false,
        'user.username': { $nin: AXS_MAP_USERNAMES }
      }
    },
    {
      $sort: {
        reviewCount: -1,
        'user.username': 1,
        'user.firstName': 1,
        'user.lastName': 1,
        _id: 1
      }
    },
    {
      $project: {
        _id: 1,
        reviewCount: 1,
        salesforceContactId: '$user.salesforceContactId'
      }
    }
  ];
}

function baselineDocuments(allTimeRows, monthlyRows, now = new Date()) {
  const monthlyPositions = new Map(
    monthlyRows.map((row, index) => [String(row._id), index + 1])
  );
  const key = monthKey(now);
  return allTimeRows.map((row, index) => {
    const state = {
      allTimePosition: index + 1,
      previousAllTimePosition: null,
      monthlyPosition: monthlyPositions.get(String(row._id)) || null,
      previousMonthlyPosition: null,
      monthKey: key,
      reviewCount: row.reviewCount,
      updatedAt: now
    };
    const user = {
      _id: row._id,
      salesforceContactId: row.salesforceContactId || null
    };
    return {
      user,
      state,
      job: stateSyncDocument(user, state, now)
    };
  });
}

async function writeBaseline(db, documents) {
  if (!documents.length) return;
  await db.collection('leaderboard_states').bulkWrite(
    documents.map(({ user, state }) => ({
      replaceOne: {
        filter: { _id: user._id },
        replacement: { _id: user._id, ...state },
        upsert: true
      }
    })),
    { ordered: false }
  );
  const mapped = documents.filter(({ user }) => user.salesforceContactId);
  if (mapped.length) {
    await db.collection('salesforce_leaderboard_sync').bulkWrite(
      mapped.map(({ job }) => ({
        replaceOne: {
          filter: { _id: job._id },
          replacement: job,
          upsert: true
        }
      })),
      { ordered: false }
    );
  }
}

async function syncContactJobs(db, batchSize = 200) {
  let synced = 0;
  let failed = 0;
  while (true) {
    const jobs = await db
      .collection('salesforce_leaderboard_sync')
      .find({ kind: 'contact', status: { $in: ['pending', 'failed'] } })
      .limit(batchSize)
      .toArray();
    if (!jobs.length) break;
    const results = await salesforce.request({
      method: 'patch',
      path: '/composite/sobjects',
      data: {
        allOrNone: false,
        records: jobs.map(job => ({
          attributes: { type: 'Contact' },
          Id: job.contactId,
          ...contactFields(job.payload)
        }))
      }
    });
    const now = new Date();
    await db.collection('salesforce_leaderboard_sync').bulkWrite(
      jobs.map((job, index) => {
        const result = results[index] || {};
        const success = result.success === true;
        if (success) synced += 1;
        else failed += 1;
        return {
          updateOne: {
            filter: { _id: job._id },
            update: {
              $set: success
                ? {
                  status: 'synced',
                  salesforceId: result.id || job.contactId,
                  syncedAt: now,
                  updatedAt: now
                }
                : {
                  status: 'failed',
                  error: JSON.stringify(result.errors || []),
                  updatedAt: now
                }
            }
          }
        };
      }),
      { ordered: false }
    );
    if (results.some(result => result.success !== true)) break;
  }
  return { synced, failed };
}

async function main() {
  const apply = hasArgument('--apply');
  if (apply && !hasArgument('--confirm-production')) {
    throw new Error(
      'Production writes require both --apply and --confirm-production'
    );
  }
  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const databaseName = decodeURIComponent(
    new URL(process.env.MONGODB_URI).pathname.replace(/^\//, '')
  );
  const db = client.db(databaseName);
  try {
    const now = new Date();
    const [allTimeRows, monthlyRows] = await Promise.all([
      db.collection('reviews').aggregate(contributorPipeline()).toArray(),
      db
        .collection('reviews')
        .aggregate(contributorPipeline(monthRange(now)))
        .toArray()
    ]);
    const documents = baselineDocuments(allTimeRows, monthlyRows, now);
    const report = {
      mode: apply ? 'apply' : 'dry-run',
      contributors: documents.length,
      mappedContacts: documents.filter(item => item.user.salesforceContactId)
        .length,
      unmappedContacts: documents.filter(item => !item.user.salesforceContactId)
        .length,
      monthlyContributors: monthlyRows.length
    };
    if (apply) {
      await writeBaseline(db, documents);
      report.salesforce = await syncContactJobs(db);
    }
    console.log(JSON.stringify(report, null, 2));
    if (apply && report.salesforce.failed) process.exitCode = 1;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  baselineDocuments,
  contributorPipeline,
  syncContactJobs,
  writeBaseline
};
