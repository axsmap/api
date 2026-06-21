const mongoose = require('mongoose');

const { Donation } = require('../../models/donation');

module.exports = async (req, res, next) => {
  const { userId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ userId: 'Invalid user' });
  }
  if (req.user.id !== userId && !req.user.isAdmin) {
    return res.status(403).json({ general: 'Forbidden action' });
  }

  let pledges;
  try {
    pledges = await Donation.aggregate([
      {
        $match: {
          creditedUser: mongoose.Types.ObjectId(userId),
          type: 'pledge',
          status: {
            $in: [
              'pledged',
              'approved',
              'calculated',
              'payment_requested',
              'paid'
            ]
          }
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'reviews',
          let: {
            pledgeEventId: '$event',
            pledgeUserId: '$creditedUser',
            pledgedAt: '$createdAt'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$event', '$$pledgeEventId'] },
                    { $eq: ['$user', '$$pledgeUserId'] },
                    { $ne: ['$isBanned', true] },
                    { $gt: ['$createdAt', '$$pledgedAt'] }
                  ]
                }
              }
            },
            { $group: { _id: '$venue' } },
            { $count: 'n' }
          ],
          as: '_postPledgeReviewCount'
        }
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          eventId: '$event',
          name: { $cond: ['$anonymous', 'Anonymous', '$donorName'] },
          pledgeAmount: { $divide: ['$pledgeAmountCents', 100] },
          pledgeCap: { $divide: ['$pledgeCapCents', 100] },
          status: 1,
          anonymous: 1,
          showAmountPublicly: { $literal: true },
          showPledgePublicly: { $literal: true },
          mappedCount: {
            $cond: [
              {
                $ne: [{ $ifNull: ['$pledgeClosedAt', null] }, null]
              },
              '$pledgeEligibleLocations',
              {
                $ifNull: [{ $arrayElemAt: ['$_postPledgeReviewCount.n', 0] }, 0]
              }
            ]
          },
          finalAmount: {
            $cond: [
              {
                $ne: [{ $ifNull: ['$pledgeClosedAt', null] }, null]
              },
              { $divide: ['$pledgeFinalAmountCents', 100] },
              null
            ]
          },
          closedAt: '$pledgeClosedAt',
          createdAt: 1
        }
      }
    ]);
  } catch (error) {
    return next(error);
  }

  return res.status(200).json({ pledges });
};
