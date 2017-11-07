const moment = require('moment')
const { pick } = require('lodash')

const { Event } = require('../../models/event')
const logger = require('../../helpers/logger')
const { Petition } = require('../../models/petition')
const { Team } = require('../../models/team')
const { User } = require('../../models/user')

const { validateCreatePetition } = require('./validations')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ general: 'You are blocked' })
  }

  const { errors, isValid } = validateCreatePetition(req.body)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  const data = pick(req.body, [
    'entityId',
    'message',
    'receiverId',
    'senderId',
    'type'
  ])
  const today = moment.utc()

  if (data.type === 'invite-team-event') {
    data.senderId = req.user.id

    let petition
    try {
      petition = await Petition.findOne({
        entityId: data.entityId,
        receiverId: data.receiverId,
        type: data.type
      })
    } catch (err) {
      logger.error(
        `Petition ${data.type} to ${data.receiverId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        general: `Team ${data.receiverId} already has a pending invitation to the event ${data.entityId}`
      })
    }

    if (petition && petition.state === 'rejected') {
      try {
        await petition.remove()
      } catch (err) {
        logger.error(
          `Petition ${petition.id} failed to be removed at create-petition`
        )
        return next(err)
      }
    }

    let eventEntity
    try {
      eventEntity = await Event.findOne({ _id: data.entityId })
    } catch (err) {
      logger.error(
        `Event ${data.entityId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!eventEntity) {
      return res.status(404).json({ entityId: 'Event not found' })
    }

    if (!eventEntity.managers.find(m => m.toString() === req.user.id)) {
      return res.status(403).json({ general: 'Forbidden action' })
    }

    if (eventEntity.teams.find(t => t.toString() === data.receiverId)) {
      return res.status(400).json({
        receiverId: `Is already a participant of the event ${data.entityId}`
      })
    }

    const endDate = moment(eventEntity.endDate).utc()
    if (endDate.isBefore(today)) {
      return res
        .status(423)
        .json({ general: 'This event has already finished' })
    }

    let teamReceiver
    try {
      teamReceiver = await Team.findOne({ _id: data.receiverId })
    } catch (err) {
      logger.error(
        `Team ${data.receiverId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!teamReceiver) {
      return res.status(404).json({ receiverId: 'Team not found' })
    }
  } else if (data.type === 'invite-user-event') {
    data.senderId = req.user.id

    let petition
    try {
      petition = await Petition.findOne({
        entityId: data.entityId,
        receiverId: data.receiverId,
        type: data.type
      })
    } catch (err) {
      logger.error(
        `Petition ${data.type} to ${data.receiverId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        general: `User ${data.receiverId} already has a pending invitation to the event ${data.entityId}`
      })
    }

    if (petition && petition.state === 'rejected') {
      try {
        await petition.remove()
      } catch (err) {
        logger.error(
          `Petition ${petition.id} failed to be removed at create-petition`
        )
        return next(err)
      }
    }

    if (req.user.id === data.receiverId) {
      return res
        .status(400)
        .json({ receiverId: 'Should be a different user than you' })
    }

    let eventEntity
    try {
      eventEntity = await Event.findOne({ _id: data.entityId })
    } catch (err) {
      logger.error(
        `Event ${data.entityId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!eventEntity) {
      return res.status(404).json({ entityId: 'Event not found' })
    }

    if (!eventEntity.managers.find(m => m.toString() === req.user.id)) {
      return res.status(403).json({ general: 'Forbidden action' })
    }

    if (eventEntity.participants.find(p => p.toString() === data.receiverId)) {
      return res.status(400).json({
        receiverId: `Is already a participant of the event ${data.entityId}`
      })
    }

    const endDate = moment(eventEntity.endDate).utc()
    if (endDate.isBefore(today)) {
      return res
        .status(423)
        .json({ general: 'This event has already finished' })
    }

    let userReceiver
    try {
      userReceiver = await User.findOne({ _id: data.receiverId })
    } catch (err) {
      logger.error(
        `User ${data.receiverId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!userReceiver) {
      return res.status(404).json({ receiverId: 'User not found' })
    }
  } else if (data.type === 'invite-user-team') {
    data.senderId = req.user.id

    let petition
    try {
      petition = await Petition.findOne({
        entityId: data.entityId,
        receiverId: data.receiverId,
        type: data.type
      })
    } catch (err) {
      logger.error(
        `Petition ${data.type} to ${data.receiverId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        general: `User ${data.receiverId} already has a pending invitation to the team ${data.entityId}`
      })
    }

    if (petition && petition.state === 'rejected') {
      try {
        await petition.remove()
      } catch (err) {
        logger.error(
          `Petition ${petition.id} failed to be removed at create-petition`
        )
        return next(err)
      }
    }

    if (req.user.id === data.receiverId) {
      return res
        .status(400)
        .json({ receiverId: 'Should be a different user than you' })
    }

    let teamEntity
    try {
      teamEntity = await Team.findOne({ _id: data.entityId })
    } catch (err) {
      logger.error(
        `Team ${data.entityId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!teamEntity) {
      return res.status(404).json({ entityId: 'Team not found' })
    }

    if (!teamEntity.managers.find(m => m.toString() === req.user.id)) {
      return res.status(403).json({ general: 'Forbidden action' })
    }

    if (teamEntity.members.find(m => m.toString() === data.receiverId)) {
      return res.status(400).json({
        receiverId: `Is already a member of the team ${data.entityId}`
      })
    }

    let userReceiver
    try {
      userReceiver = await User.findOne({ _id: data.receiverId })
    } catch (err) {
      logger.error(
        `User ${data.receiverId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!userReceiver) {
      return res.status(404).json({ receiverId: 'User not found' })
    }
  } else if (data.type === 'request-team-event') {
    data.receiverId = data.entityId

    let petition
    try {
      petition = await Petition.findOne({
        receiverId: data.receiverId,
        senderId: data.senderId,
        type: data.type
      })
    } catch (err) {
      logger.error(
        `Petition ${data.type} from ${data.senderId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        general: `Team ${data.senderId} already has a pending request with the event ${data.receiverId}`
      })
    }

    if (petition && petition.state === 'rejected') {
      try {
        await petition.remove()
      } catch (err) {
        logger.error(
          `Petition ${petition.id} failed to be removed at create-petition`
        )
        return next(err)
      }
    }

    let eventEntity
    try {
      eventEntity = await Event.findOne({ _id: data.entityId })
    } catch (err) {
      logger.error(
        `Event ${data.entityId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!eventEntity) {
      return res.status(404).json({ entityId: 'Event not found' })
    }

    if (eventEntity.teams.find(t => t.toString() === data.senderId)) {
      return res.status(400).json({
        senderId: `Team is already a participant of the event ${data.entityId}`
      })
    }

    const endDate = moment(eventEntity.endDate).utc()
    if (endDate.isBefore(today)) {
      return res
        .status(423)
        .json({ general: 'This event has already finished' })
    }

    let teamSender
    try {
      teamSender = await Team.findOne({ _id: data.senderId })
    } catch (err) {
      logger.error(
        `Team ${data.senderId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!teamSender) {
      return res.status(404).json({ senderId: 'Team not found' })
    }

    if (!teamSender.managers.find(m => m.toString() === req.user.id)) {
      return res.status(403).json({ general: 'Forbidden action' })
    }
  } else if (data.type === 'request-user-event') {
    data.receiverId = data.entityId
    data.senderId = req.user.id

    let petition
    try {
      petition = await Petition.findOne({
        receiverId: data.receiverId,
        senderId: data.senderId,
        type: data.type
      })
    } catch (err) {
      logger.error(
        `Petition ${data.type} from ${data.senderId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        general: `You already have a pending request with the event ${data.receiverId}`
      })
    }

    if (petition && petition.state === 'rejected') {
      try {
        await petition.remove()
      } catch (err) {
        logger.error(
          `Petition ${petition.id} failed to be removed at create-petition`
        )
        return next(err)
      }
    }

    let eventEntity
    try {
      eventEntity = await Event.findOne({ _id: data.entityId })
    } catch (err) {
      logger.error(
        `Event ${data.entityId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!eventEntity) {
      return res.status(404).json({ entityId: 'Event not found' })
    }

    if (eventEntity.participants.find(p => p.toString() === req.user.id)) {
      return res.status(400).json({
        general: `You already are a participant of the event ${data.entityId}`
      })
    }

    const endDate = moment(eventEntity.endDate).utc()
    if (endDate.isBefore(today)) {
      return res
        .status(423)
        .json({ general: 'This event has already finished' })
    }
  } else {
    // data.type === request-user-team
    data.receiverId = data.entityId
    data.senderId = req.user.id

    let petition
    try {
      petition = await Petition.findOne({
        receiverId: data.receiverId,
        senderId: data.senderId,
        type: data.type
      })
    } catch (err) {
      logger.error(
        `Petition ${data.type} from ${data.senderId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        general: `You already have a pending request with the team ${data.receiverId}`
      })
    }

    if (petition && petition.state === 'rejected') {
      try {
        await petition.remove()
      } catch (err) {
        logger.error(
          `Petition ${petition.id} failed to be removed at create-petition`
        )
        return next(err)
      }
    }

    let teamEntity
    try {
      teamEntity = await Team.findOne({ _id: data.entityId })
    } catch (err) {
      logger.error(
        `Team ${data.entityId} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!teamEntity) {
      return res.status(404).json({ entityId: 'Team not found' })
    }

    if (teamEntity.members.find(m => m.toString() === req.user.id)) {
      return res.status(400).json({
        general: `You already are a member of the team ${data.entityId}`
      })
    }
  }

  let petition
  try {
    petition = await Petition.create(data)
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(
      `Petition ${data.type} from ${data.senderId} to ${data.receiverId} failed to be created at create-petition`
    )
    return next(err)
  }

  const dataResponse = pick(petition, [
    '_id',
    'entityId',
    'message',
    'receiverId',
    'senderId',
    'state',
    'type'
  ])

  return res.status(201).json(dataResponse)
}
