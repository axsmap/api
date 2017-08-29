const logger = require('../../helpers/logger')
const User = require('../../models/user')

module.exports = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Forbidden action' })
  }

  const userId = req.params.userId

  let user
  try {
    user = await User.findOne({ _id: userId, isArchived: true })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Archived user not found' })
    }

    logger.error(`User with Id ${userId} failed to be found at delete-user.`)
    return next(err)
  }

  if (!user) {
    return res.status(404).json({ message: 'Archived user not found' })
  }

  try {
    await user.remove()
  } catch (err) {
    logger.error(
      `User with email ${user.email} failed to be deleted at delete-user.`
    )
    return next(err)
  }

  return res.status(204).json({ message: 'Success' })
}
