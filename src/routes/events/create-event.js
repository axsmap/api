const moment = require('moment')
const { pick, trim } = require('lodash')
const slugify = require('speakingurl')

const Event = require('../../models/event')
const logger = require('../../helpers/logger')

const { validateCreateEvent } = require('./validations')

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateCreateEvent(req.body)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  const data = pick(req.body, [
    'city',
    'country',
    'description',
    'endDate',
    'isPublic',
    'name',
    'participantsGoal',
    'pointCoordinates',
    'reviewsGoal',
    'startDate'
  ])
  data.name = trim(data.name)
  data.slug = slugify(data.name).toLowerCase()

  let otherEvent
  try {
    otherEvent = await Event.findOne({ slug: data.slug })
  } catch (err) {
    logger.error(`Event ${data.slug} failed to be found at create-event`)
    return next(err)
  }

  if (otherEvent) {
    return res.status(400).json({ name: 'Is already taken' })
  }

  data.creator = req.user.id
  data.endDate = moment(data.endDate).utc().toDate()
  data.managers = [req.user.id]
  data.participants = [req.user.id]
  data.point = { coordinates: data.pointCoordinates }
  data.startDate = moment(data.startDate).utc().toDate()

  let event
  try {
    event = await Event.create(data)
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(`Event ${data.slug} failed to be created at create-event`)
    return next(err)
  }

  req.user.events = [...req.user.events, event.id]
  req.user.updatedAt = moment.utc().toDate()

  try {
    await req.user.save()
  } catch (err) {
    logger.error(`User ${req.user.id} failed to be updated at create-event`)
    return next(err)
  }

  const dataResponse = pick(event, [
    '_id',
    'city',
    'country',
    'creator',
    'description',
    'endDate',
    'isApproved',
    'isPublic',
    'managers',
    'name',
    'participantsGoal',
    'participants',
    'photos',
    'point',
    'poster',
    'reviews',
    'reviewsGoal',
    'slug',
    'startDate',
    'teams'
  ])

  return res.status(201).json(dataResponse)
}
