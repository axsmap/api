const moment = require('moment')
const { pick } = require('lodash')

const logger = require('../../helpers/logger')
const { Review } = require('../../models/review')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  const reviewId = req.params.reviewId

  let review
  try {
    review = await Review.findOne({ _id: reviewId })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Review not found' })
    }

    logger.error(`Review ${reviewId} failed to be found at flag-review`)
    return next(err)
  }

  if (!review) {
    return res.status(404).json({ general: 'Review not found' })
  }

  const data = pick(req.body, ['comments', 'type'])

  review.complaints = [
    ...review.complaints,
    {
      comments: data.comments,
      type: data.type,
      user: req.user.id
    }
  ]

  review.updatedAt = moment.utc().toDate()

  try {
    await review.save()
  } catch (err) {
    logger.error(`Review ${review.id} failed to be updated at flag-review`)
    return next(err)
  }

  return res.status(200).json({ general: 'Success' })
}
