const moment = require('moment')

const ActivationTicket = require('../../models/activation-ticket')
const logger = require('../../helpers/logger')
const PasswordTicket = require('../../models/password-ticket')
const RefreshToken = require('../../models/refresh-token')
const User = require('../../models/user')

module.exports = async (req, res, next) => {
  const userId = req.params.userId

  let user
  try {
    user = await User.findOne({ _id: userId, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'User not found' })
    }

    logger.error(`User with Id ${userId} failed to be found at archive-user.`)
    return next(err)
  }

  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }

  if (user.id !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Forbidden action' })
  }

  let activateAccountTicket
  let passwordTicket
  let refreshToken
  try {
    ;[activateAccountTicket, passwordTicket, refreshToken] = await Promise.all([
      ActivationTicket.findOne({ email: user.email }),
      PasswordTicket.findOne({ email: user.email }),
      RefreshToken.findOne({ userId: user.id })
    ])
  } catch (err) {
    logger.error(
      `Activate account ticket, password ticket or refresh token with email ${user.email} failed to be found at archive-user.`
    )
    return next(err)
  }

  if (activateAccountTicket) {
    try {
      await activateAccountTicket.remove()
    } catch (err) {
      logger.error(
        `Activate user ticket with key ${activateAccountTicket.key} failed to be removed at archive-user.`
      )
      return next(err)
    }
  }

  if (passwordTicket) {
    try {
      await passwordTicket.remove()
    } catch (err) {
      logger.error(
        `Password ticket with key ${passwordTicket.key} failed to be removed at archive-user.`
      )
      return next(err)
    }
  }

  if (refreshToken) {
    try {
      await refreshToken.remove()
    } catch (err) {
      logger.error(
        `Refresh token with key ${refreshToken.key} failed to be removed at archive-user.`
      )
      return next(err)
    }
  }

  user.isArchived = true
  user.updatedAt = moment.utc().toDate()

  try {
    await user.save()
  } catch (err) {
    logger.error(
      `User with email ${user.email} failed to be updated at archive-user.`
    )
    return next(err)
  }

  return res.status(200).json({ message: 'Success' })
}
