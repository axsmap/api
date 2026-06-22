const mongoose = require('mongoose');

const { Donation } = require('../../models/donation');
const { verifySalesforceWebhook } = require('./salesforce-webhook-auth');
const {
  SUPPORTED_STATUSES,
  applySalesforcePaymentUpdate,
  validDate
} = require('./salesforce-payment-helpers');

module.exports = async (req, res, next) => {
  let verified;
  try {
    verified = verifySalesforceWebhook({
      body: req.body,
      headers: req.headers
    });
  } catch (error) {
    return next(error);
  }
  if (!verified) {
    return res.status(401).json({ general: 'Invalid Salesforce signature' });
  }

  const {
    axsMapPledgeId,
    status,
    opportunityId,
    paypalTransactionId,
    paymentDate,
    receiptSent
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(axsMapPledgeId)) {
    return res.status(400).json({ axsMapPledgeId: 'Invalid pledge' });
  }
  const mongoStatus = SUPPORTED_STATUSES[status];
  if (!mongoStatus) {
    return res.status(400).json({ status: 'Unsupported pledge status' });
  }
  const parsedPaymentDate = paymentDate ? validDate(paymentDate) : null;
  if (paymentDate && !parsedPaymentDate) {
    return res.status(400).json({ paymentDate: 'Invalid payment date' });
  }
  if (typeof receiptSent !== 'boolean') {
    return res.status(400).json({ receiptSent: 'Should be a boolean' });
  }
  if (!opportunityId || typeof opportunityId !== 'string') {
    return res.status(400).json({ opportunityId: 'Is required' });
  }
  if (
    status === 'Paid' &&
    (!paypalTransactionId || typeof paypalTransactionId !== 'string')
  ) {
    return res.status(400).json({
      paypalTransactionId: 'Is required when a pledge is paid'
    });
  }
  if (status === 'Paid' && !parsedPaymentDate) {
    return res.status(400).json({
      paymentDate: 'Is required when a pledge is paid'
    });
  }

  let pledge;
  try {
    pledge = await Donation.findOne({
      _id: axsMapPledgeId,
      type: 'pledge'
    });
  } catch (error) {
    return next(error);
  }
  if (!pledge) {
    return res.status(404).json({ axsMapPledgeId: 'Pledge not found' });
  }
  if (!pledge.pledgeClosedAt) {
    return res.status(409).json({
      status: 'Pledge must be closed before payment updates'
    });
  }

  applySalesforcePaymentUpdate({
    pledge,
    status,
    opportunityId,
    paypalTransactionId,
    paymentDate: parsedPaymentDate,
    receiptSent
  });

  try {
    await pledge.save();
  } catch (error) {
    return next(error);
  }

  return res.status(200).json({
    received: true,
    pledgeId: pledge.id,
    status: pledge.status
  });
};
