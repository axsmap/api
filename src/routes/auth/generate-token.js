const jwt = require('jsonwebtoken')
const moment = require('moment')

const logger = require('../../helpers/logger')
const { RefreshToken } = require('../../models/refresh-token')

const { validateGenerateToken } = require('./validations')

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateGenerateToken(req.body)
  if (!isValid) {
    return res.status(400).json(errors)
  }

  const key = req.body.key

  let refreshToken
  try {
    refreshToken = await RefreshToken.findOne({ key })
  } catch (err) {
    logger.error(
      `Refresh Token with key ${key} failed to be found at generate-token.`
    )
    return next(err)
  }

  if (!refreshToken) {
    return res.status(404).json({ general: 'Refresh Token not found' })
  }

  const expiresAt = moment(refreshToken.expiresAt).utc()
  const today = moment.utc()
  if (expiresAt.isBefore(today)) {
    try {
      await refreshToken.remove()
    } catch (err) {
      logger.error(
        `Refresh Token with key ${refreshToken.key} failed to be removed at generate-token.`
      )
      return next(err)
    }

    return res.status(401).json({ general: 'Refresh Token expired' })
  }

  const token = jwt.sign(
    { userId: refreshToken.userId },
    process.env.JWT_SECRET,
    {
      expiresIn: 3600
    }
  )
  return res.status(200).json({ token })
}
