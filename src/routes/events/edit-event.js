const { difference, intersection, pick, trim } = require('lodash')
const moment = require('moment')
const slugify = require('speakingurl')

const { Event } = require('../../models/event')
const logger = require('../../helpers/logger')
const { Team } = require('../../models/team')
const { User } = require('../../models/user')

const { validateEditEvent } = require('./validations')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  const eventId = req.params.eventId

  let event
  try {
    event = await Event.findOne({ _id: eventId })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ general: 'Event not found' })
    }

    logger.error(`Event ${eventId} failed to be found at edit-event`)
    return next(err)
  }

  if (!event) {
    return res.status(404).json({ general: 'Event not found' })
  }

  if (
    !event.managers.find(m => m.toString() === req.user.id) &&
    !req.user.isAdmin
  ) {
    return res.status(403).json({ general: 'Forbidden action' })
  }

  const startDate = moment(event.startDate).utc()
  const today = moment.utc()

  if (startDate.isBefore(today)) {
    return res
      .status(400)
      .json({ general: 'You cannot edit it because it already started' })
  }

  const { errors, isValid } = validateEditEvent(req.body)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  event.city = req.body.city || event.city
  event.country = req.body.country || event.country
  event.description = req.body.description || event.description

  if (req.body.endDate) {
    const endDate = moment(req.body.endDate).utc()

    if (!req.body.startDate) {
      if (endDate.isBefore(startDate)) {
        return res.status(400).json({
          endDate: 'Should be equal to or greater than startDate'
        })
      } else if (endDate.diff(startDate, 'days') > 365) {
        return res.status(400).json({
          endDate: 'Should last less than 365 days from startDate'
        })
      }
    }

    event.endDate = endDate.toDate()
  }

  event.isPublic = req.body.isPublic || event.isPublic

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

    const eventManagers = event.managers.map(m => m.toString())
    managersToAdd = [...new Set(difference(managersToAdd, eventManagers))]
    managersToRemove = [
      ...new Set(intersection(managersToRemove, eventManagers))
    ]

    if (managersToAdd.length > 0) {
      const notParticipant = managersToAdd.find(
        m => !event.participants.find(p => p.toString() === m)
      )
      if (notParticipant) {
        return res.status(400).json({
          managers: `User ${notParticipant} is not a participant of this event`
        })
      }

      event.managers = [...event.managers, ...managersToAdd]
    }

    if (managersToRemove.length === event.managers.length) {
      return res.status(400).json({
        managers: 'Should not remove all the managers'
      })
    }

    event.managers = event.managers.filter(
      m => !managersToRemove.includes(m.toString())
    )
  }

  if (req.body.name && event.name !== trim(req.body.name)) {
    event.name = trim(req.body.name)
    event.slug = slugify(event.name).toLowerCase()

    let otherEvent
    try {
      otherEvent = await Event.findOne({ slug: event.slug })
    } catch (err) {
      logger.error(`Event ${event.slug} failed to be found at edit-event`)
      return next(err)
    }

    if (otherEvent) {
      return res.status(400).json({ name: 'Is already taken' })
    }
  }

  event.participantsGoal = req.body.participantsGoal || event.participantsGoal

  if (req.body.participants) {
    let participantsToRemove = []

    req.body.participants.forEach(p => {
      participantsToRemove = [...participantsToRemove, p.substring(1)]
    })

    const eventParticipants = event.participants.map(p => p.toString())
    participantsToRemove = [
      ...new Set(intersection(participantsToRemove, eventParticipants))
    ]

    if (participantsToRemove.length === event.participants.length) {
      return res.status(400).json({
        participants: 'Should not remove all the participants'
      })
    }

    const managersToRemove = event.managers.filter(m =>
      participantsToRemove.includes(m.toString())
    )

    if (managersToRemove.length === event.managers.length) {
      return res.status(400).json({
        participants: 'Should not remove all the managers'
      })
    }

    const eventManagers = event.managers.map(m => m.toString())
    event.managers = difference(eventManagers, managersToRemove)

    event.participants = event.participants.filter(
      p => !participantsToRemove.includes(p.toString())
    )

    const participantsPromises = participantsToRemove.map(p =>
      User.findOne({ _id: p, isArchived: false })
    )

    let participants
    try {
      participants = await Promise.all(participantsPromises)
    } catch (err) {
      logger.error('A participant failed to be found at edit-event')
      return next(err)
    }

    for (const participant of participants) {
      participant.events = participant.events.filter(
        e => e.toString() !== event.id
      )
      participant.updatedAt = today.toDate()

      try {
        await participant.save()
      } catch (err) {
        logger.error(
          `Participant ${participant.id} failed to be updated at edit-event`
        )
        return next(err)
      }
    }
  }

  if (req.body.pointCoordinates.length > 0) {
    event.point = { coordinates: req.body.pointCoordinates, type: 'Point' }
  }

  event.reviewsGoal = req.body.reviewsGoal || event.reviewsGoal

  if (req.body.startDate) {
    const startDate = moment(req.body.startDate).utc()
    const endDate = moment(event.endDate).utc()

    if (!req.body.endDate) {
      if (startDate.isBefore(today)) {
        return res.status(400).json({
          startDate: 'Should be equal to or greater than the current time'
        })
      } else if (startDate.isAfter(endDate)) {
        return res.status(400).json({
          startDate: 'Should be equal to or less than endDate'
        })
      } else if (endDate.diff(startDate, 'days') > 365) {
        return res.status(400).json({
          startDate: 'Should last less than 365 days to endDate'
        })
      }
    }

    event.startDate = startDate.toDate()
  }

  if (req.body.teams) {
    let teamsToRemove = []

    req.body.teams.forEach(t => {
      teamsToRemove = [...teamsToRemove, t.substring(1)]
    })

    const eventTeams = event.teams.map(t => t.toString())
    teamsToRemove = [...new Set(intersection(teamsToRemove, eventTeams))]

    event.teams = event.teams.filter(t => !teamsToRemove.includes(t.toString()))

    const teamsPromises = teamsToRemove.map(t =>
      Team.findOne({ _id: t, isArchived: false })
    )

    let teams
    try {
      teams = await Promise.all(teamsPromises)
    } catch (err) {
      logger.error('A team failed to be found at edit-event')
      return next(err)
    }

    for (const team of teams) {
      team.events = team.events.filter(e => e.toString() !== event.id)
      team.updatedAt = Date.now()

      try {
        await team.save()
      } catch (err) {
        logger.error(`Team ${team.id} failed to be updated at edit-event`)
        return next(err)
      }
    }
  }

  event.updatedAt = today.toDate()

  try {
    await event.save()
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(`Event ${event.id} failed to be updated at edit-event`)
    return next(err)
  }

  const dataResponse = pick(event, [
    '_id',
    'city',
    'country',
    'description',
    'endDate',
    'isApproved',
    'managers',
    'name',
    'participantsGoal',
    'participants',
    'photos',
    'point',
    'poster',
    'reviewsGoal',
    'slug',
    'startDate',
    'teams'
  ])

  return res.status(200).json(dataResponse)
}
