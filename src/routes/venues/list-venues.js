const axios = require('axios')
const { find } = require('lodash')

const logger = require('../../helpers/logger')
const Venue = require('../../models/venue')

const { validateListVenues } = require('./validations')

module.exports = async (req, res, next) => {
  if (req.user.isBlocked) {
    return res.status(423).json({ message: 'You are blocked' })
  }

  const queryParams = req.query
  const { errors, isValid } = validateListVenues(queryParams)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  let placesQueryString
  if (!queryParams.page) {
    placesQueryString = `?location=${queryParams.location}&radius=${queryParams.radius}&type=establishment`
    if (queryParams.type) {
      placesQueryString = `?location=${queryParams.location}&radius=${queryParams.radius}&type=${queryParams.type}`
    }
  } else {
    placesQueryString = `?pagetoken=${queryParams.page}`
  }

  let placesResponse
  try {
    placesResponse = await axios.get(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json${placesQueryString}&key=${process
        .env.PLACES_API_KEY}`
    )
  } catch (err) {
    logger.error(
      `Places failed to be found at list-venues.\nQuery Params: ${JSON.stringify(
        queryParams
      )}`
    )
    return next(err)
  }

  let places = []
  const placesIDs = []
  placesResponse.data.results.forEach(place => {
    places.push({
      location: place.geometry.location,
      name: place.name,
      placeID: place.place_id,
      types: place.types,
      vicinity: place.vicinity
    })
    placesIDs.push(place.place_id)
  })

  let venues
  try {
    venues = await Venue.find({ placeID: { $in: placesIDs } }).select(
      '-__v _id bathroomScore entryScore placeID'
    )
  } catch (err) {
    logger.error(
      `Venues failed to be found at list-venues.\nPlaces IDs: [${placesIDs}]`
    )
    return next(err)
  }

  places = places.map(place => {
    const review = find(venues, venue => venue.placeID === place.placeID)
    return { ...place, review }
  })

  const dataResponse = {
    nextPage: placesResponse.data.next_page_token,
    results: places
  }

  return res.status(200).json(dataResponse)
}
