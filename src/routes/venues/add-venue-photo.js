const fs = require('fs')

const aws = require('aws-sdk')
const { last } = require('lodash')
const moment = require('moment')
const multer = require('multer')
const pify = require('pify')

const logger = require('../../helpers/logger')
const Venue = require('../../models/venue')

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
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Forbidden action' })
  }

  const venueID = req.params.venueID

  let venue
  try {
    venue = await Venue.findOne({ _id: venueID, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Venue not found' })
    }

    logger.error(`Venue ${venueID} failed to be found at add-venue-photo`)
    return next(err)
  }

  if (!venue) {
    return res.status(404).json({ message: 'Venue not found' })
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
    Key: `venues/photos/${req.file.filename}`
  }

  try {
    await s3.putObject(params).promise()
  } catch (err) {
    logger.error(
      `Venue photo ${params.Key} failed to be uploaded at add-venue-photo`
    )
    return next(err)
  }

  fs.unlink(req.file.path)

  venue.photos = [
    ...venue.photos,
    {
      uploadedAt: moment.utc().toDate(),
      url: `https://s3-sa-east-1.amazonaws.com/${process.env
        .AWS_S3_BUCKET}/venues/photos/${req.file.filename}`,
      user: req.user.id
    }
  ]
  venue.updatedAt = moment.utc().toDate()

  try {
    venue = await venue.save()
  } catch (err) {
    logger.error(`Venue ${venue.id} failed to be updated at add-venue-photo`)
    return next(err)
  }

  return res.status(200).json({ photo: last(venue.photos).url })
}
