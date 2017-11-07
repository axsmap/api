const moment = require('moment')
const { pick, trim } = require('lodash')
const slugify = require('speakingurl')

const logger = require('../../helpers/logger')
const { Team } = require('../../models/team')

const { validateCreateTeam } = require('./validations')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  const { errors, isValid } = validateCreateTeam(req.body)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  const data = pick(req.body, ['description', 'name'])
  data.name = trim(data.name)
  data.slug = slugify(data.name)

  let repeatedTeam
  try {
    repeatedTeam = await Team.findOne({ slug: data.slug, isArchived: false })
  } catch (err) {
    logger.error(`Team ${data.slug} failed to be found at create-team`)
    return next(err)
  }

  if (repeatedTeam) {
    return res.status(400).json({ name: 'Is already taken' })
  }

  data.creator = req.user.id
  data.managers = [req.user.id]
  data.members = [req.user.id]

  let team
  try {
    team = await Team.create(data)
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(`Team ${data.slug} failed to be created at create-team`)
    return next(err)
  }

  req.user.teams = [...req.user.teams, team.id]
  req.user.updatedAt = moment.utc().toDate()

  try {
    await req.user.save()
  } catch (err) {
    logger.error(`User ${req.user.id} failed to be updated at create-team`)
    return next(err)
  }

  const dataResponse = pick(team, [
    '_id',
    'creator',
    'description',
    'managers',
    'members',
    'name',
    'slug'
  ])

  return res.status(201).json(dataResponse)
}
