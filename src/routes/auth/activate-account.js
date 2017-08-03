const crypto = require('crypto')

const moment = require('moment')
const randomstring = require('randomstring')
const slugify = require('speakingurl')

const ActivationTicket = require('../../models/activation-ticket')
const logger = require('../../helpers/logger')
const RefreshToken = require('../../models/refresh-token')
const User = require('../../models/user')

const { validateActivateAccount } = require('./validations')

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateActivateAccount(req.body)
  if (!isValid) {
    return res.status(400).json(errors)
  }

  const key = req.body.key

  let activationTicket
  try {
    activationTicket = await ActivationTicket.findOne({ key })
  } catch (err) {
    logger.error(
      `Activation ticket with key ${key} failed to be found at activate-account.`
    )
    return next(err)
  }

  if (!activationTicket) {
    return res.status(404).json({ message: 'Activation ticket not found' })
  }

  let expiresAt = moment(activationTicket.expiresAt).utc()
  const now = moment.utc()
  if (expiresAt.isBefore(now)) {
    try {
      await activationTicket.remove()
    } catch (err) {
      logger.error(
        `Activation ticket with key ${activationTicket.key} failed to be deleted at activate-account.`
      )
      return next(err)
    }

    return res.status(400).json({ message: 'Activation ticket expired' })
  }

  const userData = activationTicket.userData
  userData.email = activationTicket.email

  let repeatedUsers
  try {
    repeatedUsers = await User.find({
      $or: [{ email: userData.email }, { username: userData.username }],
      isArchived: false
    })
  } catch (err) {
    logger.error('Users failed to be found at activate-account.')
    return next(err)
  }

  if (repeatedUsers && repeatedUsers.length > 0) {
    for (const user of repeatedUsers) {
      if (user.email === userData.email) {
        return res.status(400).json({ email: 'Is already taken' })
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
            `User with username ${userData.username} failed to be found at activate-account.`
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
    logger.error(
      `User failed to be created at activate-account.\nData: ${JSON.stringify(
        userData
      )}`
    )
    return next(err)
  }

  const today = moment.utc()
  expiresAt = today.add(14, 'days').toDate()
  const refreshTokenData = {
    expiresAt,
    key: `${user.id}${crypto.randomBytes(28).toString('hex')}`,
    userId: user.id
  }

  try {
    await RefreshToken.create(refreshTokenData)
  } catch (err) {
    logger.error(
      `Refresh token failed to be created at activate-account.\nData: ${JSON.stringify(
        refreshTokenData
      )}`
    )
    return next(err)
  }

  try {
    await activationTicket.remove()
  } catch (err) {
    logger.error(
      `Activation ticket with key ${activationTicket.key} failed to be deleted at activate-account.`
    )
    return next(err)
  }

  return res.status(201).json({ message: 'Success' })
}
