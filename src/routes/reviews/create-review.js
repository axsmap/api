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

  const { errors, isValid } = validateCreateEditReview(req.body)

  if (!isValid) {
    return res.status(400).json(errors)
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
    'venue',
    'wellLit'
  ])
  data.user = req.user.id

  let repeatedReview
  try {
    repeatedReview = await Review.findOne({
      user: data.user,
      venue: data.venue
    })
  } catch (err) {
    logger.error(
      `Review for venue ${data.venue} from user ${data.user} failed to be found at create-review`
    )
    return next(err)
  }

  if (repeatedReview) {
    return res
      .status(400)
      .json({ message: `You already rated the venue ${data.venue}` })
  }

  if (data.event) {
    let event
    try {
      event = await Event.findOne({ _id: data.event })
    } catch (err) {
      logger.error(`Event ${data.event} failed to be found at create-review`)
      return next(err)
    }

    if (!event) {
      return res.status(404).json({ event: 'Event not found' })
    }

    if (!event.participants.find(p => p.toString() === data.user)) {
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
  }

  if (data.team) {
    let team
    try {
      team = await Team.findOne({ _id: data.team, isArchived: false })
    } catch (err) {
      logger.error(`Team ${data.team} failed to be found at create-review`)
      return next(err)
    }

    if (!team) {
      return res.status(404).json({ team: 'Team not found' })
    }

    if (!team.members.find(m => m.toString() === data.user)) {
      return res.status(400).json({ team: 'You are not a member of this team' })
    }
  }

  let venue
  try {
    venue = await Venue.findOne({ _id: data.venue, isArchived: false })
  } catch (err) {
    logger.error(`Venue ${data.venue} failed to be found at create-review`)
    return next(err)
  }

  if (!venue) {
    return res.status(404).json({ venue: 'Venue not found' })
  }

  let review
  try {
    review = await Review.create(data)
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(
      `Review for venue ${data.venue} from user ${data.user} failed to be created at create-review`
    )
    return next(err)
  }

  venue.bathroomReviews += 1
  venue.bathroomScore =
    (venue.bathroomScore + review.bathroomScore) / venue.bathroomReviews
  venue.entryReviews += 1
  venue.entryScore = (venue.entryScore + review.entryScore) / venue.entryReviews
  venue.guideDog = review.guideDog ? venue.guideDog + 1 : venue.guideDog
  venue.parking = review.parking ? venue.parking + 1 : venue.parking
  venue.quite = review.quite ? venue.quite + 1 : venue.quite
  venue.ramp = review.ramp ? venue.ramp + 1 : venue.ramp
  venue.reviews = [...venue.reviews, review.id]
  venue.secondEntry = review.secondEntry
    ? venue.secondEntry + 1
    : venue.secondEntry
  venue.spacious = review.spacious ? venue.spacious + 1 : venue.spacious

  if (review.steps) {
    venue.stepsReviews[review.steps] += 1
  }

  venue.wellLit = review.wellLit ? venue.wellLit + 1 : venue.wellLit

  try {
    await venue.save()
  } catch (err) {
    logger.error(`Venue ${venue.id} failed to be updated at create-review`)
    return next(err)
  }

  const dataResponse = pick(review, [
    '_id',
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
    'user',
    'venue',
    'wellLit'
  ])

  return res.status(201).json(dataResponse)
}
