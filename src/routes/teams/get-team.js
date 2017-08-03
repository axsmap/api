const logger = require('../../helpers/logger')
const Team = require('../../models/team')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ message: 'You are blocked' })
  }

  const teamID = req.params.teamID

  let team
  try {
    team = await Team.findOne({ _id: teamID, isArchived: false }).select(
      '-__v -createdAt -isArchived -updatedAt'
    )
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Team not found' })
    }

    logger.error(`Team ${teamID} failed to be found at get-team`)
    return next(err)
  }

  if (team) {
    return res.status(200).json(team)
  }

  return res.status(404).json({ message: 'Team not found' })
}
