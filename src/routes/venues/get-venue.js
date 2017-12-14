const axios = require('axios')
const { isEqual } = require('lodash')

const logger = require('../../helpers/logger')
const { Venue } = require('../../models/venue')

module.exports = async (req, res, next) => {
  const placeId = req.params.placeId

  let response
  try {
    response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&key=${process
        .env.PLACES_API_KEY}`
    )
  } catch (err) {
    logger.error(`Place ${placeId} failed to be found at get-venue.`)
    return next(err)
  }

  const statusResponse = response.data.status
  if (statusResponse !== 'OK') {
    return res.status(404).json({ general: 'Place not found' })
  }

  const placeData = response.data.result
  const dataResponse = {}
  dataResponse.address = placeData.formatted_address
  if (placeData.photos && placeData.photos.length > 0) {
    dataResponse.coverPhoto = `https://maps.googleapis.com/maps/api/place/photo?key=${process
      .env.PLACES_API_KEY}&maxwidth=500&photoreference=${placeData.photos[0]
      .photo_reference}`
  }
  dataResponse.formattedPhone = placeData.formatted_phone_number
  dataResponse.googleRating = placeData.rating
  dataResponse.googleUrl = placeData.url
  dataResponse.internationalPhone = placeData.international_phone_number
  dataResponse.location = {
    lat: placeData.geometry.location.lat,
    lng: placeData.geometry.location.lng
  }
  dataResponse.name = placeData.name
  dataResponse.placeId = placeId
  dataResponse.types = placeData.types
  dataResponse.website = placeData.website

  dataResponse.allowsGuideDog = { yes: 0, no: 0 }
  dataResponse.bathroomReviews = 0
  dataResponse.bathroomScore = null
  dataResponse.entryReviews = 0
  dataResponse.entryScore = null
  dataResponse.hasParking = { yes: 0, no: 0 }
  dataResponse.hasSecondEntry = { yes: 0, no: 0 }
  dataResponse.hasWellLit = { yes: 0, no: 0 }
  dataResponse.isQuiet = { yes: 0, no: 0 }
  dataResponse.isSpacious = { yes: 0, no: 0 }
  dataResponse.steps = {
    zero: 0,
    one: 0,
    two: 0,
    moreThanTwo: 0
  }

  let venue
  try {
    venue = await Venue.findOne({ placeId, isArchived: false }).select(
      '-__v -createdAt -updatedAt -isArchived'
    )
  } catch (err) {
    logger.error(
      `Venue with placeId ${placeId} failed to be found at get-venue`
    )
    return next(err)
  }

  if (venue) {
    let venueHasUpdates = false
    if (venue.address !== dataResponse.address) {
      venue.address = dataResponse.address
      venueHasUpdates = true
    }
    if (
      venue.location.coordinates[0] !== dataResponse.location.lng ||
      venue.location.coordinates[1] !== dataResponse.location.lat
    ) {
      venue.location.coordinates = [
        dataResponse.location.lng,
        dataResponse.location.lat
      ]
      venueHasUpdates = true
    }
    if (venue.name !== dataResponse.name) {
      venue.name = dataResponse.name
      venueHasUpdates = true
    }
    if (!isEqual(venue.types, dataResponse.types)) {
      venue.types = dataResponse.types
      venueHasUpdates = true
    }
    if (venueHasUpdates) {
      try {
        await venue.save()
      } catch (err) {
        logger.error(
          `Venue with id ${venue.id} failed to be updated at get-venue.`
        )
        return next(err)
      }
    }

    dataResponse.id = venue._id
    dataResponse.allowsGuideDog = venue.allowsGuideDog
    dataResponse.bathroomReviews = venue.bathroomReviews
    dataResponse.bathroomScore = venue.bathroomScore
    dataResponse.entryReviews = venue.entryReviews
    dataResponse.entryScore = venue.entryScore
    dataResponse.hasParking = venue.hasParking
    dataResponse.hasSecondEntry = venue.hasSecondEntry
    dataResponse.hasWellLit = venue.hasWellLit
    dataResponse.isQuiet = venue.isQuiet
    dataResponse.isSpacious = venue.isSpacious
    dataResponse.steps = venue.steps
  }

  return res.status(200).json(dataResponse)
}
