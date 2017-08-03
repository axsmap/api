const aws = require('aws-sdk')
const { last } = require('lodash')
const moment = require('moment')

const logger = require('../../helpers/logger')
const Venue = require('../../models/venue')

const s3 = new aws.S3()

module.exports = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Forbidden action' })
  }

  const photoID = req.params.photoID
  const venueID = req.params.venueID

  let venue
  try {
    venue = await Venue.findOne({ _id: venueID, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Venue not found' })
    }

    logger.error(`Venue ${venueID} failed to be found at remove-venue-photo`)
    return next(err)
  }

  if (!venue) {
    return res.status(404).json({ message: 'Venue not found' })
  }

  const isParamPhoto = photo => last(photo.url.split('/')) === photoID

  if (!venue.photos || !venue.photos.find(isParamPhoto)) {
    return res.status(404).json({ message: 'Photo not found' })
  }

  const photoParams = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `venues/photos/${photoID}`
  }

  try {
    await s3.deleteObject(photoParams).promise()
  } catch (err) {
    logger.error(
      `Venue photo ${photoParams.Key} failed to be deleted at remove-venue-photo`
    )
    return next(err)
  }

  const isNotParamPhoto = photo => last(photo.url.split('/')) !== photoID

  venue.photos = venue.photos.filter(isNotParamPhoto)
  venue.updatedAt = moment.utc().toDate()

  try {
    await venue.save()
  } catch (err) {
    logger.error(`Venue ${venue.id} failed to be updated at remove-venue-photo`)
    return next(err)
  }

  return res.status(204).json({ message: 'Success' })
}
