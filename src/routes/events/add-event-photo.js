const fs = require('fs')

const aws = require('aws-sdk')
const { last } = require('lodash')
const moment = require('moment')
const multer = require('multer')
const pify = require('pify')

const Event = require('../../models/event')
const logger = require('../../helpers/logger')

const s3 = new aws.S3()
const uploadPhoto = pify(
  multer({
    dest: '/tmp',
    limits: { fields: 0, fieldSize: 0, fileSize: 2097152 },
    fileFilter: (req, file, cb) => {
      if (/^image\/(jpe?g|png)$/i.test(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new Error('Should be a jpg or png image'))
      }
    }
  }).single('photo')
)

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ message: 'You are blocked' })
  }

  const eventId = req.params.eventId

  let event
  try {
    event = await Event.findOne({ _id: eventId })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Event not found' })
    }
    logger.error(`Event ${eventId} failed to be found at add-event-photo`)
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

  try {
    await uploadPhoto(req, res)
  } catch (err) {
    return res.status(400).json({ photo: err.message })
  }

  if (!req.file) {
    return res.status(400).json({ photo: 'Is required' })
  }

  const params = {
    ACL: 'public-read',
    Body: fs.createReadStream(req.file.path),
    Bucket: process.env.AWS_S3_BUCKET,
    ContentType: 'application/octet-stream',
    Key: `events/photos/${req.file.filename}`
  }

  try {
    await s3.putObject(params).promise()
  } catch (err) {
    logger.error(
      `Event's photo ${params.Key} failed to be uploaded at add-event-photo`
    )
    return next(err)
  }

  fs.unlink(req.file.path)

  event.photos = [
    ...event.photos,
    {
      uploadedAt: moment.utc().toDate(),
      url: `https://s3-sa-east-1.amazonaws.com/${process.env
        .AWS_S3_BUCKET}/events/photos/${req.file.filename}`,
      user: req.user.id
    }
  ]
  event.updatedAt = moment.utc().toDate()

  try {
    event = await event.save()
  } catch (err) {
    logger.error(`Event ${event.id} failed to be updated at add-event-photo`)
    return next(err)
  }

  return res.status(200).json({ photo: last(event.photos).url })
}
