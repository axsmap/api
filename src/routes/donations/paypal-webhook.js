const { verifyWebhook } = require('../../helpers/paypal');
const { Donation } = require('../../models/donation');
const {
  syncFlatDonationToSalesforce
} = require('./sync-flat-donation-salesforce');

function relatedIds(resource) {
  return (
    (resource &&
      resource.supplementary_data &&
      resource.supplementary_data.related_ids) ||
    {}
  );
}

async function findDonation(event) {
  const resource = event.resource || {};
  const related = relatedIds(resource);
  const orderId = related.order_id;
  const captureId =
    event.event_type.indexOf('PAYMENT.CAPTURE.') === 0
      ? resource.id
      : related.capture_id;

  if (captureId) {
    const byCapture = await Donation.findOne({ paypalCaptureId: captureId });
    if (byCapture) return byCapture;
  }
  if (orderId) return Donation.findOne({ paypalOrderId: orderId });
  return null;
}

module.exports = async (req, res, next) => {
  let verified;
  try {
    verified = await verifyWebhook(req.headers, req.body);
  } catch (error) {
    return next(error);
  }
  if (!verified) {
    return res
      .status(400)
      .json({ general: 'Invalid PayPal webhook signature' });
  }

  const event = req.body;
  let donation;
  try {
    donation = await findDonation(event);
  } catch (error) {
    return next(error);
  }

  // Acknowledge verified events that do not belong to this donation system.
  if (!donation) return res.status(200).json({ received: true });

  const resource = event.resource || {};
  donation.paypalStatus = resource.status || event.event_type;

  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    donation.paypalCaptureId = resource.id || donation.paypalCaptureId;
    donation.status = 'confirmed';
    donation.confirmedAt = donation.confirmedAt || new Date();
  } else if (event.event_type === 'PAYMENT.CAPTURE.PENDING') {
    if (donation.status !== 'confirmed') donation.status = 'approved';
  } else if (event.event_type === 'PAYMENT.CAPTURE.DECLINED') {
    if (donation.status !== 'confirmed') donation.status = 'failed';
  } else if (event.event_type === 'PAYMENT.CAPTURE.REFUNDED') {
    donation.status = 'refunded';
    donation.refundedAt = new Date();
  } else if (event.event_type === 'PAYMENT.CAPTURE.REVERSED') {
    donation.status = 'reversed';
    donation.reversedAt = new Date();
  }

  try {
    await donation.save();
    if (
      event.event_type === 'PAYMENT.CAPTURE.COMPLETED' &&
      donation.type === 'flat'
    ) {
      await syncFlatDonationToSalesforce(donation);
    }
  } catch (error) {
    return next(error);
  }

  return res.status(200).json({ received: true });
};
