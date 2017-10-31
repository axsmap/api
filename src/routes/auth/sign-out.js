const logger = require('../../helpers/logger')
const RefreshToken = require('../../models/refresh-token')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  let refreshToken
  try {
    refreshToken = await RefreshToken.findOne({ userId: req.user.id })
  } catch (err) {
    logger.error(
      `Refresh token with userId ${req.user.id} failed to be found at sign-out.`
    )
    return next(err)
  }

  if (!refreshToken) {
    return res.status(204).json({ general: 'Success' })
  }

  try {
    await refreshToken.remove()
  } catch (err) {
    logger.error(
      `Refresh token with userId ${req.user
        .id} failed to be deleted at sign-out.`
    )
    return next(err)
  }

  return res.status(204).json({ general: 'Success' })
}
