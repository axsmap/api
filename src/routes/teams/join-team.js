const logger = require('../../helpers/logger')
const { Petition } = require('../../models/petition')
const { Team } = require('../../models/team')

module.exports = async (req, res, next) => {
  const teamId = req.params.teamId

  let team
  try {
    team = await Team.findOne({ _id: teamId, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Team not found' })
    }

    logger.error(`Team ${teamId} failed to be found at join-team`)
    return next(err)
  }

  if (!team) {
    return res.status(404).json({ general: 'Team not found' })
  }

  const eventMembers = team.members.map(m => m.toString())
  if (eventMembers.includes(req.user.id)) {
    return res
      .status(400)
      .json({ general: 'You already are a member in this team' })
  }

  const eventManagers = team.managers.map(m => m.toString())
  if (eventManagers.includes(req.user.id)) {
    return res
      .status(400)
      .json({ general: 'You already are a member in this team' })
  }

  let petition
  try {
    petition = await Petition.findOne({
      team: team.id,
      sender: req.user.id,
      type: 'request-user-team'
    })
  } catch (err) {
    logger.error(
      `Petition from user ${req.user
        .id} to team ${team.id} failed to be found at join-team`
    )
    return next(err)
  }

  if (petition && petition.state === 'pending') {
    return res.status(400).json({
      general: 'You already have a pending petition with this team'
    })
  }

  if (
    petition &&
    (petition.state === 'rejected' || petition.state === 'canceled')
  ) {
    try {
      await petition.remove()
    } catch (err) {
      logger.error(`Petition ${petition.id} failed to be removed at join-team`)
      return next(err)
    }
  }

  const petitionData = {
    team: team.id,
    sender: req.user.id,
    type: 'request-user-team'
  }
  try {
    await Petition.create(petitionData)
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(
      `Petition failed to be created at join-team.\nData: ${JSON.stringify(
        petitionData
      )}`
    )
    return next(err)
  }

  return res.status(200).json({ general: 'Requested' })
}
