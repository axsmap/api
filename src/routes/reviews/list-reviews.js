const { toBoolean, toInt } = require('validator')

const logger = require('../../helpers/logger')
const { Review } = require('../../models/review')

const { validateListReviews } = require('./validations')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  const queryParams = req.query
  const { errors, isValid } = validateListReviews(queryParams)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  const reviewsQuery = {}

  if (queryParams.bathroomScore) {
    const limits = queryParams.bathroomScore.split(',')
    reviewsQuery.bathroomScore = { $gte: limits[0], $lte: limits[1] }
  }

  if (queryParams.entryScore) {
    const limits = queryParams.entryScore.split(',')
    reviewsQuery.entryScore = { $gte: limits[0], $lte: limits[1] }
  }

  if (queryParams.event) {
    reviewsQuery.event = queryParams.event
  }

  if (queryParams.guideDog) {
    reviewsQuery.guideDog = toBoolean(queryParams.guideDog)
  }

  if (queryParams.parking) {
    reviewsQuery.parking = toBoolean(queryParams.parking)
  }

  if (queryParams.quiet) {
    reviewsQuery.quiet = toBoolean(queryParams.quiet)
  }

  if (queryParams.ramp) {
    reviewsQuery.ramp = toBoolean(queryParams.ramp)
  }

  if (queryParams.secondEntry) {
    reviewsQuery.secondEntry = toBoolean(queryParams.secondEntry)
  }

  if (queryParams.spacious) {
    reviewsQuery.spacious = toBoolean(queryParams.spacious)
  }

  if (queryParams.steps) {
    reviewsQuery.steps = toInt(queryParams.steps)
  }

  if (queryParams.team) {
    reviewsQuery.team = queryParams.team
  }

  if (queryParams.user) {
    reviewsQuery.user = queryParams.user
  }

  if (queryParams.venue) {
    reviewsQuery.venue = queryParams.venue
  }

  if (queryParams.wellLit) {
    reviewsQuery.wellLit = toBoolean(queryParams.wellLit)
  }

  let page = queryParams.page || 1
  const pageLimit = 18

  if (page > 0) {
    page -= 1
  } else {
    return res
      .status(400)
      .json({ page: 'Should be equal to or greater than 1' })
  }

  let reviews
  let total
  try {
    ;[reviews, total] = await Promise.all([
      Review.find(reviewsQuery)
        .select('-__v -updatedAt -createdAt')
        .sort('createdAt')
        .skip(page * pageLimit)
        .limit(pageLimit),
      Review.find(reviewsQuery).count()
    ])
  } catch (err) {
    logger.error('Reviews failed to be found or count at list-reviews')
    return next(err)
  }

  let first = `${process.env.API_URL}/reviews?page=1`
  const lastPage = Math.ceil(total / pageLimit)
  let last = `${process.env.API_URL}/reviews?page=${lastPage}`

  if (lastPage > 0) {
    page += 1
    if (page > lastPage) {
      return res
        .status(400)
        .json({ page: `Should be equal to or less than ${lastPage}` })
    }
  } else {
    first = null
    last = null
    page = null
  }

  return res.status(200).json({
    first,
    last,
    page,
    pageLimit,
    results: reviews,
    total
  })
}
