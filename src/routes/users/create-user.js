const crypto = require('crypto')

const moment = require('moment')
const { pick, trim } = require('lodash')
const randomstring = require('randomstring')
const slugify = require('speakingurl')

const logger = require('../../helpers/logger')
const { RefreshToken } = require('../../models/refresh-token')
const { User } = require('../../models/user')

const { validateCreateUser } = require('./validations')

module.exports = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ general: 'Forbidden action' })
  }

  const { errors, isValid } = validateCreateUser(req.body)
  if (!isValid) {
    return res.status(400).json(errors)
  }

  const userData = pick(req.body, [
    'description',
    'disabilities',
    'email',
    'firstName',
    'gender',
    'isSubscribed',
    'lastName',
    'password',
    'phone',
    'showDisabilities',
    'showEmail',
    'showPhone',
    'username',
    'zip'
  ])
  userData.firstName = trim(userData.firstName)
  userData.lastName = trim(userData.lastName)

  let usernameSent = true

  if (!userData.username) {
    userData.username = `${slugify(userData.firstName)}-${slugify(
      userData.lastName
    )}`
    usernameSent = false
  }

  let repeatedUsers
  try {
    repeatedUsers = await User.find({
      $or: [{ email: userData.email }, { username: userData.username }],
      isArchived: false
    })
  } catch (err) {
    logger.error('Users failed to be found at create-user.')
    return next(err)
  }

  if (repeatedUsers && repeatedUsers.length > 0) {
    for (const user of repeatedUsers) {
      if (user.email === userData.email) {
        return res.status(400).json({ email: 'Is already taken' })
      } else if (usernameSent && user.username === userData.username) {
        return res.status(400).json({ username: 'Is already taken' })
      }

      let repeatedUser
      do {
        userData.username = `${slugify(userData.firstName)}-${slugify(
          userData.lastName
        )}-${randomstring.generate({ length: 5, capitalization: 'lowercase' })}`

        try {
          repeatedUser = await User.findOne({
            username: userData.username,
            isArchived: false
          })
        } catch (err) {
          logger.error(
            `User with username ${userData.username} failed to be found at create-user.`
          )
          return next(err)
        }
      } while (repeatedUser && repeatedUser.username === userData.username)
    }
  }

  let user
  try {
    user = await User.create(userData)
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(
      `User with email ${userData.email} failed to be created at create-user.`
    )
    return next(err)
  }

  const refreshTokenData = {
    expiresAt: moment.utc().add(14, 'days').toDate(),
    key: `${user.id}${crypto.randomBytes(40).toString('hex')}`,
    userId: user.id
  }
  try {
    await RefreshToken.create(refreshTokenData)
  } catch (err) {
    logger.error(
      `Refresh token with userId ${refreshTokenData.userId} failed to be created at create-user.`
    )
    return next(err)
  }

  const dataResponse = pick(user, [
    '_id',
    'description',
    'disabilities',
    'email',
    'firstName',
    'gender',
    'isSubscribed',
    'lastName',
    'phone',
    'showDisabilities',
    'showEmail',
    'showPhone',
    'username',
    'zip'
  ])
  return res.status(201).json(dataResponse)
}
