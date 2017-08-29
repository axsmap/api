const moment = require('moment')

const logger = require('../../helpers/logger')
const Team = require('../../models/team')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ message: 'You are blocked' })
  }

  const teamId = req.params.teamId

  let team
  try {
    team = await Team.findOne({ _id: teamId, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Team not found' })
    }

    logger.error(`Team ${teamId} failed to be found at leave-team`)
    return next(err)
  }

  if (!team) {
    return res.status(404).json({ message: 'Team not found' })
  }

  if (team.managers.find(m => m.toString() === req.user.id)) {
    team.managers = team.managers.filter(m => m.toString() !== req.user.id)
    team.members = team.members.filter(m => m.toString() !== req.user.id)

    if (team.managers.length === 0) {
      return res.status(400).json({
        message:
          'You cannot leave the team because there will not be more managers'
      })
    }
  } else if (team.members.find(m => m.toString() === req.user.id)) {
    team.members = team.members.filter(m => m.toString() !== req.user.id)
  } else {
    return res.status(400).json({ message: "You don't belong to this team" })
  }

  team.updatedAt = moment.utc().toDate()

  try {
    await team.save()
  } catch (err) {
    logger.error(`Team ${team.id} failed to be updated at leave-team`)
    return next(err)
  }

  req.user.teams = req.user.teams.filter(t => t.toString() !== team.id)
  req.user.updatedAt = moment.utc().toDate()

  try {
    await req.user.save()
  } catch (err) {
    logger.error(`User ${req.user.id} failed to be updated at leave-team`)
    return next(err)
  }

  return res.status(200).json({ message: 'Success' })
}
