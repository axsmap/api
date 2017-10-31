const logger = require('../../helpers/logger')
const Team = require('../../models/team')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  const teamId = req.params.teamId

  let team
  try {
    team = await Team.findOne({ _id: teamId, isArchived: false }).select(
      '-__v -createdAt -isArchived -updatedAt'
    )
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Team not found' })
    }

    logger.error(`Team ${teamId} failed to be found at get-team`)
    return next(err)
  }

  if (team) {
    return res.status(200).json(team)
  }

  return res.status(404).json({ general: 'Team not found' })
}
