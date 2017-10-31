const { pick } = require('lodash')

const logger = require('../../helpers/logger')
const User = require('../../models/user')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  const userId = req.params.userId

  let user
  try {
    user = await User.findOne({ _id: userId, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'User not found' })
    }

    logger.error(`User with Id ${userId} failed to be found at get-user.`)
    return next(err)
  }

  if (!user) {
    return res.status(404).json({ general: 'User not found' })
  }

  let visibleFields
  if (req.user.isAdmin) {
    visibleFields = [
      '_id',
      'avatar',
      'description',
      'disabilities',
      'email',
      'events',
      'firstName',
      'gender',
      'isAdmin',
      'isArchived',
      'isBlocked',
      'isSubscribed',
      'lastName',
      'phone',
      'showDisabilities',
      'showEmail',
      'showPhone',
      'teams',
      'username',
      'zip'
    ]
  } else if (req.user.id === user.id) {
    visibleFields = [
      '_id',
      'avatar',
      'description',
      'disabilities',
      'email',
      'events',
      'firstName',
      'gender',
      'isSubscribed',
      'lastName',
      'phone',
      'showDisabilities',
      'showEmail',
      'showPhone',
      'teams',
      'username',
      'zip'
    ]
  } else {
    visibleFields = [
      '_id',
      'avatar',
      'description',
      'events',
      'firstName',
      'lastName',
      'gender',
      'lastName',
      'teams',
      'username',
      'zip'
    ]

    if (user.showDisabilities) {
      visibleFields.push('disabilities')
    }
    if (user.showEmail) {
      visibleFields.push('email')
    }
    if (user.showPhone) {
      visibleFields.push('phone')
    }
  }

  const dataResponse = pick(user, visibleFields)
  return res.status(200).json(dataResponse)
}
