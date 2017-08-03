const crypto = require('crypto')

const jwt = require('jsonwebtoken')
const moment = require('moment')

const logger = require('../../helpers/logger')
const RefreshToken = require('../../models/refresh-token')
const User = require('../../models/user')

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
    return res.status(400).json({ message: 'Email or password incorrect' })
  }

  if (user.isBlocked) {
    return res.status(423).json({ message: 'You are blocked' })
  }

  const passwordMatches = user.comparePassword(password)

  if (!passwordMatches) {
    return res.status(400).json({ message: 'Email or password incorrect' })
  }

  const userID = user.id
  const today = moment.utc()
  const expiresAt = today.add(14, 'days').toDate()
  const key = `${userID}${crypto.randomBytes(28).toString('hex')}`

  let refreshToken
  try {
    refreshToken = await RefreshToken.findOneAndUpdate(
      { userID },
      { expiresAt, key, userID },
      { new: true, setDefaultsOnInsert: true, upsert: true }
    )
  } catch (err) {
    logger.error(
      `Refresh Token for userID ${userID} failed to be created or updated at sign-in.`
    )
    return next(err)
  }

  const token = jwt.sign({ userID }, process.env.JWT_SECRET, {
    expiresIn: 3600
  })
  return res.status(200).json({ refreshToken: refreshToken.key, token })
}
