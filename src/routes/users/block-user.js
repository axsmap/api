const moment = require('moment')

const logger = require('../../helpers/logger')
const User = require('../../models/user')

module.exports = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Forbidden action' })
  }

  const userID = req.params.userID

  let user
  try {
    user = await User.findOne({ _id: userID, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'User not found' })
    }

    logger.error(`User with ID ${userID} failed to be found at block-user.`)
    return next(err)
  }

  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }

  user.isBlocked = true
  user.updatedAt = moment.utc().toDate()

  try {
    await user.save()
  } catch (err) {
    logger.error(`User with ID ${user.id} failed to be updated at block-user.`)
    return next(err)
  }

  return res.status(200).json({ message: 'Success' })
}
