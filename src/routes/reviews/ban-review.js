const moment = require('moment');

const { Review } = require('../../models/review');

module.exports = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ general: 'Forbidden action' });
  }

  const reviewId = req.params.reviewId;

  let review;
  try {
    review = await Review.findOne({ _id: reviewId });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Review not found' });
    }

    console.log(`Review ${reviewId} failed to be found at ban-review`);
    return next(err);
  }

  if (!review) {
    return res.status(404).json({ general: 'Review not found' });
  }

  review.isBanned = true;
  review.updatedAt = moment.utc().toDate();

  try {
    await review.save();
  } catch (err) {
    console.log(`Review ${review.id} failed to be updated at ban-review`);
    return next(err);
  }

  return res.status(200).json({ general: 'Success' });
};
