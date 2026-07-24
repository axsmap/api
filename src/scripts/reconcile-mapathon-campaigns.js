const mongoose = require('mongoose');

require('dotenv').config();

const { Event } = require('../models/event');
const { Donation } = require('../models/donation');
const {
  syncMapathonCampaign
} = require('../routes/events/salesforce-campaign');
const salesforce = require('../helpers/salesforce');

function hasArgument(name) {
  return process.argv.includes(name);
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
  try {
    const fundraisingEventIds = await Donation.distinct('event', {
      status: { $in: ['confirmed', 'pledged', 'approved', 'calculated'] }
    });
    const events = await Event.find({
      $or: [
        { donationEnabled: true },
        { _id: { $in: fundraisingEventIds.filter(Boolean) } }
      ]
    }).sort({
      startDate: 1
    });
    const externalIdField =
      process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD;
    const mappedCampaigns = await salesforce.queryAll(
      `SELECT Id, ${externalIdField} FROM Campaign WHERE ` +
        `${externalIdField} != null`
    );
    const eventIds = new Set(events.map(event => event.id));
    const generalId =
      process.env.SALESFORCE_GENERAL_DONATION_CAMPAIGN_EXTERNAL_ID;
    const orphanedCampaigns = mappedCampaigns.filter(
      campaign =>
        campaign[externalIdField] !== generalId &&
        !eventIds.has(String(campaign[externalIdField]))
    );
    const results = [];
    if (apply) {
      for (const event of events) {
        try {
          const record = await syncMapathonCampaign(event);
          results.push({
            eventId: event.id,
            success: true,
            salesforceId: record.Id
          });
        } catch (error) {
          results.push({
            eventId: event.id,
            success: false,
            error: error.message
          });
        }
      }
      for (const campaign of orphanedCampaigns) {
        try {
          await salesforce.updateRecord({
            objectName: 'Campaign',
            recordId: campaign.Id,
            fields: { IsActive: false }
          });
          results.push({
            eventId: campaign[externalIdField],
            success: true,
            salesforceId: campaign.Id,
            orphanDeactivated: true
          });
        } catch (error) {
          results.push({
            eventId: campaign[externalIdField],
            success: false,
            error: error.message
          });
        }
      }
    }
    const report = {
      mode: apply ? 'apply' : 'dry-run',
      candidates: events.length,
      active: events.filter(
        event =>
          !event.isArchived && new Date(event.endDate).getTime() >= Date.now()
      ).length,
      endedOrArchived: events.filter(
        event =>
          event.isArchived || new Date(event.endDate).getTime() < Date.now()
      ).length,
      orphanedCampaigns: orphanedCampaigns.length,
      succeeded: results.filter(result => result.success).length,
      failed: results.filter(result => !result.success).length,
      failures: results.filter(result => !result.success)
    };
    console.log(JSON.stringify(report, null, 2));
    if (apply && report.failed) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(async error => {
    console.error(error.stack || error.message);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exitCode = 1;
  });
}
