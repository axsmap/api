const { last, pick } = require('lodash')
const moment = require('moment')

const Event = require('../../models/event')
const logger = require('../../helpers/logger')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ message: 'You are blocked' })
  }

  const eventId = req.params.eventId
  const photoId = req.params.photoId

  let event
  try {
    event = await Event.findOne({ _id: eventId })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Event not found' })
    }
    logger.error(`Event ${eventId} failed to be found at flag-event-photo`)
    return next(err)
  }

  if (!event) {
    return res.status(404).json({ message: 'Event not found' })
  }

  const isParamPhoto = photo => last(photo.url.split('/')) === photoId

  if (!event.photos || !event.photos.find(isParamPhoto)) {
    return res.status(404).json({ message: 'Photo not found' })
  }
  const data = pick(req.body, ['comments', 'type'])

  event.photos = event.photos.map(photo => {
    if (isParamPhoto(photo)) {
      photo.complaints = [
        ...photo.complaints,
        {
          comments: data.comments,
          type: data.type,
          user: req.user.id
        }
      ]
    }

    return photo
  })

  event.updatedAt = moment.utc().toDate()

  try {
    await event.save()
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        if (key.includes('comments')) {
          validationErrors.comments = err.errors[key].message
        } else {
          validationErrors.type = err.errors[key].message
        }
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(`Event ${event.id} failed to be updated at flag-event-photo`)
    return next(err)
  }

  return res.status(200).json({ message: 'Success' })
}
