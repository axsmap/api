const { Event } = require('../../models/event');
const { User } = require('../../models/user');
const { syncConfirmedFlatDonation } = require('./salesforce-opportunity');

function safeErrorMessage(error) {
  const salesforceError =
    error.response &&
    error.response.data &&
    JSON.stringify(error.response.data);
  return String(salesforceError || error.message || error).slice(0, 2000);
}

async function syncFlatDonationToSalesforce(donation) {
  if (donation.type !== 'flat' || donation.status !== 'confirmed') {
    return { skipped: true };
  }
  if (donation.salesforceSync.status === 'synced') {
    return {
      skipped: true,
      salesforceRecordId: donation.salesforceSync.recordId
    };
  }

  donation.salesforceSync.attempts =
    (donation.salesforceSync.attempts || 0) + 1;
  donation.salesforceSync.lastAttemptAt = new Date();

  try {
    const [event, participant] = await Promise.all([
      Event.findOne({ _id: donation.event, isArchived: false }),
      User.findOne({
        _id: donation.creditedUser,
        isArchived: false,
        isBlocked: false
      }).select('firstName lastName email')
    ]);

    if (!event) {
      const error = new Error('Mapathon not found for Salesforce sync');
      error.code = 'MAPATHON_NOT_FOUND';
      throw error;
    }
    if (!participant) {
      const error = new Error('Participant not found for Salesforce sync');
      error.code = 'PARTICIPANT_NOT_FOUND';
      throw error;
    }

    const record = await syncConfirmedFlatDonation({
      donation,
      event,
      participant
    });
    donation.salesforceSync.status = 'synced';
    donation.salesforceSync.recordId = record.Id;
    donation.salesforceSync.syncedAt = new Date();
    donation.salesforceSync.lastError = '';
    await donation.save();
    return { salesforceRecordId: record.Id };
  } catch (error) {
    donation.salesforceSync.status = 'failed';
    donation.salesforceSync.lastError = safeErrorMessage(error);
    await donation.save();
    return {
      error,
      failed: true
    };
  }
}

module.exports = {
  safeErrorMessage,
  syncFlatDonationToSalesforce
};
