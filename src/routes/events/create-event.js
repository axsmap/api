const util = require('util')

const aws = require('aws-sdk')
const axios = require('axios')
const FormData = require('form-data')
const jimp = require('jimp')
const moment = require('moment')
const randomstring = require('randomstring')

jimp.prototype.getBufferAsync = util.promisify(jimp.prototype.getBuffer)

const { Event } = require('../../models/event')
const { cleanSpaces } = require('../../helpers')
const logger = require('../../helpers/logger')
const { Team } = require('../../models/team')

const { validateCreateEvent } = require('./validations')

module.exports = async (req, res, next) => {
  const data = {
    address: req.body.address,
    description: req.body.description,
    donationAmounts: req.body.donationAmounts,
    donationEnabled: req.body.donationEnabled,
    donationGoal: req.body.donationGoal,
    endDate: req.body.endDate,
    isOpen: req.body.isOpen,
    locationCoordinates: req.body.locationCoordinates,
    name: req.body.name,
    participantsGoal: req.body.participantsGoal,
    poster: req.body.poster,
    reviewsGoal: req.body.reviewsGoal,
    startDate: req.body.startDate,
    teamManager: req.body.teamManager
  }

  const { errors, isValid } = validateCreateEvent(data)
  if (!isValid) return res.status(400).json(errors)

  data.address = cleanSpaces(data.address)

  data.endDate = moment(data.endDate).utc().toDate()

  data.location = {
    coordinates: [data.locationCoordinates[1], data.locationCoordinates[0]]
  }
  delete data.locationCoordinates

  data.managers = [req.user.id]

  data.name = cleanSpaces(data.name)
  let repeatedEvent
  try {
    repeatedEvent = await Event.findOne({ name: data.name, isArchived: false })
  } catch (err) {
    logger.error(`Event ${data.name} failed to be found at create-event`)
    return next(err)
  }

  if (repeatedEvent) {
    return res.status(400).json({ name: 'Is already taken' })
  }

  if (data.poster) {
    let posterBuffer = Buffer.from(data.poster.split(',')[1], 'base64')
    let posterImage
    try {
      posterImage = await jimp.read(posterBuffer)
    } catch (err) {
      logger.error('Poster image failed to be read at create-event')
      return next(err)
    }

    let uploadPoster
    posterImage.cover(400, 400).quality(85)
    try {
      posterBuffer = await posterImage.getBufferAsync(posterImage.getMIME())
    } catch (err) {
      return next(err)
    }

    const posterExtension = posterImage.getExtension()
    if (
      posterExtension === 'png' ||
      posterExtension === 'jpeg' ||
      posterExtension === 'jpg' ||
      posterExtension === 'bmp'
    ) {
      const posterFileName = `${Date.now()}${randomstring.generate({
        length: 5,
        capitalization: 'lowercase'
      })}.${posterExtension}`
      const s3 = new aws.S3()
      uploadPoster = s3
        .putObject({
          ACL: 'public-read',
          Body: posterBuffer,
          Bucket: process.env.AWS_S3_BUCKET,
          ContentType: posterImage.getMIME(),
          Key: `events/posters/${posterFileName}`
        })
        .promise()

      data.poster = `https://s3.amazonaws.com/${process.env
        .AWS_S3_BUCKET}/events/posters/${posterFileName}`
    } else {
      return res
        .status(400)
        .json({ poster: 'Should have a .png, .jpeg, .jpg or .bmp extension' })
    }

    try {
      await uploadPoster
    } catch (err) {
      logger.error('Poster failed to be uploaded at create-event')
      return next(err)
    }
  } else {
    data.poster = undefined
  }

  data.startDate = moment(data.startDate).utc().toDate()

  if (data.teamManager) {
    let team
    try {
      team = await Team.findOne({ _id: data.teamManager, isArchived: false })
    } catch (err) {
      logger.error(
        `Team ${data.teamManager} failed to be found at create-event`
      )
      return next(err)
    }

    if (!team) {
      return res.status(404).json({ teamManager: 'Not found' })
    }

    const teamManagers = team.managers.map(m => m.toString())
    if (!teamManagers.includes(req.user.id)) {
      return res.status(403).json({ general: 'Forbidden action' })
    }
  } else {
    data.teamManager = undefined
  }

  if (data.donationEnabled) {
    const campaignData = new FormData()
    campaignData.append('title', data.name)
    campaignData.append('goal_in_cents', data.donationGoal * 100)

    let options = {
      method: 'POST',
      url: `https://${process.env
        .DONATELY_SUBDOMAIN}.dntly.com/api/v1/admin/campaigns`,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${campaignData._boundary}`
      },
      auth: {
        username: process.env.DONATELY_TOKEN,
        password: ''
      },
      data: campaignData
    }

    let response
    try {
      response = await axios(options)
    } catch (err) {
      logger.error('Donation campaign failed to be created at create-event.')
      return next(err)
    }

    data.donationId = response.data.campaign.id
  }

  let event
  try {
    event = await Event.create(data)
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        validationErrors[key] = err.errors[key].message
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(
      `Event failed to be created at create-event.\nData: ${JSON.stringify(
        data
      )}`
    )
    return next(err)
  }

  req.user.events = [...req.user.events, event.id]
  req.user.updatedAt = moment.utc().toDate()

  try {
    await req.user.save()
  } catch (err) {
    logger.error(`User ${req.user.id} failed to be updated at create-event`)
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

  return res.status(201).json(dataResponse)
}
