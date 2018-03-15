const fs = require('fs')
const util = require('util')

const aws = require('aws-sdk')
const jimp = require('jimp')
const multer = require('multer')
const randomstring = require('randomstring')

const logger = require('../../helpers/logger')
const { Photo } = require('../../models/photo')

jimp.prototype.getBufferAsync = util.promisify(jimp.prototype.getBuffer)

module.exports = async (req, res, next) => {
  const uploadPhoto = util.promisify(
    multer({
      dest: '/tmp',
      limits: { fileSize: 8388608 },
      fileFilter: (req, file, cb) => {
        if (/^image\/(jpe?g|png)$/i.test(file.mimetype)) {
          cb(null, true)
        } else {
          cb(new Error('Should have .jpeg or .png extension'))
        }
      }
    }).single('photo')
  )
  try {
    await uploadPhoto(req, res)
  } catch (err) {
    return res.status(400).json({ photo: err.message })
  }

  if (!req.file) {
    return res.status(400).json({ photo: 'Is required' })
  }

  let photoFile
  try {
    photoFile = await jimp.read(req.file.path)
  } catch (err) {
    logger.error('Photo failed to be read at create-photo')
    return next(err)
  }

  if (req.body.isWide === 'true') {
    photoFile.cover(640, 480).quality(85)
  } else {
    photoFile.cover(400, 400).quality(85)
  }

  let photoBuffer
  try {
    photoBuffer = await photoFile.getBufferAsync(photoFile.getMIME())
  } catch (err) {
    return next(err)
  }

  const photoExtension = photoFile.getExtension()
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
        ContentType: photoFile.getMIME(),
        Key: `photos/${photoFileName}`
      })
      .promise()
  } catch (err) {
    logger.error('Photo failed to be uploaded at create-photo')
    return next(err)
  }

  fs.unlink(req.file.path)

  const photoData = {
    fileName: photoFileName,
    url: `https://s3.amazonaws.com/${process.env
      .AWS_S3_BUCKET}/photos/${photoFileName}`,
    user: req.user.id
  }

  let photo
  try {
    photo = await Photo.create(photoData)
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error('Photo failed to be created at create-photo')
    return next(err)
  }

  const dataResponse = {
    id: photo.id,
    fileName: photo.fileName,
    url: photo.url,
    user: photo.user
  }
  return res.status(201).json(dataResponse)
}
