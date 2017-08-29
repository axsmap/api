const axios = require('axios')

const logger = require('../../helpers/logger')
const Venue = require('../../models/venue')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ message: 'You are blocked' })
  }

  const venueId = req.params.venueId

  let venue
  try {
    venue = await Venue.findOne({ _id: venueId, isArchived: false }).select(
      '-__v -createdAt -updatedAt'
    )
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ message: 'Venue not found' })
    }

    logger.error(`Venue ${venueId} failed to be found at get-venue`)
    return next(err)
  }

  if (!venue) {
    return res.status(404).json({ message: 'Venue not found' })
  }

  let placeResponse
  try {
    placeResponse = await axios.get(
      `https://maps.googleapis.com/maps/api/place/details/json?placeid=${venue.placeId}&key=${process
        .env.PLACES_API_KEY}`
    )
  } catch (err) {
    logger.error(
      `Place with Id ${venue.placeId} failed to be found at get-venue.`
    )
    return next(err)
  }

  const dataResponse = {
    address: placeResponse.data.formatted_address,
    googleUrl: placeResponse.data.url,
    location: placeResponse.data.geometry.location,
    name: placeResponse.data.name,
    phone: placeResponse.data.formatted_phone_number,
    placeId: placeResponse.data.place_id,
    review: venue,
    types: placeResponse.data.types,
    vicinity: placeResponse.data.vicinity,
    website: placeResponse.data.website
  }

  return res.status(200).json(dataResponse)
}
