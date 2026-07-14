const { captureOrder } = require('../../helpers/paypal');
const { Donation } = require('../../models/donation');
const { captureFromOrder, payerEmail, publicDonation } = require('./helpers');
const { syncDonationOpportunitySafely } = require('./salesforce-opportunity');

module.exports = async (req, res, next) => {
  const { orderId } = req.body;
  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ orderId: 'Is required' });
  }

  let donation;
  try {
    donation = await Donation.findOne({ paypalOrderId: orderId });
  } catch (error) {
    return next(error);
  }
  if (!donation) return res.status(404).json({ general: 'Donation not found' });

  if (donation.status === 'confirmed') {
    if (!donation.salesforceOpportunityId) {
      await syncDonationOpportunitySafely(donation);
    }
    return res.status(200).json({ donation: publicDonation(donation) });
  }
  if (['cancelled', 'refunded', 'reversed'].includes(donation.status)) {
    return res.status(409).json({ general: 'Donation cannot be captured' });
  }

  try {
    const order = await captureOrder(orderId, donation.id);
    const capture = captureFromOrder(order);
    const captureStatus = capture && capture.status;

    donation.paypalStatus = captureStatus || order.status || '';
    donation.paypalPayerEmail = payerEmail(order);
    if (capture && capture.id) donation.paypalCaptureId = capture.id;

    if (captureStatus === 'COMPLETED') {
      donation.status = 'confirmed';
      donation.confirmedAt = new Date();
    } else if (captureStatus === 'PENDING') {
      donation.status = 'approved';
    } else {
      donation.status = 'failed';
    }

    await donation.save();
    if (donation.status === 'confirmed') {
      await syncDonationOpportunitySafely(donation);
    }
    return res.status(200).json({ donation: publicDonation(donation) });
  } catch (error) {
    const paypalStatus =
      error.response && error.response.data && error.response.data.name;
    if (paypalStatus === 'UNPROCESSABLE_ENTITY') {
      donation.paypalStatus = paypalStatus;
      await donation.save().catch(() => {});
    }
    return next(error);
  }
};
