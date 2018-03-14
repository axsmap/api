const aws = require('aws-sdk')

const logger = require('../../helpers/logger')
const { Photo } = require('../../models/photo')

module.exports = async (req, res, next) => {
  const photoFileName = req.params.photoFileName

  let photo
  try {
    photo = await Photo.findOne({ fileName: photoFileName })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Photo not found' })
    }

    logger.error(`Photo ${photoFileName} failed to be found at delete-photo`)
    return next(err)
  }

  if (photo) {
    try {
      await photo.remove()
    } catch (err) {
      logger.error(
        `Photo ${photoFileName} failed to be deleted at delete-photo`
      )
      return next(err)
    }
  }

  if (!photoFileName.includes('default')) {
    const s3 = new aws.S3()
    try {
      await s3
        .deleteObject({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: `photos/${photoFileName}`
        })
        .promise()
    } catch (err) {
      logger.error('Photo failed to be deleted at delete-photo')
      return next(err)
    }
  }

  return res.status(204).json({ general: 'Success' })
}
