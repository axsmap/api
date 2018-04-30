const crypto = require('crypto')

const jwt = require('jsonwebtoken')
const moment = require('moment')

const { connectToDatabase } = require('../../helpers/db')
const { RefreshToken } = require('../../models/refresh-token')
const { logError, sendResponse } = require('../../helpers')
const { User } = require('../../models/user')

const { validateSignIn } = require('./validations')

module.exports.signIn = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false

  process.on('uncaughtException', err => {
    logError('Uncaught exception', err)
    return sendResponse(500, { general: 'Something went wrong' }, callback)
  })
  process.on('unhandledRejection', err => {
    logError('Unhandled rejection', err)
    return sendResponse(500, { general: 'Something went wrong' }, callback)
  })

  try {
    await connectToDatabase()
  } catch (err) {
    logError('Error while connecting to DB', err)
    return sendResponse(500, { general: 'Something went wrong' }, callback)
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch (err) {
    return sendResponse(400, { general: 'Invalid JSON format' }, callback)
  }

  const { errors, isValid } = validateSignIn(body)
  if (!isValid) {
    return sendResponse(400, errors, callback)
  }

  const email = body.email
  const password = body.password

  let user
  try {
    user = await User.findOne({ email, isArchived: false })
  } catch (err) {
    logError(`User with email ${email} failed to be found at sign-in.`, err)
    return sendResponse(500, { general: 'Something went wrong' }, callback)
  }

  if (!user) {
    return sendResponse(
      400,
      { general: 'Email or password incorrect' },
      callback
    )
  }

  if (user.isBlocked) {
    return sendResponse(423, { general: 'You are blocked' }, callback)
  }

  if (!user.hashedPassword) {
    return sendResponse(
      400,
      { general: 'Email or password incorrect' },
      callback
    )
  }

  const passwordMatches = user.comparePassword(password)

  if (!passwordMatches) {
    return sendResponse(
      400,
      { general: 'Email or password incorrect' },
      callback
    )
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
    logError(
      `Refresh Token for userId ${userId} failed to be created or updated at sign-in.`,
      err
    )
    return sendResponse(500, { general: 'Something went wrong' }, callback)
  }

  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: 36000
  })
  return sendResponse(200, { refreshToken: refreshToken.key, token }, callback)
}
