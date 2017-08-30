const axios = require('axios')
const randomstring = require('randomstring')
const slugify = require('speakingurl')

const logger = require('../../helpers/logger')
const User = require('../../models/user')

const { validateFacebookSignIn } = require('./validations')

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateFacebookSignIn(req.body)
  if (!isValid) {
    return res.status(400).json(errors)
  }

  let accessToken = req.body.accessToken

  const debugTokenUrl = `https://graph.facebook.com/v2.10/debug_token?input_token=${accessToken}`
  const debugTokenOptions = {
    params: {
      access_token: accessToken
    }
  }
  let debugTokenResponse
  try {
    debugTokenResponse = await axios.get(debugTokenUrl, debugTokenOptions)
  } catch (err) {
    return res.status(400).json({ message: 'Invalid token' })
  }

  const tokenIsValid = debugTokenResponse.data.data.is_valid
  if (!tokenIsValid) {
    return res.status(401).json({ message: 'Expired token' })
  }

  const getLongLivedTokenUrl =
    'https://graph.facebook.com/v2.10/oauth/access_token'
  const getLongLivedTokenOptions = {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      fb_exchange_token: accessToken
    }
  }
  let getLongLivedTokenResponse
  try {
    getLongLivedTokenResponse = await axios.get(
      getLongLivedTokenUrl,
      getLongLivedTokenOptions
    )
  } catch (err) {
    logger.error('Long lived token failed to be found at facebook-sign-in.')
    return next(err)
  }

  accessToken = getLongLivedTokenResponse.data.access_token

  const getUserUrl =
    'https://graph.facebook.com/v2.10/me?fields=id,email,first_name,last_name'
  const getUserOptions = {
    params: {
      access_token: accessToken
    }
  }
  let getUserResponse
  try {
    getUserResponse = await axios.get(getUserUrl, getUserOptions)
  } catch (err) {
    logger.error('User data failed to be found at facebook-sign-in.')
    return next(err)
  }

  const userData = {
    facebookId: getUserResponse.data.id,
    firstName: getUserResponse.data.first_name,
    lastName: getUserResponse.data.last_name
  }

  if (getUserResponse.data.email) {
    userData.email = getUserResponse.data.email
  }

  let user
  try {
    user = await User.findOne({
      facebookId: userData.facebookId,
      isArchived: false
    })
  } catch (err) {
    logger.error(
      `User with facebookId ${userData.facebookId} failed to be found at facebook-sign-in.`
    )
    return next(err)
  }

  if (!user) {
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
  }

  return res.status(200).json({ accessToken, facebookId: user.facebookId })
}
