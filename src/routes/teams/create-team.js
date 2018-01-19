const aws = require('aws-sdk')
const jimp = require('jimp')
const moment = require('moment')
const randomstring = require('randomstring')

const logger = require('../../helpers/logger')
const { Team } = require('../../models/team')

const { validateCreateTeam } = require('./validations')

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateCreateTeam(req.body)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  const data = Object.assign(
    {},
    {
      avatar: req.body.avatar ? req.body.avatar : undefined,
      description: req.body.description,
      name: req.body.name
    }
  )

  if (data.avatar) {
    const avatarBuffer = Buffer.from(data.avatar.split(',')[1], 'base64')
    let avatarImage
    try {
      avatarImage = await jimp.read(avatarBuffer)
    } catch (err) {
      logger.error('Avatar image failed to be read at create-team')
      return next(err)
    }

    let uploadAvatar
    avatarImage.cover(400, 400).quality(85)
    avatarImage.getBuffer(avatarImage.getMIME(), (err, avatarBuffer) => {
      if (err) {
        return next(err)
      }

      const avatarExtension = avatarImage.getExtension()
      if (
        avatarExtension === 'png' ||
        avatarExtension === 'jpeg' ||
        avatarExtension === 'jpg' ||
        avatarExtension === 'bmp'
      ) {
        const avatarFileName = `${Date.now()}${randomstring.generate({
          length: 5,
          capitalization: 'lowercase'
        })}.${avatarExtension}`
        const s3 = new aws.S3()
        uploadAvatar = s3
          .putObject({
            ACL: 'public-read',
            Body: avatarBuffer,
            Bucket: process.env.AWS_S3_BUCKET,
            ContentType: avatarImage.getMIME(),
            Key: `teams/avatars/${avatarFileName}`
          })
          .promise()

        data.avatar = `https://s3.amazonaws.com/${process.env
          .AWS_S3_BUCKET}/teams/avatars/${avatarFileName}`
      } else {
        return res
          .status(400)
          .json({ avatar: 'Should have a .png, .jpeg, .jpg or .bmp extension' })
      }
    })

    try {
      await uploadAvatar
    } catch (err) {
      logger.error('Avatar failed to be uploaded at create-team')
      return next(err)
    }
  }

  data.managers = [req.user.id]

  data.name = data.name.trim()

  let repeatedTeam
  try {
    repeatedTeam = await Team.findOne({ name: data.name, isArchived: false })
  } catch (err) {
    logger.error(`Team ${data.name} failed to be found at create-team`)
    return next(err)
  }

  if (repeatedTeam) {
    return res.status(400).json({ name: 'Is already taken' })
  }

  let team
  try {
    team = await Team.create(data)
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(
      `Team ${data.name} failed to be created at create-team.\nData: ${JSON.stringify(
        data
      )}`
    )
    return next(err)
  }

  req.user.teams = [...req.user.teams, team.id]
  req.user.updatedAt = moment.utc().toDate()

  try {
    await req.user.save()
  } catch (err) {
    logger.error(`User ${req.user.id} failed to be updated at create-team`)
    return next(err)
  }

  const dataResponse = Object.assign(
    {},
    {
      id: team.id.toString(),
      avatar: team.avatar,
      description: team.description,
      managers: [
        {
          id: req.user.id.toString(),
          avatar: req.user.avatar,
          name: `${req.user.firstName} ${req.user.lastName}`
        }
      ],
      name: team.name
    }
  )

  return res.status(201).json(dataResponse)
}
