const { Donation } = require('../../models/donation');
const { publicDonation } = require('./helpers');

module.exports = async (req, res, next) => {
  const { donationId } = req.params;
  const { checkoutToken } = req.body;

  let donation;
  try {
    donation = await Donation.findOne({
      _id: donationId,
      checkoutToken
    }).select('+checkoutToken');
  } catch (error) {
    return next(error);
  }
  if (!donation) return res.status(404).json({ general: 'Donation not found' });

  if (['pending', 'approved', 'failed'].includes(donation.status)) {
    donation.status = 'cancelled';
    donation.paypalStatus = 'CANCELLED_BY_DONOR';
    await donation.save();
  }

  return res.status(200).json({ donation: publicDonation(donation) });
};
