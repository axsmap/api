const fs = require('fs')

const aws = require('aws-sdk')
const { last } = require('lodash')
const moment = require('moment')
const multer = require('multer')
const pify = require('pify')

const Event = require('../../models/event')
const logger = require('../../helpers/logger')

const s3 = new aws.S3()
const uploadPoster = pify(
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
  }).single('poster')
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

    logger.error(`Event ${eventId} failed to be found at upload-event-poster`)
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
    await uploadPoster(req, res)
  } catch (err) {
    return res.status(400).json({ poster: err.message })
  }

  if (!req.file) {
    return res.status(400).json({ poster: 'Is required' })
  }

  let params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `events/posters/${last(event.poster.split('/'))}`
  }

  if (!event.poster.endsWith('default.png')) {
    try {
      await s3.deleteObject(params).promise()
    } catch (err) {
      logger.error(
        `Event's poster ${params.Key} failed to be deleted at upload-event-poster`
      )
      return next(err)
    }
  }

  params = {
    ACL: 'public-read',
    Body: fs.createReadStream(req.file.path),
    Bucket: process.env.AWS_S3_BUCKET,
    ContentType: 'application/octet-stream',
    Key: `events/posters/${req.file.filename}`
  }

  try {
    await s3.putObject(params).promise()
  } catch (err) {
    logger.error(
      `Event's poster ${params.Key} failed to be uploaded at upload-event-poster`
    )
    return next(err)
  }

  fs.unlink(req.file.path)

  event.poster = `https://s3-sa-east-1.amazonaws.com/${process.env
    .AWS_S3_BUCKET}/events/posters/${req.file.filename}`
  event.updatedAt = moment.utc().toDate()

  try {
    event = await event.save()
  } catch (err) {
    logger.error(
      `Event ${event.id} failed to be updated at upload-event-poster`
    )
    return next(err)
  }

  return res.status(200).json({ poster: event.poster })
}
