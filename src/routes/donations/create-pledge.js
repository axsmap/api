const mongoose = require('mongoose');

const { Donation } = require('../../models/donation');
const { Event } = require('../../models/event');
const { User } = require('../../models/user');
const { publicDonation } = require('./helpers');

function centsFromAmount(value) {
  const numericAmount = Number(value);
  const amountCents = Math.round(numericAmount * 100);
  if (
    !Number.isFinite(numericAmount) ||
    amountCents < 100 ||
    amountCents > 100000000
  ) {
    return { error: 'Should be between $1 and $1,000,000' };
  }
  if (Math.abs(numericAmount * 100 - amountCents) > 0.001) {
    return { error: 'Should have at most two decimal places' };
  }
  return { amountCents };
}

module.exports = async (req, res, next) => {
  const {
    eventId,
    creditedUserId,
    amount,
    maximumCap,
    donorName,
    donorEmail,
    anonymous,
    showPledgePublicly,
    showAmountPublicly
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).json({ eventId: 'Invalid event' });
  }
  if (!mongoose.Types.ObjectId.isValid(creditedUserId)) {
    return res.status(400).json({ creditedUserId: 'Invalid participant' });
  }

  const amountResult = centsFromAmount(amount);
  if (amountResult.error) return res.status(400).json({ amount: amountResult.error });

  const capResult = centsFromAmount(maximumCap);
  if (capResult.error) {
    return res.status(400).json({ maximumCap: capResult.error });
  }
  if (capResult.amountCents < amountResult.amountCents) {
    return res
      .status(400)
      .json({ maximumCap: 'Should be at least one location pledge' });
  }

  if (typeof anonymous !== 'boolean') {
    return res.status(400).json({ anonymous: 'Should be a boolean' });
  }
  if (typeof showAmountPublicly !== 'boolean') {
    return res.status(400).json({ showAmountPublicly: 'Should be a boolean' });
  }
  if (typeof showPledgePublicly !== 'boolean') {
    return res.status(400).json({ showPledgePublicly: 'Should be a boolean' });
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
  const cleanDonorEmail =
    typeof donorEmail === 'string' ? donorEmail.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanDonorEmail)) {
    return res.status(400).json({ donorEmail: 'Should be a valid email' });
  }
  if (cleanDonorEmail.length > 254) {
    return res
      .status(400)
      .json({ donorEmail: 'Should be less than 255 characters' });
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
      }).select('_id')
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

  try {
    const pledge = await Donation.create({
      event: eventId,
      creditedUser: creditedUserId,
      type: 'pledge',
      amountCents: capResult.amountCents,
      pledgeAmountCents: amountResult.amountCents,
      pledgeCapCents: capResult.amountCents,
      donorName: anonymous ? '' : cleanDonorName,
      donorEmail: cleanDonorEmail,
      anonymous,
      showAmountPublicly,
      showPledgePublicly,
      status: 'pledged'
    });

    return res.status(201).json({ pledge: publicDonation(pledge) });
  } catch (error) {
    return next(error);
  }
};
