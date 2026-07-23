const salesforce = require('../helpers/salesforce');

const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;
let timer;
let scheduledAt;
let running = false;

function contactFields(payload) {
  const fields = {
    allTime:
      process.env.SALESFORCE_CONTACT_ALL_TIME_POSITION_FIELD ||
      'Current_All_Time_Leaderboard_Position__c',
    previousAllTime:
      process.env.SALESFORCE_CONTACT_PREVIOUS_ALL_TIME_POSITION_FIELD ||
      'Previous_All_Time_Leaderboard_Position__c',
    monthly:
      process.env.SALESFORCE_CONTACT_MONTHLY_POSITION_FIELD ||
      'Monthly_Leaderboard_Position__c',
    previousMonthly:
      process.env.SALESFORCE_CONTACT_PREVIOUS_MONTHLY_POSITION_FIELD ||
      'Previous_Monthly_Leaderboard_Position__c',
    reviewCount:
      process.env.SALESFORCE_CONTACT_REVIEW_COUNT_FIELD ||
      'Number_of_Reviews__c',
    lastUpdate:
      process.env.SALESFORCE_CONTACT_LAST_UPDATE_FIELD ||
      'Last_Leaderboard_Update__c'
  };
  const result = {
    [fields.allTime]: payload.allTimePosition,
    [fields.previousAllTime]: payload.previousAllTimePosition,
    [fields.monthly]: payload.monthlyPosition,
    [fields.previousMonthly]: payload.previousMonthlyPosition,
    [fields.reviewCount]: payload.reviewCount,
    [fields.lastUpdate]: payload.updatedAt
  };
  if (process.env.SALESFORCE_CONTACT_MONTH_FIELD) {
    result[process.env.SALESFORCE_CONTACT_MONTH_FIELD] = payload.monthKey;
  }
  return result;
}

function eventFields(job) {
  const payload = job.payload;
  return {
    Name: `${payload.eventType} - ${String(job.userId)}`.slice(0, 80),
    Contact__c: job.contactId,
    Leaderboard_type__c: payload.leaderboardType,
    Event_type__c: payload.eventType,
    Old_Leaderboard_Position__c: payload.oldPosition,
    New_Leaderboard_Position__c: payload.newPosition,
    Email_Status__c: 'Pending',
    Unique_Event_Key__c: payload.uniqueEventKey
  };
}

async function syncJob(job) {
  if (!job.contactId) {
    const error = new Error('AXS Map user has no Salesforce Contact mapping');
    error.code = 'SALESFORCE_CONTACT_NOT_MAPPED';
    throw error;
  }
  if (job.kind === 'contact') {
    return salesforce.updateRecord({
      objectName: 'Contact',
      recordId: job.contactId,
      fields: contactFields(job.payload)
    });
  }
  return salesforce.upsertRecord({
    objectName:
      process.env.SALESFORCE_LEADERBOARD_EVENT_OBJECT ||
      'AXS_Map_Leaderboard_Event__c',
    externalIdField: 'Unique_Event_Key__c',
    externalIdValue: job.payload.uniqueEventKey,
    fields: eventFields(job)
  });
}

function nextAttempt(attempts, now) {
  const delay = Math.min(
    MAX_BACKOFF_MS,
    Math.pow(2, Math.min(attempts, 10)) * 60000
  );
  return new Date(now.getTime() + delay);
}

async function claimJob(db, now) {
  const leaseUntil = new Date(now.getTime() + 5 * 60 * 1000);
  const result = await db.collection('salesforce_leaderboard_sync').findOneAndUpdate(
    {
      status: { $in: ['pending', 'failed'] },
      nextAttemptAt: { $lte: now },
      $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }]
    },
    {
      $set: {
        status: 'processing',
        leaseUntil,
        updatedAt: now
      }
    },
    {
      sort: { createdAt: 1, updatedAt: 1 },
      returnDocument: 'after',
      returnOriginal: false
    }
  );
  return result && (result.value || result);
}

async function processLeaderboardSync(db, options = {}) {
  if (running) return { processed: 0, skipped: true };
  running = true;
  const limit = options.limit || 25;
  let processed = 0;
  let failed = 0;
  try {
    while (processed < limit) {
      const now = new Date();
      const job = await claimJob(db, now);
      if (!job) break;
      try {
        const record = await syncJob(job);
        await db.collection('salesforce_leaderboard_sync').updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'synced',
              salesforceId: record.Id,
              syncedAt: new Date(),
              updatedAt: new Date()
            },
            $unset: { error: '', leaseUntil: '' }
          }
        );
      } catch (error) {
        failed += 1;
        const attempts = (job.attempts || 0) + 1;
        await db.collection('salesforce_leaderboard_sync').updateOne(
          { _id: job._id },
          {
            $set: {
              status: 'failed',
              attempts,
              error: error.message,
              nextAttemptAt: nextAttempt(attempts, new Date()),
              updatedAt: new Date()
            },
            $unset: { leaseUntil: '' }
          }
        );
      }
      processed += 1;
    }
  } finally {
    running = false;
  }
  return { processed, failed };
}

async function scheduleNextLeaderboardSync(db) {
  const next = await db.collection('salesforce_leaderboard_sync').findOne(
    { status: { $in: ['pending', 'failed'] } },
    { sort: { nextAttemptAt: 1 }, projection: { nextAttemptAt: 1 } }
  );
  if (next) {
    scheduleLeaderboardSync(
      db,
      Math.max(new Date(next.nextAttemptAt).getTime() - Date.now(), 0)
    );
  }
}

function scheduleLeaderboardSync(db, delayMs = 30000) {
  if (process.env.SALESFORCE_LEADERBOARD_SYNC_ENABLED === 'false') return null;
  const runAt = Date.now() + Math.max(delayMs, 0);
  if (timer && scheduledAt <= runAt) return timer;
  if (timer) clearTimeout(timer);
  scheduledAt = runAt;
  timer = setTimeout(async () => {
    timer = undefined;
    scheduledAt = undefined;
    try {
      await processLeaderboardSync(db);
      await scheduleNextLeaderboardSync(db);
    } catch (error) {
      console.error('[salesforce:leaderboard-sync]', error.message);
      scheduleLeaderboardSync(db, 60000);
    }
  }, Math.max(delayMs, 0));
  if (timer.unref) timer.unref();
  return timer;
}

function startLeaderboardSync(db) {
  return scheduleLeaderboardSync(db, 0);
}

module.exports = {
  contactFields,
  eventFields,
  nextAttempt,
  processLeaderboardSync,
  scheduleLeaderboardSync,
  startLeaderboardSync,
  syncJob
};
