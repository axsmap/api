const { difference, intersection } = require('lodash')
const moment = require('moment')

const { Event } = require('../../models/event')
const { cleanSpaces } = require('../../helpers')
const logger = require('../../helpers/logger')
const { Photo } = require('../../models/photo')
const { Team } = require('../../models/team')
const { User } = require('../../models/user')

const { validateEditEvent } = require('./validations')

module.exports = async (req, res, next) => {
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

  if (!event.managers.find(m => m.toString() === req.user.id)) {
    return res.status(403).json({ general: 'Forbidden action' })
  }

  const data = {
    address: req.body.address,
    description: req.body.description,
    endDate: req.body.endDate,
    isOpen: req.body.isOpen,
    locationCoordinates: req.body.locationCoordinates,
    managers: req.body.managers,
    name: req.body.name,
    participants: req.body.participants,
    participantsGoal: req.body.participantsGoal,
    poster: req.body.poster,
    reviewsGoal: req.body.reviewsGoal,
    startDate: req.body.startDate,
    teamManager: req.body.teamManager,
    teams: req.body.teams
  }

  const { errors, isValid } = validateEditEvent(data)
  if (!isValid) return res.status(400).json(errors)

  event.address = data.address ? cleanSpaces(data.address) : event.address
  event.description = data.description || event.description

  if (data.endDate) {
    const endDate = moment(data.endDate).endOf('day').utc()
    const startDate = moment(event.startDate).startOf('day').utc()

    if (!data.startDate) {
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

  event.isOpen = typeof data.isOpen !== 'undefined' ? data.isOpen : event.isOpen

  if (data.locationCoordinates && data.locationCoordinates.length > 0) {
    event.location = {
      coordinates: [data.locationCoordinates[1], data.locationCoordinates[0]],
      type: 'Point'
    }
  }

  if (data.managers) {
    let managersToAdd = []
    let managersToRemove = []

    data.managers.forEach(m => {
      if (m.startsWith('-')) {
        managersToRemove = [...managersToRemove, m.substring(1)]
      } else {
        managersToAdd = [...managersToAdd, m]
      }
    })

    const eventManagers = event.managers.map(m => m.toString())

    managersToAdd = [...new Set(difference(managersToAdd, eventManagers))]
    if (managersToAdd.length > 0) {
      const eventParticipants = event.participants.map(p => p.toString())
      const notParticipant = managersToAdd.find(
        m => !eventParticipants.includes(m)
      )

      if (notParticipant) {
        return res.status(400).json({
          managers: `User ${notParticipant} is not a participant of this event`
        })
      }

      event.managers = [...eventManagers, ...managersToAdd]
      event.participants = event.participants.filter(
        p => !managersToAdd.includes(p.toString())
      )
    }

    managersToRemove = [
      ...new Set(intersection(managersToRemove, eventManagers))
    ]
    if (managersToRemove.length === event.managers.length) {
      return res
        .status(400)
        .json({ managers: 'Should not remove all managers' })
    }

    event.managers = event.managers.filter(
      m => !managersToRemove.includes(m.toString())
    )
    const eventParticipants = event.participants.map(p => p.toString())
    event.participants = [...eventParticipants, ...managersToRemove]
  }

  if (data.name) {
    const eventName = cleanSpaces(data.name)

    if (eventName !== event.name) {
      let repeatedEvent
      try {
        repeatedEvent = await Event.findOne({
          name: eventName,
          isArchived: false
        })
      } catch (err) {
        logger.error(`Event ${eventName} failed to be found at edit-event`)
        return next(err)
      }

      if (repeatedEvent) {
        return res.status(400).json({ name: 'Is already taken' })
      }

      event.name = eventName
    }
  }

  if (data.participants) {
    const eventParticipants = event.participants.map(p => p.toString())
    let participantsToRemove = data.participants.map(p => p.substring(1))
    participantsToRemove = [
      ...new Set(intersection(participantsToRemove, eventParticipants))
    ]

    const getParticipants = participantsToRemove.map(p =>
      User.find({ _id: p, isArchived: false })
    )
    let participants
    try {
      participants = await Promise.all(getParticipants)
    } catch (err) {
      logger.error('Participants failed to be found at edit-event')
      return next(err)
    }

    const updateParticipants = participants.map((p, i) => {
      p[i].events = p[i].events.filter(e => e.toString() !== event.id)
      return p[i].save()
    })

    try {
      await Promise.all(updateParticipants)
    } catch (err) {
      logger.error('Participants failed to be updated at edit-event')
      return next(err)
    }

    event.participants = event.participants.filter(
      p => !participantsToRemove.includes(p.toString())
    )
  }

  event.participantsGoal = data.participantsGoal || event.participantsGoal

  if (
    data.poster &&
    !data.poster.includes('default') &&
    data.poster !== event.poster
  ) {
    let poster
    try {
      poster = await Photo.findOne({ url: data.poster })
    } catch (err) {
      logger.error(`Poster ${data.poster} failed to be found at edit-event`)
      return next(err)
    }

    if (!poster) {
      return res.status(404).json({ poster: 'Not found' })
    }

    event.poster = data.poster
  } else if (data.poster === '') {
    event.poster = `https://s3.amazonaws.com/${process.env
      .AWS_S3_BUCKET}/events/posters/default.png`
  }

  event.reviewsGoal = data.reviewsGoal || event.reviewsGoal

  if (data.startDate) {
    const startDate = moment(data.startDate).startOf('day').utc()
    const endDate = moment(event.endDate).endOf('day').utc()

    if (!data.endDate) {
      const today = moment().startOf('day').utc()

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

  if (data.teamManager) {
    let team
    try {
      team = await Team.findOne({ _id: data.teamManager, isArchived: false })
    } catch (err) {
      logger.error(`Team ${data.teamManager} failed to be found at edit-event`)
      return next(err)
    }

    if (!team) {
      return res.status(404).json({ teamManager: 'Not found' })
    }

    const teamManagers = team.managers.map(m => m.toString())
    if (!teamManagers.includes(req.user.id)) {
      return res.status(403).json({ general: 'Forbidden action' })
    }

    event.teamManager = data.teamManager

    team.events = [...new Set([...team.events, event.id])]
    try {
      await team.save()
    } catch (err) {
      logger.error(`Team ${team.id} failed to be updated at edit-event`)
      return next(err)
    }
  } else if (data.teamManager === '' && event.teamManager) {
    let team
    try {
      team = await Team.findOne({ _id: event.teamManager, isArchived: false })
    } catch (err) {
      logger.error(`Team ${event.teamManager} failed to be found at edit-event`)
      return next(err)
    }

    if (!team) {
      return res.status(404).json({ teamManager: 'Not found' })
    }

    const teamManagers = team.managers.map(m => m.toString())
    if (!teamManagers.includes(req.user.id)) {
      return res.status(403).json({ general: 'Forbidden action' })
    }

    event.teamManager = null

    team.events = team.events.filter(e => e.toString() !== event.id)
    try {
      await team.save()
    } catch (err) {
      logger.error(`Team ${team.id} failed to be updated at edit-event`)
      return next(err)
    }
  }

  if (data.teams) {
    const eventTeams = event.teams.map(t => t.toString())
    let teamsToRemove = data.teams.map(t => t.substring(1))
    teamsToRemove = [...new Set(intersection(teamsToRemove, eventTeams))]

    const getTeams = teamsToRemove.map(t =>
      Team.find({ _id: t, isArchived: false })
    )
    let teams
    try {
      teams = await Promise.all(getTeams)
    } catch (err) {
      logger.error('Teams failed to be found at edit-event')
      return next(err)
    }

    const updateTeams = teams.map((t, i) => {
      t[i].events = t[i].events.filter(e => e.toString() !== event.id)
      return t[i].save()
    })

    try {
      await Promise.all(updateTeams)
    } catch (err) {
      logger.error('Teams failed to be updated at edit-event')
      return next(err)
    }

    event.teams = event.teams.filter(t => !teamsToRemove.includes(t.toString()))
  }

  event.updatedAt = moment.utc().toDate()

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

  let eventLocation
  if (event.location.coordinates) {
    eventLocation = {
      lat: event.location.coordinates[1],
      lng: event.location.coordinates[0]
    }
  }
  const dataResponse = {
    address: event.address,
    description: event.description,
    endDate: event.description,
    isOpen: event.isOpen,
    location: eventLocation,
    managers: event.managers,
    name: event.name,
    participantsGoal: event.participantsGoal,
    poster: event.poster,
    reviewsGoal: event.reviewsGoal,
    teamManager: event.teamManager
  }

  return res.status(200).json(dataResponse)
}
