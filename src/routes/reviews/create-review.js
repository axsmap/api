const axios = require('axios')
const aws = require('aws-sdk')
const jimp = require('jimp')
const moment = require('moment')
const { pick } = require('lodash')
const randomstring = require('randomstring')

const { Event } = require('../../models/event')
const logger = require('../../helpers/logger')
const { Photo } = require('../../models/photo')
const { Review } = require('../../models/review')
const { Team } = require('../../models/team')
const { Venue } = require('../../models/venue')

const { validateCreateEditReview } = require('./validations')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  const { errors, isValid } = validateCreateEditReview(req.body)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  const reviewData = pick(req.body, [
    'allowsGuideDog',
    'bathroomScore',
    'comments',
    'entryScore',
    'event',
    'hasParking',
    'hasSecondEntry',
    'hasWellLit',
    'isQuiet',
    'isSpacious',
    'steps',
    'team'
  ])
  reviewData.user = req.user.id

  if (reviewData.event) {
    let event
    try {
      event = await Event.findOne({ _id: reviewData.event })
    } catch (err) {
      logger.error(
        `Event ${reviewData.event} failed to be found at create-review`
      )
      return next(err)
    }

    if (!event) {
      return res.status(404).json({ event: 'Event not found' })
    }

    if (!event.participants.find(p => p.toString() === reviewData.user)) {
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

  if (reviewData.team) {
    let team
    try {
      team = await Team.findOne({ _id: reviewData.team, isArchived: false })
    } catch (err) {
      logger.error(
        `Team ${reviewData.team} failed to be found at create-review`
      )
      return next(err)
    }

    if (!team) {
      return res.status(404).json({ team: 'Team not found' })
    }

    if (!team.members.find(m => m.toString() === reviewData.user)) {
      return res.status(400).json({ team: 'You are not a member of this team' })
    }
  }

  const placeId = req.body.place
  let venue
  try {
    venue = await Venue.findOne({ placeId })
  } catch (err) {
    logger.error(
      `Venue with placeId ${placeId} failed to be found at create-review`
    )
    return next(err)
  }

  if (!venue) {
    let response
    try {
      response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&key=${process
          .env.PLACES_API_KEY}`
      )
    } catch (err) {
      logger.error(`Place ${placeId} failed to be found at create-review.`)
      return next(err)
    }

    const statusResponse = response.data.status
    if (statusResponse !== 'OK') {
      return res.status(404).json({ general: 'Place not found' })
    }

    const placeData = response.data.result
    const venueData = {
      address: placeData.formatted_address,
      location: {
        coordinates: [
          placeData.geometry.location.lng,
          placeData.geometry.location.lat
        ]
      },
      name: placeData.name,
      placeId,
      types: placeData.types
    }

    try {
      venue = await Venue.create(venueData)
    } catch (err) {
      logger.error(
        `Venue failed to be created at create-review.\nData: ${JSON.stringify(
          venueData
        )}`
      )
      return next(err)
    }
  }
  reviewData.venue = venue.id

  let repeatedReview
  try {
    repeatedReview = await Review.findOne({
      user: reviewData.user,
      venue: reviewData.venue
    })
  } catch (err) {
    logger.error(
      `Review for venue ${reviewData.venue} from user ${reviewData.user} failed to be found at create-review`
    )
    return next(err)
  }

  if (repeatedReview) {
    return res.status(400).json({ general: 'You already rated this venue' })
  }

  let review
  try {
    review = await Review.create(reviewData)
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(
      `Review failed to be created at create-review.\nData: ${JSON.stringify(
        reviewData
      )}`
    )
    return next(err)
  }

  const photo = req.body.photo
  if (photo) {
    const photoBuffer = Buffer.from(photo.split(',')[1], 'base64')
    let photoImage
    try {
      photoImage = await jimp.read(photoBuffer)
    } catch (err) {
      logger.error('Photo image failed to be read at create-review')
      return next(err)
    }

    photoImage.cover(640, 480).quality(85)
    photoImage.getBuffer(photoImage.getMIME(), async (err, photoBuffer) => {
      if (err) {
        return next(err)
      }

      const photoExtension = photoImage.getExtension()
      const photoFileName = `${Date.now()}${randomstring.generate({
        length: 5,
        capitalization: 'lowercase'
      })}.${photoExtension}`
      const s3 = new aws.S3()
      try {
        await s3
          .putObject({
            ACL: 'public-read',
            Body: photoBuffer,
            Bucket: process.env.AWS_S3_BUCKET,
            ContentType: photoImage.getMIME(),
            Key: `photos/${photoFileName}`
          })
          .promise()
      } catch (err) {
        logger.error('Photo buffer failed to be uploaded at create-review')
        return next(err)
      }

      const photoData = {
        isAllowed: false,
        review: review.id,
        url: `https://s3.amazonaws.com/${process.env
          .AWS_S3_BUCKET}/photos/${photoFileName}`,
        user: req.user.id,
        venue: venue.id
      }
      try {
        await Photo.create(photoData)
      } catch (err) {
        logger.error(
          `Photo failed to be created at create-review.\nData: ${JSON.stringify(
            photoData
          )}`
        )
        return next(err)
      }
    })
  }

  if (typeof review.allowsGuideDog !== 'undefined') {
    venue.allowsGuideDog = {
      yes: review.allowsGuideDog
        ? venue.allowsGuideDog.yes + 1
        : venue.allowsGuideDog.yes,
      no: review.allowsGuideDog
        ? venue.allowsGuideDog.no
        : venue.allowsGuideDog.no + 1
    }
  }

  if (typeof review.bathroomScore !== 'undefined') {
    if (venue.bathroomReviews > 0) {
      venue.bathroomScore =
        (venue.bathroomScore * venue.bathroomReviews + review.bathroomScore) /
        (venue.bathroomReviews + 1)
      venue.bathroomReviews += 1
    } else {
      venue.bathroomScore = review.bathroomScore
      venue.bathroomReviews = 1
    }
  }

  if (venue.entryReviews > 0) {
    venue.entryScore =
      (venue.entryScore * venue.entryReviews + review.entryScore) /
      (venue.entryReviews + 1)
    venue.entryReviews += 1
  } else {
    venue.entryScore = review.entryScore
    venue.entryReviews = 1
  }

  if (typeof review.hasParking !== 'undefined') {
    venue.hasParking = {
      yes: review.hasParking ? venue.hasParking.yes + 1 : venue.hasParking.yes,
      no: review.hasParking ? venue.hasParking.no : venue.hasParking.no + 1
    }
  }

  if (typeof review.hasSecondEntry !== 'undefined') {
    venue.hasSecondEntry = {
      yes: review.hasSecondEntry
        ? venue.hasSecondEntry.yes + 1
        : venue.hasSecondEntry.yes,
      no: review.hasSecondEntry
        ? venue.hasSecondEntry.no
        : venue.hasSecondEntry.no + 1
    }
  }

  if (typeof review.hasWellLit !== 'undefined') {
    venue.hasWellLit = {
      yes: review.hasWellLit ? venue.hasWellLit.yes + 1 : venue.hasWellLit.yes,
      no: review.hasWellLit ? venue.hasWellLit.no : venue.hasWellLit.no + 1
    }
  }

  if (typeof review.isQuiet !== 'undefined') {
    venue.isQuiet = {
      yes: review.isQuiet ? venue.isQuiet.yes + 1 : venue.isQuiet.yes,
      no: review.isQuiet ? venue.isQuiet.no : venue.isQuiet.no + 1
    }
  }

  if (typeof review.isSpacious !== 'undefined') {
    venue.isSpacious = {
      yes: review.isSpacious ? venue.isSpacious.yes + 1 : venue.isSpacious.yes,
      no: review.isSpacious ? venue.isSpacious.no : venue.isSpacious.no + 1
    }
  }

  venue.reviews = [...venue.reviews, review.id]

  if (typeof review.steps !== 'undefined') {
    venue.steps = {
      zero: review.steps === 0 ? venue.steps.zero + 1 : venue.steps.zero,
      one: review.steps === 1 ? venue.steps.one + 1 : venue.steps.one,
      two: review.steps === 2 ? venue.steps.two + 1 : venue.steps.two,
      moreThanTwo:
        review.steps === 3
          ? venue.steps.moreThanTwo + 1
          : venue.steps.moreThanTwo
    }
  }

  try {
    await venue.save()
  } catch (err) {
    logger.error(`Venue ${venue.id} failed to be updated at create-review`)
    return next(err)
  }

  const dataResponse = pick(review, [
    '_id',
    'allowsGuideDog',
    'bathroomScore',
    'comments',
    'entryScore',
    'event',
    'hasParking',
    'hasSecondEntry',
    'hasWellLit',
    'isQuiet',
    'isSpacious',
    'steps',
    'team',
    'user',
    'venue'
  ])

  return res.status(201).json(dataResponse)
}
