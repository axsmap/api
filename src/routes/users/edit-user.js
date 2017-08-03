const moment = require('moment')
const { pick, trim } = require('lodash')

const logger = require('../../helpers/logger')
const User = require('../../models/user')

const { validateEditUser } = require('./validations')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ message: 'You are blocked' })
  }

  const userID = req.params.userID

  let user
  try {
    user = await User.findOne({ _id: userID, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'User not found' })
    }

    logger.error(`User with ID ${userID} failed to be found at edit-user.`)
    return next(err)
  }

  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }

  if (user.id !== req.user.id && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Forbidden action' })
  }

  const { errors, isValid } = validateEditUser(req.body)
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
    'phone',
    'showDisabilities',
    'showEmail',
    'showPhone',
    'username',
    'zip'
  ])

  user.description = userData.description || user.description
  user.disabilities = userData.disabilities || user.disabilities

  if (userData.email && userData.email !== user.email) {
    let repeatedUser
    try {
      repeatedUser = await User.findOne({
        email: userData.email,
        isArchived: false
      })
    } catch (err) {
      logger.error(
        `User with email ${userData.email} failed to be found at edit-user.`
      )
      return next(err)
    }

    if (repeatedUser) {
      return res.status(400).json({ email: 'Is already taken' })
    }

    user.email = userData.email
  }

  user.firstName = userData.firstName
    ? trim(userData.firstName)
    : user.firstName
  user.gender = userData.gender || user.gender
  user.isSubscribed = userData.isSubscribed || user.isSubscribed
  user.lastName = userData.lastName ? trim(userData.lastName) : user.lastName
  user.phone = userData.phone || user.phone
  user.showDisabilities = userData.showDisabilities || user.showDisabilities
  user.showEmail = userData.showEmail || user.showEmail
  user.showPhone = userData.showPhone || user.showPhone

  if (userData.username && userData.username !== user.username) {
    let repeatedUser
    try {
      repeatedUser = await User.findOne({
        username: userData.username,
        isArchived: false
      })
    } catch (err) {
      logger.error(
        `User with username ${userData.username} failed to be found at edit-user.`
      )
      return next(err)
    }

    if (repeatedUser) {
      return res.status(400).json({ username: 'Is already taken' })
    }

    user.username = userData.username
  }

  user.zip = userData.zip || user.zip
  user.updatedAt = moment.utc().toDate()

  try {
    await user.save()
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(`User with ID ${user.id} failed to be updated at edit-user.`)
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
  return res.status(200).json(dataResponse)
}
