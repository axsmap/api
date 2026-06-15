const crypto = require('crypto');
const mongoose = require('mongoose');

const { createOrder } = require('../../helpers/paypal');
const { Donation } = require('../../models/donation');
const { Event } = require('../../models/event');
const { User } = require('../../models/user');
const { publicDonation } = require('./helpers');

function webAppUrl(req) {
  const configured = process.env.WEB_APP_URL || process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, '');

  const origin = req.headers.origin || '';
  if (
    /^https:\/\//.test(origin) ||
    /^http:\/\/localhost(?::\d+)?$/.test(origin)
  ) {
    return origin;
  }
  return 'http://localhost:3000';
}

module.exports = async (req, res, next) => {
  const {
    eventId,
    creditedUserId,
    amount,
    donorName,
    anonymous,
    showAmountPublicly
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({ eventId: 'Invalid event' });
  }
  if (!mongoose.Types.ObjectId.isValid(creditedUserId)) {
    return res.status(400).json({ creditedUserId: 'Invalid participant' });
  }

  const numericAmount = Number(amount);
  const amountCents = Math.round(numericAmount * 100);
  if (
    !Number.isFinite(numericAmount) ||
    amountCents < 100 ||
    amountCents > 100000000
  ) {
    return res
      .status(400)
      .json({ amount: 'Should be between $1 and $1,000,000' });
  }
  if (Math.abs(numericAmount * 100 - amountCents) > 0.001) {
    return res
      .status(400)
      .json({ amount: 'Should have at most two decimal places' });
  }
  if (typeof anonymous !== 'boolean') {
    return res.status(400).json({ anonymous: 'Should be a boolean' });
  }
  if (typeof showAmountPublicly !== 'boolean') {
    return res.status(400).json({ showAmountPublicly: 'Should be a boolean' });
  }

  const cleanDonorName = typeof donorName === 'string' ? donorName.trim() : '';
  if (!anonymous && !cleanDonorName) {
    return res.status(400).json({ donorName: 'Is required' });
  }
  if (cleanDonorName.length > 80) {
    return res
      .status(400)
      .json({ donorName: 'Should be less than 81 characters' });
  }

  let event;
  let participant;
  try {
    [event, participant] = await Promise.all([
      Event.findOne({ _id: eventId, isArchived: false }),
      User.findOne({
        _id: creditedUserId,
        isArchived: false,
        isBlocked: false
      }).select('firstName lastName username events')
    ]);
  } catch (error) {
    return next(error);
  }

  if (!event) return res.status(404).json({ eventId: 'Event not found' });
  if (!participant) {
    return res.status(404).json({ creditedUserId: 'Participant not found' });
  }
  if (new Date(event.endDate).getTime() < Date.now()) {
    return res.status(400).json({ eventId: 'Event has already ended' });
  }

  const belongsToEvent =
    event.participants.some(id => id.toString() === creditedUserId) ||
    event.managers.some(id => id.toString() === creditedUserId);
  if (!belongsToEvent) {
    return res.status(400).json({
      creditedUserId: 'Participant is not associated with this event'
    });
  }

  const checkoutToken = crypto.randomBytes(32).toString('hex');
  let donation;
  try {
    donation = await Donation.create({
      event: eventId,
      creditedUser: creditedUserId,
      amountCents,
      donorName: anonymous ? '' : cleanDonorName,
      anonymous,
      showAmountPublicly,
      checkoutToken
    });
  } catch (error) {
    return next(error);
  }

  const baseUrl = webAppUrl(req);
  const returnUrl = `${baseUrl}/donations/paypal/complete?donationId=${
    donation.id
  }`;
  const cancelUrl =
    `${baseUrl}/donations/paypal/cancel?donationId=${donation.id}` +
    `&checkoutToken=${checkoutToken}`;

  try {
    const order = await createOrder({
      donation,
      event,
      participant,
      returnUrl,
      cancelUrl
    });
    const approvalLink = (order.links || []).find(
      link => link.rel === 'payer-action'
    );
    const fallbackApprovalLink = (order.links || []).find(
      link => link.rel === 'approve'
    );
    const approvalUrl =
      (approvalLink && approvalLink.href) ||
      (fallbackApprovalLink && fallbackApprovalLink.href);

    if (!approvalUrl) throw new Error('PayPal approval URL was not returned');

    donation.paypalOrderId = order.id;
    donation.paypalStatus = order.status || 'CREATED';
    await donation.save();

    return res.status(201).json({
      donation: publicDonation(donation),
      approvalUrl
    });
  } catch (error) {
    donation.status = 'failed';
    donation.paypalStatus = 'CREATE_FAILED';
    await donation.save().catch(() => {});
    return next(error);
  }
};
