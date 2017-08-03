const aws = require('aws-sdk')
const { last } = require('lodash')
const moment = require('moment')

const Event = require('../../models/event')
const logger = require('../../helpers/logger')

const s3 = new aws.S3()

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
    logger.error(`Event ${eventID} failed to be found at remove-event-photo`)
    return next(err)
  }

  if (!event) {
    return res.status(404).json({ message: 'Event not found' })
  }

  if (
    !event.managers.find(m => m.toString() === req.user.id) &&
    !req.user.isAdmin
  ) {
    return res.status(403).json({ message: 'Forbidden action' })
  }

  const isParamPhoto = photo => last(photo.url.split('/')) === photoID

  if (!event.photos || !event.photos.find(isParamPhoto)) {
    return res.status(404).json({ message: 'Photo not found' })
  }

  const photoParams = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `events/photos/${photoID}`
  }

  try {
    await s3.deleteObject(photoParams).promise()
  } catch (err) {
    logger.error(
      `Event's photo ${photoParams.Key} failed to be deleted at remove-event-photo`
    )
    return next(err)
  }

  const isNotParamPhoto = photo => last(photo.url.split('/')) !== photoID

  event.photos = event.photos.filter(isNotParamPhoto)
  event.updatedAt = moment.utc().toDate()

  try {
    await event.save()
  } catch (err) {
    logger.error(`Event ${event.id} failed to be updated at remove-event-photo`)
    return next(err)
  }

  return res.status(204).json({ message: 'Success' })
}
