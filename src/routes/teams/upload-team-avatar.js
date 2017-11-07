const fs = require('fs')

const aws = require('aws-sdk')
const { last } = require('lodash')
const moment = require('moment')
const multer = require('multer')
const pify = require('pify')

const logger = require('../../helpers/logger')
const { Team } = require('../../models/team')

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

  const teamId = req.params.teamId

  let team
  try {
    team = await Team.findOne({ _id: teamId, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Team not found' })
    }

    logger.error(`Team ${teamId} failed to be found at upload-team-avatar`)
    return next(err)
  }

  if (!team) {
    return res.status(404).json({ general: 'Team not found' })
  }

  if (
    !team.managers.find(m => m.toString() === req.user.id) &&
    !req.user.isAdmin
  ) {
    return res.status(403).json({ general: 'Forbidden action' })
  }

  try {
    await uploadAvatar(req, res)
  } catch (err) {
    return res.status(400).json({ avatar: err.message })
  }

  if (!req.file) {
    return res.status(400).json({ avatar: 'Is required' })
  }

  let params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `teams/avatars/${last(team.avatar.split('/'))}`
  }

  if (!team.avatar.endsWith('default.png')) {
    try {
      await s3.deleteObject(params).promise()
    } catch (err) {
      logger.error(
        `Team's avatar ${params.Key} failed to be deleted at upload-team-avatar`
      )
      return next(err)
    }
  }

  params = {
    ACL: 'public-read',
    Body: fs.createReadStream(req.file.path),
    Bucket: process.env.AWS_S3_BUCKET,
    ContentType: 'application/octet-stream',
    Key: `teams/avatars/${req.file.filename}`
  }

  try {
    await s3.putObject(params).promise()
  } catch (err) {
    logger.error(
      `Team's avatar ${params.Key} failed to be uploaded at upload-team-avatar`
    )
    return next(err)
  }

  fs.unlink(req.file.path)

  team.avatar = `https://s3-sa-east-1.amazonaws.com/${process.env
    .AWS_S3_BUCKET}/teams/avatars/${req.file.filename}`
  team.updatedAt = moment.utc().toDate()

  try {
    team = await team.save()
  } catch (err) {
    logger.error(`Team ${team.id} failed to be updated at upload-team-avatar`)
    return next(err)
  }

  return res.status(200).json({ avatar: team.avatar })
}
