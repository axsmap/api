const axios = require('axios')
const { find } = require('lodash')

const logger = require('../../helpers/logger')
const Venue = require('../../models/venue')

const { validateListVenues } = require('./validations')

module.exports = async (req, res, next) => {
  const queryParams = req.query
  const { errors, isValid } = validateListVenues(queryParams)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  let placesQueryString = `?key=${process.env.PLACES_API_KEY}`
  if (!queryParams.page) {
    placesQueryString = `${placesQueryString}&location=${queryParams.location}&rankby=distance`

    if (queryParams.keyword) {
      placesQueryString = `${placesQueryString}&keyword=${queryParams.keyword}`
    }

    if (queryParams.language) {
      placesQueryString = `${placesQueryString}&language=${queryParams.language}`
    } else {
      placesQueryString = `${placesQueryString}&language=en`
    }

    if (queryParams.type) {
      placesQueryString = `${placesQueryString}&type=${queryParams.type}`
    } else {
      placesQueryString = `${placesQueryString}&type=establishment`
    }
  } else {
    placesQueryString = `${placesQueryString}&pagetoken=${queryParams.page}`
  }

  let placesResponse
  try {
    placesResponse = await axios.get(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json${placesQueryString}`
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
  const placesIds = []
  placesResponse.data.results.forEach(place => {
    let photo = ''
    if (place.photos) {
      photo = `https://maps.googleapis.com/maps/api/place/photo?key=${process
        .env.PLACES_API_KEY}&maxwidth=300&photoreference=${place.photos[0]
        .photo_reference}`
    }

    places.push({
      generalScore: place.rating,
      icon: place.icon,
      location: {
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng
      },
      name: place.name,
      photo,
      placeId: place.place_id,
      types: place.types
    })
    placesIds.push(place.place_id)
  })

  let venues
  try {
    venues = await Venue.find({ placeId: { $in: placesIds } })
  } catch (err) {
    logger.error(
      `Venues failed to be found at list-venues.\nPlaces ids: [${placesIds}]`
    )
    return next(err)
  }

  places = places.map(place => {
    const venue = find(venues, venue => venue.placeId === place.placeId)
    if (venue) {
      let photo = place.photo
      if (venue.photos) {
        photo = venues.photos[0].url
      }

      return Object.assign({}, place, {
        bathroomScore: venue.bathroomScore,
        entryScore: venue.entryScore,
        photo
      })
    }

    return place
  })

  const dataResponse = {
    nextPage: placesResponse.data.next_page_token,
    results: places
  }

  return res.status(200).json(dataResponse)
}
