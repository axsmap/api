const moment = require('moment')

const logger = require('../../helpers/logger')
const Venue = require('../../models/venue')

module.exports = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ general: 'Forbidden action' })
  }

  const venueId = req.params.venueId

  let venue
  try {
    venue = await Venue.findOne({ _id: venueId, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Venue not found' })
    }

    logger.error(`Venue ${venueId} failed to be found at delete-venue`)
    return next(err)
  }

  if (!venue) {
    return res.status(404).json({ general: 'Venue not found' })
  }

  venue.isArchived = true
  venue.updatedAt = moment.utc().toDate()

  try {
    await venue.save()
  } catch (err) {
    logger.error(`Venue ${venue.id} failed to be updated at delete-venue`)
    return next(err)
  }

  return res.status(204).json({ general: 'Success' })
}
