const { difference, intersection, pick, trim } = require('lodash')
const moment = require('moment')
const slugify = require('speakingurl')

const logger = require('../../helpers/logger')
const Team = require('../../models/team')

const validateEditTeam = require('./validations')

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

    logger.error(`Team ${teamId} failed to be found at edit-team`)
    return next(err)
  }

  if (!team) {
    return res.status(404).json({ message: 'Team not found' })
  }

  if (
    !team.managers.find(m => m.toString() === req.user.id) &&
    !req.user.isAdmin
  ) {
    return res.status(403).json({ message: 'Forbidden action' })
  }

  const { errors, isValid } = validateEditTeam(req.body)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  team.description = req.body.description || team.description

  if (req.body.managers) {
    let managersToAdd = []
    let managersToRemove = []

    req.body.managers.forEach(m => {
      if (m.startsWith('-')) {
        managersToRemove = [...managersToRemove, m.substring(1)]
      } else {
        managersToAdd = [...managersToAdd, m]
      }
    })

    const teamManagers = team.managers.map(m => m.toString())
    managersToAdd = [...new Set(difference(managersToAdd, teamManagers))]
    managersToRemove = [
      ...new Set(intersection(managersToRemove, teamManagers))
    ]

    if (managersToAdd.length > 0) {
      const teamMembers = team.members.map(m => m.toString())
      const notMember = managersToAdd.find(m => !teamMembers.includes(m))

      if (notMember) {
        return res
          .status(400)
          .json({ managers: `User ${notMember} is not a member of this team` })
      }

      team.managers = [...teamManagers, ...managersToAdd]
    }

    if (managersToRemove.length === team.managers.length) {
      return res
        .status(400)
        .json({ managers: 'Should not remove all the managers' })
    }

    team.managers = team.managers.filter(
      m => !managersToRemove.includes(m.toString())
    )
  }

  if (req.body.members) {
    let membersToRemove = []

    req.body.members.forEach(m => {
      membersToRemove = [...membersToRemove, m.substring(1)]
    })

    const teamMembers = team.members.map(m => m.toString())
    membersToRemove = [...new Set(intersection(membersToRemove, teamMembers))]

    if (membersToRemove.length === team.members.length) {
      return res
        .status(400)
        .json({ members: 'Should not remove all the members' })
    }

    const managersToRemove = team.managers.filter(m =>
      membersToRemove.includes(m.toString())
    )
    if (managersToRemove.length === team.managers.length) {
      return res
        .status(400)
        .json({ membersToRemove: 'Should not remove all the managers' })
    }

    const teamManagers = team.managers.map(m => m.toString())
    team.managers = difference(teamManagers, managersToRemove)

    team.members = team.members.filter(
      m => !membersToRemove.includes(m.toString())
    )
  }

  if (req.body.name && team.name !== trim(req.body.name)) {
    team.name = trim(req.body.name)
    team.slug = slugify(team.name)

    let repeatedTeam
    try {
      repeatedTeam = await Team.findOne({ slug: team.slug, isArchived: false })
    } catch (err) {
      logger.error(`Team ${team.slug} failed to be found at edit-team`)
      return next(err)
    }

    if (repeatedTeam) {
      return res.status(400).json({ name: 'Is already taken' })
    }
  }

  team.updatedAt = moment.utc().toDate()

  try {
    await team.save()
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(`Team ${team.id} failed to be updated at edit-team`)
    return next(err)
  }

  const dataResponse = pick(team, [
    '_id',
    'creator',
    'description',
    'events',
    'managers',
    'members',
    'name',
    'slug'
  ])

  return res.status(200).json(dataResponse)
}
