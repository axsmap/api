const fs = require('fs')

const aws = require('aws-sdk')
const moment = require('moment')
const { last } = require('lodash')
const multer = require('multer')
const pify = require('pify')

const logger = require('../../helpers/logger')
const { User } = require('../../models/user')

const s3 = new aws.S3()
const uploadAvatar = pify(
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
  }).single('avatar')
)

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  const userId = req.params.userId

  let user
  try {
    user = await User.findOne({ _id: userId, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'User not found' })
    }

    logger.error(`User ${userId} failed to be found at upload-user-avatar`)
    return next(err)
  }

  if (!user) {
    return res.status(404).json({ general: 'User not found' })
  }

  if (user.id !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ general: 'Forbidden action' })
  }

  try {
    await uploadAvatar(req, res)
  } catch (err) {
    return res.status(400).json({ general: err.message })
  }

  if (!req.file) {
    return res.status(400).json({ avatar: 'Is required' })
  }

  let params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `users/avatars/${last(user.avatar.split('/'))}`
  }

  if (!user.avatar.endsWith('default.png')) {
    try {
      await s3.deleteObject(params).promise()
    } catch (err) {
      logger.error(
        `User's avatar ${params.Key} failed to be deleted at upload-user-avatar`
      )
      return next(err)
    }
  }

  params = {
    ACL: 'public-read',
    Body: fs.createReadStream(req.file.path),
    Bucket: process.env.AWS_S3_BUCKET,
    ContentType: 'application/octet-stream',
    Key: `users/avatars/${req.file.filename}`
  }

  try {
    await s3.putObject(params).promise()
  } catch (err) {
    logger.error(
      `User's avatar ${params.Key} failed to be uploaded at upload-user-avatar`
    )
    return next(err)
  }

  fs.unlink(req.file.path)

  user.avatar = `https://s3.amazonaws.com/${process.env
    .AWS_S3_BUCKET}/users/avatars/${req.file.filename}`
  user.updatedAt = moment.utc().toDate()

  try {
    user = await user.save()
  } catch (err) {
    logger.error(`User ${user.id} failed to be updated at upload-user-avatar`)
    return next(err)
  }

  return res.status(200).json({ avatar: user.avatar })
}
