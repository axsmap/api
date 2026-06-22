const mongoose = require('mongoose');

const { Donation } = require('../../models/donation');
const {
  syncFlatDonationToSalesforce
} = require('./sync-flat-donation-salesforce');

module.exports = async (req, res, next) => {
  if (!req.user || req.user.isAdmin !== true) {
    return res.status(403).json({ general: 'Forbidden' });
  }

  const { donationId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(donationId)) {
    return res.status(400).json({ donationId: 'Invalid donation' });
  }

  let donation;
  try {
    donation = await Donation.findOne({
      _id: donationId,
      type: 'flat'
    });
  } catch (error) {
    return next(error);
  }
  if (!donation) {
    return res.status(404).json({ donationId: 'Donation not found' });
  }
  if (donation.status !== 'confirmed') {
    return res.status(409).json({
      status: 'Donation must be confirmed before Salesforce sync'
    });
  }

  const result = await syncFlatDonationToSalesforce(donation);
  if (result.failed) {
    return res.status(502).json({
      general: 'Salesforce Opportunity sync failed',
      code: result.error.code || 'SALESFORCE_SYNC_FAILED',
      salesforceSync: donation.salesforceSync
    });
  }

  return res.status(200).json({
    donationId: donation.id,
    salesforceRecordId:
      result.salesforceRecordId || donation.salesforceSync.recordId,
    salesforceSync: donation.salesforceSync
  });
};
