const moment = require('moment')
const { pick } = require('lodash')

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

    logger.error(`Review ${reviewID} failed to be found at flag-review`)
    return next(err)
  }

  if (!review) {
    return res.status(404).json({ message: 'Review not found' })
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

  return res.status(200).json({ message: 'Success' })
}