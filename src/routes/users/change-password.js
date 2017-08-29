const moment = require('moment')

const logger = require('../../helpers/logger')
const RefreshToken = require('../../models/refresh-token')

const { validateChangePassword } = require('./validations')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ message: 'You are blocked' })
  }

  const { errors, isValid } = validateChangePassword(req.body)
  if (!isValid) {
    return res.status(400).json(errors)
  }

  const oldPassword = req.body.oldPassword
  const password = req.body.password

  const passwordMatches = req.user.comparePassword(oldPassword)

  if (!passwordMatches) {
    return res.status(400).json({ oldPassword: 'Wrong password' })
  }

  let refreshToken
  try {
    refreshToken = await RefreshToken.findOne({ userId: req.user.id })
  } catch (err) {
    logger.error(
      `Refresh Token with userId ${req.user
        .id} failed to be found at change-password.`
    )
    return next(err)
  }

  if (refreshToken) {
    try {
      await refreshToken.remove()
    } catch (err) {
      logger.error(
        `Refresh Token with key ${refreshToken.key} failed to be removed at change-password.`
      )
      return next(err)
    }
  }

  req.user.password = password
  req.user.updatedAt = moment.utc().toDate()

  try {
    req.user.save()
  } catch (err) {
    logger.error(
      `User with Id ${req.user.id} failed to be updated at change-password.`
    )
    return next(err)
  }

  return res.status(200).json({ message: 'Success' })
}
