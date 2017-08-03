const { last, pick } = require('lodash')
const moment = require('moment')

const logger = require('../../helpers/logger')
const Venue = require('../../models/venue')

module.exports = async (req, res, next) => {
  const photoID = req.params.photoID
  const venueID = req.params.venueID

  let venue
  try {
    venue = await Venue.findOne({ _id: venueID, isArchived: false })
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Venue not found' })
    }

    logger.error(`Venue ${venueID} failed to be found at flag-venue-photo`)
    return next(err)
  }

  if (!venue) {
    return res.status(404).json({ message: 'Venue not found' })
  }

  const isParamPhoto = photo => last(photo.url.split('/')) === photoID

  if (!venue.photos || !venue.photos.find(isParamPhoto)) {
    return res.status(404).json({ message: 'Photo not found' })
  }

  const data = pick(req.body, ['comments', 'type'])

  venue.photos = venue.photos.map(photo => {
    if (isParamPhoto(photo)) {
      photo.complaints = [
        ...photo.complaints,
        {
          comments: data.comments,
          type: data.type,
          user: req.user.id
        }
      ]
    }

    return photo
  })

  venue.updatedAt = moment.utc().toDate()

  try {
    await venue.save()
  } catch (err) {
    if (typeof err.errors === 'object') {
      const validationErrors = {}

      Object.keys(err.errors).forEach(key => {
        if (key.includes('comments')) {
          validationErrors.comments = err.errors[key].message
        } else {
          validationErrors.type = err.errors[key].message
        }
      })

      return res.status(400).json(validationErrors)
    }

    logger.error(`Venue ${venue.id} failed to be updated at flag-venue-photo`)
    return next(err)
  }

  return res.status(200).json({ message: 'Success' })
}
