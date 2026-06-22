const mongoose = require('mongoose');

const { Donation } = require('../../models/donation');
const { Event } = require('../../models/event');
const { Review } = require('../../models/review');
const { User } = require('../../models/user');
const {
  buildSalesforcePledgePayload,
  calculateFinalPledgeAmount
} = require('./pledge-settlement-helpers');

function settlementResponse(pledge, event, participant) {
  return {
    pledge: {
      id: pledge.id,
      status: pledge.status,
      eligibleLocations: pledge.pledgeEligibleLocations,
      finalAmount: pledge.pledgeFinalAmountCents / 100,
      calculatedAt: pledge.pledgeCalculatedAt,
      closedAt: pledge.pledgeClosedAt,
      salesforceSync: pledge.salesforceSync
    },
    salesforcePayload: buildSalesforcePledgePayload({
      pledge,
      event,
      participant
    })
  };
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

    [event, participant] = await Promise.all([
      Event.findOne({ _id: pledge.event, isArchived: false }),
      User.findOne({
        _id: pledge.creditedUser,
        isArchived: false,
        isBlocked: false
      }).select('firstName lastName')
    ]);
  } catch (error) {
    return next(error);
  }

  if (!event) return res.status(404).json({ eventId: 'Mapathon not found' });
  if (!participant) {
    return res.status(404).json({ creditedUserId: 'Participant not found' });
  }

  const mapathonEnd = new Date(event.endDate);
  if (mapathonEnd.getTime() > Date.now()) {
    return res.status(400).json({ eventId: 'Mapathon has not ended' });
  }

  if (pledge.pledgeClosedAt) {
    return res.status(200).json(settlementResponse(pledge, event, participant));
  }
  if (!['pledged', 'approved'].includes(pledge.status)) {
    return res.status(409).json({
      status: 'Only active pledges can be closed'
    });
  }

  let eligibleLocations;
  try {
    eligibleLocations = await Review.distinct('venue', {
      event: pledge.event,
      user: pledge.creditedUser,
      isBanned: { $ne: true },
      createdAt: {
        $gt: pledge.createdAt,
        $lte: mapathonEnd
      }
    });
  } catch (error) {
    return next(error);
  }

  const calculatedAt = new Date();
  const finalAmountCents = calculateFinalPledgeAmount({
    pledgeAmountCents: pledge.pledgeAmountCents,
    pledgeCapCents: pledge.pledgeCapCents,
    eligibleLocations: eligibleLocations.length
  });

  pledge.pledgeEligibleLocations = eligibleLocations.length;
  pledge.pledgeFinalAmountCents = finalAmountCents;
  pledge.pledgeCalculatedAt = calculatedAt;
  pledge.pledgeClosedAt = calculatedAt;
  pledge.pledgeClosedBy = req.user.id;
  pledge.status = 'calculated';
  pledge.salesforceSync = {
    status: 'pending',
    recordId: '',
    attempts: 0,
    lastError: ''
  };

  try {
    await pledge.save();
  } catch (error) {
    return next(error);
  }

  return res.status(200).json(settlementResponse(pledge, event, participant));
};
