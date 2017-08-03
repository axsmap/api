const { last } = require('lodash')
const moment = require('moment')

const Event = require('../../models/event')
const logger = require('../../helpers/logger')

module.exports = async (req, res, next) => {
  const eventID = req.params.eventID
  const photoID = req.params.photoID

  let event
  try {
    event = await Event.findOne({ _id: eventID })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Event not found' })
    }

    logger.error(`Event ${eventID} failed to be found at ban-event-photo`)
    return next(err)
  }

  if (!event) {
    return res.status(404).json({ message: 'Event not found' })
  }

  const isParamPhoto = photo => last(photo.url.split('/')) === photoID

  if (!event.photos || !event.photos.find(isParamPhoto)) {
    return res.status(404).json({ message: 'Photo not found' })
  }

  event.photos = event.photos.map(photo => {
    if (isParamPhoto(photo)) {
      photo.banned = true
    }

    return photo
  })

  event.updatedAt = moment.utc().toDate()

  try {
    await event.save()
  } catch (err) {
    logger.error(`Event ${event.id} failed to be updated at ban-event-photo`)
    return next(err)
  }

  return res.status(200).json({ message: 'Success' })
}
