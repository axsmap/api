const Event = require('../../models/event')
const logger = require('../../helpers/logger')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ message: 'You are blocked' })
  }

  const eventId = req.params.eventId

  let event
  try {
    event = await Event.findOne({ _id: eventId }).select(
      '-__v -createdAt -updatedAt'
    )
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Event not found' })
    }

    logger.error(`Event ${eventId} failed to be found at get-event`)
    return next(err)
  }

  if (event) {
    return res.status(200).json(event)
  }

  return res.status(404).json({ message: 'Event not found' })
}
