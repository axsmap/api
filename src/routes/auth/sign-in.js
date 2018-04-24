const crypto = require('crypto')

const jwt = require('jsonwebtoken')
const moment = require('moment')

const logger = require('../../helpers/logger')
const { RefreshToken } = require('../../models/refresh-token')
const { User } = require('../../models/user')

const { validateSignIn } = require('./validations')

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateSignIn(req.body)
  if (!isValid) {
    return res.status(400).json(errors)
  }

  const email = req.body.email
  const password = req.body.password

  let user
  try {
    user = await User.findOne({ email, isArchived: false })
  } catch (err) {
    logger.error(`User with email ${email} failed to be found at sign-in.`)
    return next(err)
  }

  if (!user) {
    return res.status(400).json({ general: 'Email or password incorrect' })
  }

  if (user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  if (!user.hashedPassword) {
    return res.status(400).json({ general: 'Email or password incorrect' })
  }

  const passwordMatches = user.comparePassword(password)

  if (!passwordMatches) {
    return res.status(400).json({ general: 'Email or password incorrect' })
  }

  const userId = user.id
  const today = moment.utc()
  const expiresAt = today.add(14, 'days').toDate()
  const key = `${userId}${crypto.randomBytes(28).toString('hex')}`

  let refreshToken
  try {
    refreshToken = await RefreshToken.findOneAndUpdate(
      { userId },
      { expiresAt, key, userId },
      { new: true, setDefaultsOnInsert: true, upsert: true }
    )
  } catch (err) {
    logger.error(
      `Refresh Token for userId ${userId} failed to be created or updated at sign-in.`
    )
    return next(err)
  }

  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: 36000
  })
  return res.status(200).json({ refreshToken: refreshToken.key, token })
}
