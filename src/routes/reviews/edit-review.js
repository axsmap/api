const moment = require('moment')
const { pick } = require('lodash')

const Event = require('../../models/event')
const logger = require('../../helpers/logger')
const Review = require('../../models/review')
const Team = require('../../models/team')
const Venue = require('../../models/venue')

const { validateCreateEditReview } = require('./validations')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ message: 'You are blocked' })
  }

  const reviewId = req.params.reviewId

  let review
  try {
    review = await Review.findOne({ _id: reviewId }).select(
      '-__v -createdAt -updatedAt'
    )
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Review not found' })
    }

    logger.error(`Review ${reviewId} failed to be found at edit-review`)
    return next(err)
  }

  if (!review) {
    return res.status(404).json({ message: 'Review not found' })
  }

  if (review.user.toString() !== req.user.id) {
    return res
      .status(423)
      .json({ message: 'You cannot edit someone else review' })
  }

  let venue
  try {
    venue = await Venue.findOne({
      _id: review.venue.toString(),
      isArchived: false
    })
  } catch (err) {
    logger.error(
      `Venue ${review.venue.toString()} failed to be found at edit-review`
    )
    return next(err)
  }

  if (!venue) {
    return res.status(404).json({ message: 'Review venue not found' })
  }

  const data = pick(req.body, [
    'bathroomScore',
    'comments',
    'entryScore',
    'event',
    'guideDog',
    'parking',
    'quiet',
    'ramp',
    'secondEntry',
    'spacious',
    'steps',
    'team',
    'wellLit'
  ])
  const { errors, isValid } = validateCreateEditReview(data)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  review.bathroomScore = data.bathroomScore || review.bathroomScore
  review.comments = data.comments || review.comments
  review.entryScore = data.entryScore || review.entryScore

  if (data.event) {
    let event
    try {
      event = await Event.findOne({ _id: data.event })
    } catch (err) {
      logger.error(`Event ${data.event} failed to be found at edit-review`)
      return next(err)
    }

    if (!event) {
      return res.status(404).json({ event: 'Event not found' })
    }

    if (!event.participants.find(p => p.toString() === req.user.id)) {
      return res
        .status(400)
        .json({ event: 'You are not a participant of this event' })
    }

    const startDate = moment(event.startDate).utc()
    const endDate = moment(event.endDate).utc()
    const today = moment.utc()
    if (startDate.isAfter(today)) {
      return res.status(400).json({ event: 'Event has not started yet' })
    } else if (endDate.isBefore(today)) {
      return res.status(400).json({ event: 'Event has already finished' })
    }

    review.event = data.event
  }

  review.guideDog = data.guideDog || review.guideDog
  review.parking = data.parking || review.parking
  review.quiet = data.quiet || review.quiet
  review.ramp = data.ramp || review.ramp
  review.secondEntry = data.secondEntry || review.secondEntry
  review.spacious = data.spacious || review.spacious

  if (data.steps) {
    venue.stepsReviews[review.steps] -= 1
    venue.stepsReviews[data.steps] += 1
    review.steps = data.steps
  }

  if (data.team) {
    let team
    try {
      team = await Team.findOne({ _id: data.team, isArchived: false })
    } catch (err) {
      logger.error(`Team ${data.team} failed to be found at edit-review`)
      return next(err)
    }

    if (!team) {
      return res.status(404).json({ team: 'Team not found' })
    }

    if (!team.members.find(m => m.toString() === req.user.id)) {
      return res.status(400).json({ team: 'You are not a member of this team' })
    }

    review.team = data.team
  }

  review.wellLit = data.wellLit || review.wellLit

  review.updatedAt = moment.utc().toDate()

  try {
    await review.save()
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(`Review ${review.id} failed to be updated at edit-review`)
    return next(err)
  }

  try {
    await venue.save()
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(`Venue ${venue.id} failed to be updated at edit-review`)
    return next(err)
  }

  return res.status(200).json(review)
}
