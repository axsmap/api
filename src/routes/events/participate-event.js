const moment = require('moment')

const Event = require('../../models/event')
const logger = require('../../helpers/logger')
const Team = require('../../models/team')

const { validateParticipateEvent } = require('./validations')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ message: 'You are blocked' })
  }

  const eventId = req.params.eventId

  let event
  try {
    event = await Event.findOne({ _id: eventId })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Event not found' })
    }

    logger.error(`Event ${eventId} failed to be found at participate-event`)
    return next(err)
  }

  if (!event) {
    return res.status(404).json({ message: 'Event not found' })
  }

  if (!event.isPublic) {
    return res.status(423).json({
      message: 'You cannot participate, without a petition, in a private event'
    })
  }

  const { errors, isValid } = validateParticipateEvent(req.body)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  const teamId = req.body.teamId

  if (teamId) {
    if (event.teams.find(t => t.toString() === teamId)) {
      return res
        .status(400)
        .json({ message: `Team ${teamId} already participates in this` })
    }

    let team
    try {
      team = await Team.findOne({ _id: teamId })
    } catch (err) {
      logger.error(`Team ${teamId} failed to be found at participate-event`)
      return next(err)
    }

    if (!team) {
      return res.status(404).json({ team: 'Team not found' })
    } else if (!team.managers.find(m => m.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Forbidden action' })
    }

    event.teams = [...event.teams, teamId]

    team.events = [...team.events, event.id]
    team.updatedAt = moment.utc().toDate()

    try {
      await team.save()
    } catch (err) {
      logger.error(`Team ${team.id} failed to be updated at participate-event`)
      return next(err)
    }
  } else if (event.participants.find(p => p.toString() === req.user.id)) {
    return res.status(400).json({ message: 'You already participate in this' })
  } else {
    event.participants = [...event.participants, req.user.id]

    req.user.events = [...req.user.events, event.id]
    req.user.updatedAt = moment.utc().toDate()

    try {
      await req.user.save()
    } catch (err) {
      logger.error(
        `User ${req.user.id} failed to be updated at participate-event`
      )
      return next(err)
    }
  }

  event.updatedAt = moment.utc().toDate()

  try {
    await event.save()
  } catch (err) {
    logger.error(`Event ${event.id} failed to be updated at participate-event`)
    return next(err)
  }

  return res.status(200).json({ message: 'Success' })
}
