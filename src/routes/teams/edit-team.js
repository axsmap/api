const aws = require('aws-sdk')
const jimp = require('jimp')
const { difference, intersection, last } = require('lodash')
const moment = require('moment')
const randomstring = require('randomstring')

const { cleanSpaces } = require('../../helpers')
const logger = require('../../helpers/logger')
const { Team } = require('../../models/team')

const { validateEditTeam } = require('./validations')

module.exports = async (req, res, next) => {
  const teamId = req.params.teamId

  let team
  try {
    team = await Team.findOne({ _id: teamId, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Team not found' })
    }

    logger.error(`Team ${teamId} failed to be found at edit-team`)
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

  const data = req.body
  const { errors, isValid } = validateEditTeam(data)
  if (!isValid) return res.status(400).json(errors)

  const s3 = new aws.S3()
  if (data.avatar) {
    const avatarBuffer = Buffer.from(data.avatar.split(',')[1], 'base64')
    let avatarImage
    try {
      avatarImage = await jimp.read(avatarBuffer)
    } catch (err) {
      logger.error('Avatar image failed to be read at edit-team')
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
      logger.error('Avatar failed to be uploaded at edit-team')
      return next(err)
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `teams/avatars/${last(team.avatar.split('/'))}`
    }
    if (!team.avatar.endsWith('default.png')) {
      try {
        await s3.deleteObject(params).promise()
      } catch (err) {
        logger.error(
          `Team's avatar ${params.Key} failed to be deleted at edit-team`
        )
        return next(err)
      }
    }

    team.avatar = data.avatar
  } else if (data.avatar === '') {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `teams/avatars/${last(team.avatar.split('/'))}`
    }
    if (!team.avatar.endsWith('default.png')) {
      try {
        await s3.deleteObject(params).promise()
      } catch (err) {
        logger.error(
          `Team's avatar ${params.Key} failed to be deleted at edit-team`
        )
        return next(err)
      }
    }

    team.avatar = `https://s3.amazonaws.com/${process.env
      .AWS_S3_BUCKET}/teams/avatars/default.png`
  }

  team.description = data.description || team.description

  if (data.managers) {
    let managersToAdd = []
    let managersToRemove = []

    data.managers.forEach(m => {
      if (m.startsWith('-')) {
        managersToRemove = [...managersToRemove, m.substring(1)]
      } else {
        managersToAdd = [...managersToAdd, m]
      }
    })

    const teamManagers = team.managers.map(m => m.toString())

    managersToAdd = [...new Set(difference(managersToAdd, teamManagers))]
    if (managersToAdd.length > 0) {
      const teamMembers = team.members.map(m => m.toString())
      const notMember = managersToAdd.find(m => !teamMembers.includes(m))

      if (notMember) {
        return res
          .status(400)
          .json({ managers: `User ${notMember} is not a member of this team` })
      }

      team.managers = [...teamManagers, ...managersToAdd]
      team.members = team.members.filter(
        m => !managersToAdd.includes(m.toString())
      )
    }

    managersToRemove = [
      ...new Set(intersection(managersToRemove, teamManagers))
    ]
    if (managersToRemove.length === team.managers.length) {
      return res
        .status(400)
        .json({ managers: 'Should not remove all managers' })
    }

    team.managers = team.managers.filter(
      m => !managersToRemove.includes(m.toString())
    )
    const teamMembers = team.members.map(m => m.toString())
    team.members = [...teamMembers, ...managersToRemove]
  }

  if (data.members) {
    const teamMembers = team.members.map(m => m.toString())
    let membersToRemove = data.members.map(m => m.substring(1))
    membersToRemove = [...new Set(intersection(membersToRemove, teamMembers))]
    team.members = team.members.filter(
      m => !membersToRemove.includes(m.toString())
    )
  }

  if (data.name) {
    const teamName = cleanSpaces(data.name)

    if (teamName !== team.name) {
      let repeatedTeam
      try {
        repeatedTeam = await Team.findOne({
          name: teamName,
          isArchived: false
        })
      } catch (err) {
        logger.error(`Team ${teamName} failed to be found at edit-team`)
        return next(err)
      }

      if (repeatedTeam) {
        return res.status(400).json({ name: 'Is already taken' })
      }

      team.name = teamName
    }
  }

  team.updatedAt = moment.utc().toDate()

  try {
    await team.save()
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(`Team ${team.id} failed to be updated at edit-team`)
    return next(err)
  }

  const dataResponse = Object.assign(
    {},
    {
      id: team.id,
      avatar: team.avatar,
      description: team.description,
      managers: team.managers,
      members: team.members,
      name: team.name
    }
  )
  return res.status(200).json(dataResponse)
}
