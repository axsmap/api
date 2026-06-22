const { Donation } = require('../../models/donation');
const { calculateFinalPledgeAmount } = require('./pledge-settlement-helpers');

module.exports = async (req, res, next) => {
  if (!req.user || req.user.isAdmin !== true) {
    return res.status(403).json({ general: 'Forbidden' });
  }

  let candidates;
  try {
    candidates = await Donation.aggregate([
      {
        $match: {
          type: 'pledge',
          status: { $in: ['pledged', 'approved'] },
          pledgeClosedAt: { $exists: false }
        }
      },
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: '_event'
        }
      },
      { $unwind: '$_event' },
      {
        $match: {
          '_event.isArchived': false,
          '_event.endDate': { $lte: new Date() }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'creditedUser',
          foreignField: '_id',
          as: '_participant'
        }
      },
      { $unwind: '$_participant' },
      {
        $match: {
          '_participant.isArchived': false,
          '_participant.isBlocked': false
        }
      },
      {
        $lookup: {
          from: 'reviews',
          let: {
            pledgeEventId: '$event',
            pledgeUserId: '$creditedUser',
            pledgedAt: '$createdAt',
            mapathonEnd: '$_event.endDate'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$event', '$$pledgeEventId'] },
                    { $eq: ['$user', '$$pledgeUserId'] },
                    { $ne: ['$isBanned', true] },
                    { $gt: ['$createdAt', '$$pledgedAt'] },
                    { $lte: ['$createdAt', '$$mapathonEnd'] }
                  ]
                }
              }
            },
            { $group: { _id: '$venue' } },
            { $count: 'n' }
          ],
          as: '_eligibleLocationCount'
        }
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          eventId: '$event',
          eventName: '$_event.name',
          eventEndDate: '$_event.endDate',
          creditedUserId: '$creditedUser',
          participantFirstName: '$_participant.firstName',
          participantLastName: '$_participant.lastName',
          donorName: {
            $cond: ['$anonymous', 'Anonymous', '$donorName']
          },
          donorEmail: 1,
          anonymous: 1,
          pledgeAmountCents: 1,
          pledgeCapCents: 1,
          currency: 1,
          status: 1,
          createdAt: 1,
          eligibleLocations: {
            $ifNull: [
              { $arrayElemAt: ['$_eligibleLocationCount.n', 0] },
              0
            ]
          }
        }
      },
      { $sort: { eventEndDate: 1, createdAt: 1 } }
    ]);
  } catch (error) {
    return next(error);
  }

  const results = candidates.map(candidate => ({
    id: candidate.id,
    eventId: candidate.eventId,
    eventName: candidate.eventName,
    eventEndDate: candidate.eventEndDate,
    creditedUserId: candidate.creditedUserId,
    participantName: [
      candidate.participantFirstName,
      candidate.participantLastName
    ]
      .filter(Boolean)
      .join(' '),
    donorName: candidate.donorName,
    donorEmail: candidate.donorEmail,
    anonymous: candidate.anonymous,
    amountPerLocation: candidate.pledgeAmountCents / 100,
    maximumAmount: candidate.pledgeCapCents / 100,
    eligibleLocations: candidate.eligibleLocations,
    calculatedAmount:
      calculateFinalPledgeAmount({
        pledgeAmountCents: candidate.pledgeAmountCents,
        pledgeCapCents: candidate.pledgeCapCents,
        eligibleLocations: candidate.eligibleLocations
      }) / 100,
    currency: candidate.currency,
    status: candidate.status,
    pledgeDate: candidate.createdAt
  }));

  return res.status(200).json({ results });
};
