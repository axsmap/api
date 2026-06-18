const mongoose = require('mongoose');

const { Donation } = require('../../models/donation');

function publicPledge(pledge) {
  return {
    id: pledge.id,
    eventId: pledge.event,
    name: pledge.anonymous ? 'Anonymous' : pledge.donorName,
    pledgeAmount: pledge.pledgeAmountCents / 100,
    pledgeCap: pledge.pledgeCapCents / 100,
    status: pledge.status,
    anonymous: pledge.anonymous,
    showAmountPublicly: pledge.showAmountPublicly,
    showPledgePublicly: pledge.showPledgePublicly,
    createdAt: pledge.createdAt
  };
}

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
    pledges = await Donation.find({
      creditedUser: userId,
      type: 'pledge',
      status: { $in: ['pledged', 'approved'] }
    }).sort({ createdAt: -1 });
  } catch (error) {
    return next(error);
  }

  return res.status(200).json({ pledges: pledges.map(publicPledge) });
};
