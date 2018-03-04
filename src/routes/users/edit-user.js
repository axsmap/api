const util = require('util')

const aws = require('aws-sdk')
const jimp = require('jimp')
const { last } = require('lodash')
const moment = require('moment')
const randomstring = require('randomstring')

jimp.prototype.getBufferAsync = util.promisify(jimp.prototype.getBuffer)

const { cleanSpaces } = require('../../helpers')
const logger = require('../../helpers/logger')
const { User } = require('../../models/user')

const { validateEditUser } = require('./validations')

module.exports = async (req, res, next) => {
  const userId = req.params.userId

  let user
  try {
    user = await User.findOne({ _id: userId, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'User not found' })
    }

    logger.error(`User with Id ${userId} failed to be found at edit-user.`)
    return next(err)
  }

  if (!user) {
    return res.status(404).json({ general: 'User not found' })
  }

  if (user.id !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ general: 'Forbidden action' })
  }

  const data = req.body

  const { errors, isValid } = validateEditUser(data)
  if (!isValid) return res.status(400).json(errors)

  const s3 = new aws.S3()
  if (data.avatar) {
    let avatarBuffer = Buffer.from(data.avatar.split(',')[1], 'base64')
    let avatarImage
    try {
      avatarImage = await jimp.read(avatarBuffer)
    } catch (err) {
      logger.error('Avatar image failed to be read at edit-user')
      return next(err)
    }

    avatarImage.cover(400, 400).quality(85)
    try {
      avatarBuffer = await avatarImage.getBufferAsync(avatarImage.getMIME())
    } catch (err) {
      return next(err)
    }

    let uploadAvatar
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
          Key: `users/avatars/${avatarFileName}`
        })
        .promise()

      data.avatar = `https://s3.amazonaws.com/${process.env
        .AWS_S3_BUCKET}/users/avatars/${avatarFileName}`
    } else {
      return res
        .status(400)
        .json({ avatar: 'Should have a .png, .jpeg, .jpg or .bmp extension' })
    }

    try {
      await uploadAvatar
    } catch (err) {
      logger.error('Avatar failed to be uploaded at edit-user')
      return next(err)
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `users/avatars/${last(user.avatar.split('/'))}`
    }
    if (!user.avatar.endsWith('default.png')) {
      try {
        await s3.deleteObject(params).promise()
      } catch (err) {
        logger.error(
          `User's avatar ${params.Key} failed to be deleted at edit-user`
        )
        return next(err)
      }
    }

    user.avatar = data.avatar
  } else if (data.avatar === '') {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `users/avatars/${last(user.avatar.split('/'))}`
    }
    if (!user.avatar.endsWith('default.png')) {
      try {
        await s3.deleteObject(params).promise()
      } catch (err) {
        logger.error(
          `User's avatar ${params.Key} failed to be deleted at edit-user`
        )
        return next(err)
      }
    }

    user.avatar = `https://s3.amazonaws.com/${process.env
      .AWS_S3_BUCKET}/users/avatars/default.png`
  }

  user.description = data.description || user.description

  user.disabilities = data.disabilities || user.disabilities

  user.firstName = data.firstName ? cleanSpaces(data.firstName) : user.firstName

  user.gender = data.gender || user.gender

  user.isSubscribed =
    typeof data.isSubscribed !== 'undefined'
      ? data.isSubscribed
      : user.isSubscribed

  user.language = data.language || user.language

  user.lastName = data.lastName ? cleanSpaces(data.lastName) : user.lastName

  user.phone = data.phone || user.phone

  user.showDisabilities =
    typeof data.showDisabilities !== 'undefined'
      ? data.showDisabilities
      : user.showDisabilities

  user.showEmail =
    typeof data.showEmail !== 'undefined' ? data.showEmail : user.showEmail

  user.showPhone =
    typeof data.showPhone !== 'undefined' ? data.showPhone : user.showPhone

  if (data.username && data.username !== user.username) {
    let repeatedUser
    try {
      repeatedUser = await User.findOne({
        username: data.username,
        isArchived: false
      })
    } catch (err) {
      logger.error(
        `User with username ${data.username} failed to be found at edit-user.`
      )
      return next(err)
    }

    if (repeatedUser) {
      return res.status(400).json({ username: 'Is already taken' })
    }

    user.username = data.username
  }

  user.zip = data.zip ? cleanSpaces(data.zip) : user.zip

  user.updatedAt = moment.utc().toDate()

  try {
    await user.save()
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(
      `User ${user.id} failed to be updated at edit-user.\nData: ${JSON.stringify(
        data,
        null,
        2
      )}`
    )
    return next(err)
  }

  const dataResponse = {
    id: user.id,
    avatar: user.avatar,
    description: user.description,
    disabilities: user.disabilities,
    firstName: user.firstName,
    gender: user.gender,
    isSubscribed: user.isSubscribed,
    lastName: user.lastName,
    phone: user.phone,
    showDisabilities: user.showDisabilities,
    showEmail: user.showEmail,
    showPhone: user.showPhone,
    username: user.username,
    zip: user.zip
  }
  return res.status(200).json(dataResponse)
}
