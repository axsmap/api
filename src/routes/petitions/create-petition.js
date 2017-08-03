const moment = require('moment')
const { pick } = require('lodash')

const Event = require('../../models/event')
const logger = require('../../helpers/logger')
const Petition = require('../../models/petition')
const Team = require('../../models/team')
const User = require('../../models/user')

const { validateCreatePetition } = require('./validations')

module.exports = async (req, res, next) => {
  const { errors, isValid } = validateCreatePetition(req.body)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  const data = pick(req.body, [
    'entityID',
    'message',
    'receiverID',
    'senderID',
    'type'
  ])
  const today = moment.utc()

  if (data.type === 'invite-team-event') {
    data.senderID = req.user.id

    let petition
    try {
      petition = await Petition.findOne({
        entityID: data.entityID,
        receiverID: data.receiverID,
        type: data.type
      })
    } catch (err) {
      logger.error(
        `Petition ${data.type} to ${data.receiverID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        message: `Team ${data.receiverID} already has a pending invitation to the event ${data.entityID}`
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
      eventEntity = await Event.findOne({ _id: data.entityID })
    } catch (err) {
      logger.error(
        `Event ${data.entityID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!eventEntity) {
      return res.status(404).json({ entityID: 'Event not found' })
    }

    if (!eventEntity.managers.find(m => m.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Forbidden action' })
    }

    if (eventEntity.teams.find(t => t.toString() === data.receiverID)) {
      return res.status(400).json({
        receiverID: `Is already a participant of the event ${data.entityID}`
      })
    }

    const endDate = moment(eventEntity.endDate).utc()
    if (endDate.isBefore(today)) {
      return res
        .status(423)
        .json({ message: 'This event has already finished' })
    }

    let teamReceiver
    try {
      teamReceiver = await Team.findOne({ _id: data.receiverID })
    } catch (err) {
      logger.error(
        `Team ${data.receiverID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!teamReceiver) {
      return res.status(404).json({ receiverID: 'Team not found' })
    }
  } else if (data.type === 'invite-user-event') {
    data.senderID = req.user.id

    let petition
    try {
      petition = await Petition.findOne({
        entityID: data.entityID,
        receiverID: data.receiverID,
        type: data.type
      })
    } catch (err) {
      logger.error(
        `Petition ${data.type} to ${data.receiverID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        message: `User ${data.receiverID} already has a pending invitation to the event ${data.entityID}`
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

    if (req.user.id === data.receiverID) {
      return res
        .status(400)
        .json({ receiverID: 'Should be a different user than you' })
    }

    let eventEntity
    try {
      eventEntity = await Event.findOne({ _id: data.entityID })
    } catch (err) {
      logger.error(
        `Event ${data.entityID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!eventEntity) {
      return res.status(404).json({ entityID: 'Event not found' })
    }

    if (!eventEntity.managers.find(m => m.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Forbidden action' })
    }

    if (eventEntity.participants.find(p => p.toString() === data.receiverID)) {
      return res.status(400).json({
        receiverID: `Is already a participant of the event ${data.entityID}`
      })
    }

    const endDate = moment(eventEntity.endDate).utc()
    if (endDate.isBefore(today)) {
      return res
        .status(423)
        .json({ message: 'This event has already finished' })
    }

    let userReceiver
    try {
      userReceiver = await User.findOne({ _id: data.receiverID })
    } catch (err) {
      logger.error(
        `User ${data.receiverID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!userReceiver) {
      return res.status(404).json({ receiverID: 'User not found' })
    }
  } else if (data.type === 'invite-user-team') {
    data.senderID = req.user.id

    let petition
    try {
      petition = await Petition.findOne({
        entityID: data.entityID,
        receiverID: data.receiverID,
        type: data.type
      })
    } catch (err) {
      logger.error(
        `Petition ${data.type} to ${data.receiverID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        message: `User ${data.receiverID} already has a pending invitation to the team ${data.entityID}`
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

    if (req.user.id === data.receiverID) {
      return res
        .status(400)
        .json({ receiverID: 'Should be a different user than you' })
    }

    let teamEntity
    try {
      teamEntity = await Team.findOne({ _id: data.entityID })
    } catch (err) {
      logger.error(
        `Team ${data.entityID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!teamEntity) {
      return res.status(404).json({ entityID: 'Team not found' })
    }

    if (!teamEntity.managers.find(m => m.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Forbidden action' })
    }

    if (teamEntity.members.find(m => m.toString() === data.receiverID)) {
      return res.status(400).json({
        receiverID: `Is already a member of the team ${data.entityID}`
      })
    }

    let userReceiver
    try {
      userReceiver = await User.findOne({ _id: data.receiverID })
    } catch (err) {
      logger.error(
        `User ${data.receiverID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!userReceiver) {
      return res.status(404).json({ receiverID: 'User not found' })
    }
  } else if (data.type === 'request-team-event') {
    data.receiverID = data.entityID

    let petition
    try {
      petition = await Petition.findOne({
        receiverID: data.receiverID,
        senderID: data.senderID,
        type: data.type
      })
    } catch (err) {
      logger.error(
        `Petition ${data.type} from ${data.senderID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        message: `Team ${data.senderID} already has a pending request with the event ${data.receiverID}`
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
      eventEntity = await Event.findOne({ _id: data.entityID })
    } catch (err) {
      logger.error(
        `Event ${data.entityID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!eventEntity) {
      return res.status(404).json({ entityID: 'Event not found' })
    }

    if (eventEntity.teams.find(t => t.toString() === data.senderID)) {
      return res.status(400).json({
        senderID: `Team is already a participant of the event ${data.entityID}`
      })
    }

    const endDate = moment(eventEntity.endDate).utc()
    if (endDate.isBefore(today)) {
      return res
        .status(423)
        .json({ message: 'This event has already finished' })
    }

    let teamSender
    try {
      teamSender = await Team.findOne({ _id: data.senderID })
    } catch (err) {
      logger.error(
        `Team ${data.senderID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!teamSender) {
      return res.status(404).json({ senderID: 'Team not found' })
    }

    if (!teamSender.managers.find(m => m.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Forbidden action' })
    }
  } else if (data.type === 'request-user-event') {
    data.receiverID = data.entityID
    data.senderID = req.user.id

    let petition
    try {
      petition = await Petition.findOne({
        receiverID: data.receiverID,
        senderID: data.senderID,
        type: data.type
      })
    } catch (err) {
      logger.error(
        `Petition ${data.type} from ${data.senderID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        message: `You already have a pending request with the event ${data.receiverID}`
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
      eventEntity = await Event.findOne({ _id: data.entityID })
    } catch (err) {
      logger.error(
        `Event ${data.entityID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!eventEntity) {
      return res.status(404).json({ entityID: 'Event not found' })
    }

    if (eventEntity.participants.find(p => p.toString() === req.user.id)) {
      return res.status(400).json({
        message: `You already are a participant of the event ${data.entityID}`
      })
    }

    const endDate = moment(eventEntity.endDate).utc()
    if (endDate.isBefore(today)) {
      return res
        .status(423)
        .json({ message: 'This event has already finished' })
    }
  } else {
    // data.type === request-user-team
    data.receiverID = data.entityID
    data.senderID = req.user.id

    let petition
    try {
      petition = await Petition.findOne({
        receiverID: data.receiverID,
        senderID: data.senderID,
        type: data.type
      })
    } catch (err) {
      logger.error(
        `Petition ${data.type} from ${data.senderID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (petition && petition.state === 'pending') {
      return res.status(400).json({
        message: `You already have a pending request with the team ${data.receiverID}`
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
      teamEntity = await Team.findOne({ _id: data.entityID })
    } catch (err) {
      logger.error(
        `Team ${data.entityID} failed to be found at create-petition`
      )
      return next(err)
    }

    if (!teamEntity) {
      return res.status(404).json({ entityID: 'Team not found' })
    }

    if (teamEntity.members.find(m => m.toString() === req.user.id)) {
      return res.status(400).json({
        message: `You already are a member of the team ${data.entityID}`
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
      `Petition ${data.type} from ${data.senderID} to ${data.receiverID} failed to be created at create-petition`
    )
    return next(err)
  }

  const dataResponse = pick(petition, [
    '_id',
    'entityID',
    'message',
    'receiverID',
    'senderID',
    'state',
    'type'
  ])

  return res.status(201).json(dataResponse)
}
