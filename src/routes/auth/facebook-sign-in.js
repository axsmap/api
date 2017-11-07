const crypto = require('crypto')

const axios = require('axios')
const jwt = require('jsonwebtoken')
const moment = require('moment')
const randomstring = require('randomstring')
const slugify = require('speakingurl')

const logger = require('../../helpers/logger')
const { RefreshToken } = require('../../models/refresh-token')
const { User } = require('../../models/user')

const { validateFacebookSignIn } = require('./validations')

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateFacebookSignIn(req.body)
  if (!isValid) {
    return res.status(400).json(errors)
  }

  const code = req.body.code

  const getTokenUrl = 'https://graph.facebook.com/v2.10/oauth/access_token'
  const getTokenParams = {
    code,
    client_id: process.env.FACEBOOK_CLIENT_ID,
    client_secret: process.env.FACEBOOK_CLIENT_SECRET,
    redirect_uri: `${process.env.APP_URL}/auth/facebook`
  }
  let getTokenResponse
  try {
    getTokenResponse = await axios.get(getTokenUrl, { params: getTokenParams })
  } catch (err) {
    return res.status(400).json({ general: 'Invalid code' })
  }

  const facebookToken = getTokenResponse.data.access_token

  const getProfileUrl =
    'https://graph.facebook.com/v2.10/me?fields=id,email,first_name,last_name,locale'
  const getProfileOptions = {
    params: {
      access_token: facebookToken
    }
  }
  let getProfileResponse
  try {
    getProfileResponse = await axios.get(getProfileUrl, getProfileOptions)
  } catch (err) {
    logger.error('Profile data failed to be found at facebook-sign-in.')
    return next(err)
  }

  const email = getProfileResponse.data.email
    ? getProfileResponse.data.email
    : ''
  const facebookId = getProfileResponse.data.id
  let user
  try {
    user = await User.findOne({
      $or: [{ email }, { facebookId }],
      isArchived: false
    })
  } catch (err) {
    logger.error(
      `User with facebookId ${facebookId} and email ${email} failed to be found at facebook-sign-in.`
    )
    return next(err)
  }

  let accessToken
  let refreshToken

  if (!user) {
    console.log(getProfileResponse.data)
    const userData = {
      email: getProfileResponse.data.email ? getProfileResponse.data.email : '',
      facebookId: getProfileResponse.data.id,
      firstName: getProfileResponse.data.first_name,
      lastName: getProfileResponse.data.last_name
    }
    userData.username = `${slugify(userData.firstName)}-${slugify(
      userData.lastName
    )}`

    let repeatedUsers
    try {
      repeatedUsers = await User.find({
        username: userData.username,
        isArchived: false
      })
    } catch (err) {
      logger.error('Users failed to be found at facebook-sign-in.')
      return next(err)
    }

    if (repeatedUsers && repeatedUsers.length > 0) {
      let repeatedUser
      do {
        userData.username = `${slugify(userData.firstName)}-${slugify(
          userData.lastName
        )}-${randomstring.generate({
          length: 5,
          capitalization: 'lowercase'
        })}`

        try {
          repeatedUser = await User.findOne({
            username: userData.username,
            isArchived: false
          })
        } catch (err) {
          logger.error(
            `User with username ${userData.username} failed to be found at facebook-sign-in.`
          )
          return next(err)
        }
      } while (repeatedUser && repeatedUser.username === userData.username)
    }

    const getPictureUrl = `https://graph.facebook.com/v2.10/${userData.facebookId}/picture`
    const getPictureOptions = {
      params: {
        access_token: accessToken,
        redirect: false,
        type: 'large'
      }
    }
    let getPictureResponse
    try {
      getPictureResponse = await axios.get(getPictureUrl, getPictureOptions)
    } catch (err) {
      logger.error('User picture failed to be found at facebook-sign-in.')
      return next(err)
    }

    const isSilhouette = getPictureResponse.data.data.is_silhouette
    if (!isSilhouette) {
      userData.avatar = getPictureResponse.data.data.url
    }

    try {
      user = await User.create(userData)
    } catch (err) {
      logger.error(
        `User failed to be created at facebook-sign-in.\nData: ${JSON.stringify(
          userData
        )}`
      )
      return next(err)
    }

    const today = moment.utc()
    const expiresAt = today.add(14, 'days').toDate()
    const refreshTokenData = {
      expiresAt,
      key: `${user.id}${crypto.randomBytes(28).toString('hex')}`,
      userId: user.id
    }

    try {
      refreshToken = await RefreshToken.create(refreshTokenData)
    } catch (err) {
      logger.error(
        `Refresh token failed to be created at facebook-sign-in.\nData: ${JSON.stringify(
          refreshTokenData
        )}`
      )
      return next(err)
    }
  } else {
    const userId = user.id
    const today = moment.utc()
    const expiresAt = today.add(14, 'days').toDate()
    const key = `${userId}${crypto.randomBytes(28).toString('hex')}`

    try {
      refreshToken = await RefreshToken.findOneAndUpdate(
        { userId },
        { expiresAt, key, userId },
        { new: true, setDefaultsOnInsert: true, upsert: true }
      )
    } catch (err) {
      logger.error(
        `Refresh Token for userId ${userId} failed to be created or updated at facebook-sign-in.`
      )
      return next(err)
    }
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: 3600
  })
  refreshToken = refreshToken.key

  return res.status(200).json({ token, refreshToken })
}
