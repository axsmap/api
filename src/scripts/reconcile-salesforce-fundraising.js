const mongoose = require('mongoose');

require('dotenv').config();

const { Donation } = require('../models/donation');
const { Event } = require('../models/event');
const { Review } = require('../models/review');
const { User } = require('../models/user');
const { syncDonationOpportunitySafely } = require('../routes/donations/salesforce-opportunity');
const { syncCalculatedPledge } = require('../routes/donations/salesforce-pledge');
const { syncMapathonCampaign } = require('../routes/events/salesforce-campaign');
const {
  calculateFinalPledgeAmount
} = require('../routes/donations/pledge-settlement-helpers');

function hasArgument(name) {
  return process.argv.includes(name);
}

function activePledgeQuery() {
  return {
    type: 'pledge',
    status: { $in: ['pledged', 'approved', 'calculated'] },
    'salesforceSync.status': { $ne: 'synced' }
  };
}

function isEnded(event, now = new Date()) {
  return Boolean(event && new Date(event.endDate).getTime() <= now.getTime());
}

function safeError(error) {
  const details = error.response && error.response.data;
  return String(details ? JSON.stringify(details) : error.message || error).slice(
    0,
    2000
  );
}

async function calculatePledge(pledge, event) {
  if (pledge.pledgeClosedAt && pledge.status === 'calculated') return pledge;

  const eligibleLocations = await Review.distinct('venue', {
    event: pledge.event,
    user: pledge.creditedUser,
    isBanned: { $ne: true },
    createdAt: {
      $gt: pledge.createdAt,
      $lte: new Date(event.endDate)
    }
  });
  const calculatedAt = new Date();
  pledge.pledgeEligibleLocations = eligibleLocations.length;
  pledge.pledgeFinalAmountCents = calculateFinalPledgeAmount({
    pledgeAmountCents: pledge.pledgeAmountCents,
    pledgeCapCents: pledge.pledgeCapCents,
    eligibleLocations: eligibleLocations.length
  });
  pledge.pledgeCalculatedAt = calculatedAt;
  pledge.pledgeClosedAt = calculatedAt;
  pledge.status = 'calculated';
  pledge.salesforceSync = {
    status: 'pending',
    recordId: '',
    attempts: 0,
    lastError: ''
  };
  await pledge.save();
  return pledge;
}

async function reconcileFlatDonation(donation) {
  const record = await syncDonationOpportunitySafely(donation);
  return {
    id: donation.id,
    success: Boolean(record && donation.salesforceOpportunityId),
    salesforceId: donation.salesforceOpportunityId || '',
    error: donation.salesforceSyncError || ''
  };
}

async function reconcilePledge(pledge, event, participant) {
  await calculatePledge(pledge, event);
  pledge.salesforceSync.attempts = (pledge.salesforceSync.attempts || 0) + 1;
  pledge.salesforceSync.lastAttemptAt = new Date();
  try {
    await syncMapathonCampaign(event);
    const record = await syncCalculatedPledge({ pledge, event, participant });
    pledge.salesforceSync.status = 'synced';
    pledge.salesforceSync.recordId = record.Id;
    pledge.salesforceSync.syncedAt = new Date();
    pledge.salesforceSync.lastError = '';
    await pledge.save();
    return { id: pledge.id, success: true, salesforceId: record.Id };
  } catch (error) {
    pledge.salesforceSync.status = 'failed';
    pledge.salesforceSync.lastError = safeError(error);
    await pledge.save();
    return { id: pledge.id, success: false, error: pledge.salesforceSync.lastError };
  }
}

async function loadCandidates(now = new Date()) {
  const [flatDonations, pledges] = await Promise.all([
    Donation.find({
      type: 'flat',
      status: 'confirmed',
      $or: [
        { salesforceOpportunityId: { $exists: false } },
        { salesforceOpportunityId: '' },
        { salesforceSyncError: { $nin: ['', null] } }
      ]
    }).sort({ confirmedAt: 1, createdAt: 1 }),
    Donation.find(activePledgeQuery()).sort({ createdAt: 1 })
  ]);

  const eventIds = [
    ...new Set(pledges.map(pledge => String(pledge.event)).filter(Boolean))
  ];
  const events = await Event.find({ _id: { $in: eventIds }, isArchived: false });
  const eventById = new Map(events.map(event => [String(event.id), event]));
  const endedPledges = pledges.filter(pledge =>
    isEnded(eventById.get(String(pledge.event)), now)
  );
  return { flatDonations, endedPledges, eventById };
}

async function main() {
  const apply = hasArgument('--apply');
  if (apply && !hasArgument('--confirm-production')) {
    throw new Error(
      'Production writes require both --apply and --confirm-production'
    );
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    connectTimeoutMS: 30000,
    useCreateIndex: true,
    useNewUrlParser: true
  });

  const { flatDonations, endedPledges, eventById } = await loadCandidates();
  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    candidates: {
      confirmedFlatDonations: flatDonations.length,
      endedPledges: endedPledges.length
    },
    flatDonations: [],
    pledges: []
  };

  if (apply) {
    for (const donation of flatDonations) {
      report.flatDonations.push(await reconcileFlatDonation(donation));
    }
    for (const pledge of endedPledges) {
      const [event, participant] = await Promise.all([
        Promise.resolve(eventById.get(String(pledge.event))),
        User.findOne({
          _id: pledge.creditedUser,
          isArchived: false,
          isBlocked: false
        }).select('firstName lastName email salesforceContactId')
      ]);
      if (!event || !participant) {
        report.pledges.push({
          id: pledge.id,
          success: false,
          error: !event ? 'Mapathon not found' : 'Participant not found'
        });
        continue;
      }
      report.pledges.push(await reconcilePledge(pledge, event, participant));
    }
  }

  report.summary = {
    flatSucceeded: report.flatDonations.filter(item => item.success).length,
    flatFailed: report.flatDonations.filter(item => !item.success).length,
    pledgesSucceeded: report.pledges.filter(item => item.success).length,
    pledgesFailed: report.pledges.filter(item => !item.success).length
  };
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  if (
    apply &&
    (report.summary.flatFailed > 0 || report.summary.pledgesFailed > 0)
  ) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch(async error => {
    console.error(error.stack || error.message);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exitCode = 1;
  });
}

module.exports = {
  activePledgeQuery,
  calculatePledge,
  isEnded,
  loadCandidates,
  reconcileFlatDonation,
  reconcilePledge,
  safeError
};
