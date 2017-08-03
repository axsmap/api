const moment = require('moment')

const logger = require('../../helpers/logger')
const Review = require('../../models/review')

module.exports = async (req, res, next) => {
  const reviewID = req.params.reviewID

  let review
  try {
    review = await Review.findOne({ _id: reviewID })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Review not found' })
    }

    logger.error(`Review ${reviewID} failed to be found at vote-review`)
    return next(err)
  }

  if (!review) {
    return res.status(404).json({ message: 'Review not found' })
  }

  let addVote = true

  if (review.voters.find(v => v.toString() === req.user.id)) {
    review.voters = review.voters.filter(v => v.toString() !== req.user.id)
    addVote = false
  } else {
    review.voters = [...review.voters, req.user.id]
  }

  review.updatedAt = moment.utc().toDate()

  try {
    await review.save()
  } catch (err) {
    logger.error(`Review ${review.id} failed to be updated at vote-review`)
    return next(err)
  }

  return res
    .status(200)
    .json({ message: addVote ? 'One more vote' : 'One less vote' })
}
