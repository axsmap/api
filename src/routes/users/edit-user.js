const moment = require('moment')

const { cleanSpaces } = require('../../helpers')
const logger = require('../../helpers/logger')
const { Photo } = require('../../models/photo')
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

  if (
    data.avatar &&
    !data.avatar.includes('default') &&
    data.avatar !== user.avatar
  ) {
    let avatar
    try {
      avatar = await Photo.findOne({ url: data.avatar })
    } catch (err) {
      logger.error(`Avatar ${data.avatar} failed to be found at edit-user`)
      return next(err)
    }

    if (!avatar) {
      return res.status(404).json({ avatar: 'Not found' })
    }

    user.avatar = data.avatar
  } else if (data.avatar === '') {
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
