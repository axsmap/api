const mongoose = require('mongoose');

const { Donation } = require('../../models/donation');
const { Event } = require('../../models/event');
const { User } = require('../../models/user');
const { syncCalculatedPledge } = require('./salesforce-pledge');

function safeErrorMessage(error) {
  const salesforceError =
    error.response &&
    error.response.data &&
    JSON.stringify(error.response.data);
  return String(salesforceError || error.message || error).slice(0, 2000);
}

module.exports = async (req, res, next) => {
  if (!req.user || req.user.isAdmin !== true) {
    return res.status(403).json({ general: 'Forbidden' });
  }

  const { donationId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(donationId)) {
    return res.status(400).json({ donationId: 'Invalid pledge' });
  }

  let pledge;
  let event;
  let participant;
  try {
    pledge = await Donation.findOne({ _id: donationId, type: 'pledge' });
    if (!pledge) {
      return res.status(404).json({ donationId: 'Pledge not found' });
    }
    if (!pledge.pledgeClosedAt || pledge.status !== 'calculated') {
      return res.status(409).json({
        status: 'Pledge must be calculated and closed before Salesforce sync'
      });
    }

    [event, participant] = await Promise.all([
      Event.findOne({ _id: pledge.event, isArchived: false }),
      User.findOne({
        _id: pledge.creditedUser,
        isArchived: false,
        isBlocked: false
      }).select('firstName lastName email')
    ]);
  } catch (error) {
    return next(error);
  }

  if (!event) return res.status(404).json({ eventId: 'Mapathon not found' });
  if (!participant) {
    return res.status(404).json({ creditedUserId: 'Participant not found' });
  }

  pledge.salesforceSync.attempts =
    (pledge.salesforceSync.attempts || 0) + 1;
  pledge.salesforceSync.lastAttemptAt = new Date();

  try {
    const record = await syncCalculatedPledge({
      pledge,
      event,
      participant
    });
    pledge.salesforceSync.status = 'synced';
    pledge.salesforceSync.recordId = record.Id;
    pledge.salesforceSync.syncedAt = new Date();
    pledge.salesforceSync.lastError = '';
    await pledge.save();

    return res.status(200).json({
      pledgeId: pledge.id,
      salesforceRecordId: record.Id,
      salesforceSync: pledge.salesforceSync
    });
  } catch (error) {
    pledge.salesforceSync.status = 'failed';
    pledge.salesforceSync.lastError = safeErrorMessage(error);
    try {
      await pledge.save();
    } catch (saveError) {
      return next(saveError);
    }
    return res.status(502).json({
      general: 'Salesforce pledge sync failed',
      code: error.code || 'SALESFORCE_SYNC_FAILED',
      salesforceSync: pledge.salesforceSync
    });
  }
};
