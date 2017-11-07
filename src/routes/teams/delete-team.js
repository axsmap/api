const moment = require('moment')

const { Event } = require('../../models/event')
const logger = require('../../helpers/logger')
const { Team } = require('../../models/team')
const { User } = require('../../models/user')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  const teamId = req.params.teamId

  let team
  try {
    team = await Team.findOne({ _id: teamId, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Team not found' })
    }

    logger.error(`Team ${teamId} failed to be found at delete-team`)
    return next(err)
  }

  if (!team) {
    return res.status(404).json({ general: 'Team not found' })
  }

  if (
    !team.managers.find(m => m.toString() === req.user.id) &&
    !req.user.isAdmin
  ) {
    return res.status(403).json({ general: 'Forbidden action' })
  }

  let archiveTeam = false

  if (team.events && team.events.length > 0) {
    const teamEventsPromises = team.events.map(e =>
      Event.findOne({ _id: e.toString() })
    )

    let teamEvents
    try {
      teamEvents = await Promise.all(teamEventsPromises)
    } catch (err) {
      logger.error('A team event failed to be found at delete-team')
      return next(err)
    }

    for (const event of teamEvents) {
      const endDate = moment(event.endDate).utc()
      const endOfToday = moment.utc().endOf('day')
      if (endDate.isBefore(endOfToday)) {
        event.teams = event.teams.filter(t => t.toString() !== team.id)
        event.updatedAt = moment.utc().toDate()

        try {
          await event.save()
        } catch (err) {
          logger.error(`Event ${event.id} failed to be updated at delete-team`)
          return next(err)
        }
      } else {
        archiveTeam = true
      }
    }
  }

  const teamMembersPromises = team.members.map(m =>
    User.findOne({ _id: m.toString() })
  )

  let teamMembers
  try {
    teamMembers = await Promise.all(teamMembersPromises)
  } catch (err) {
    logger.error('A team member failed to be found at delete-team')
    return next(err)
  }

  for (const member of teamMembers) {
    member.teams = member.teams.filter(t => t.toString() !== team.id)
    member.updatedAt = moment.utc().toDate()

    try {
      await member.save()
    } catch (err) {
      logger.error(`Member ${member.id} failed to be updated at delete-team`)
      return next(err)
    }
  }

  if (archiveTeam) {
    team.isArchived = true
    team.updatedAt = moment.utc().toDate()

    try {
      await team.save()
    } catch (err) {
      logger.error(`Team ${team.id} failed to be updated at delete-team`)
      return next(err)
    }
  } else {
    try {
      await team.remove()
    } catch (err) {
      logger.error(`Team ${team.id} failed to be removed at delete-team`)
      return next(err)
    }
  }

  return res.status(204).json({ general: 'Success' })
}
