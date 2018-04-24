const axios = require('axios')
const { find, isEmpty } = require('lodash')
const slugify = require('speakingurl')

const { isNumber } = require('../../helpers')
const logger = require('../../helpers/logger')
const { Venue } = require('../../models/venue')

const { validateListVenues } = require('./validations')

module.exports = async (req, res, next) => {
  const queryParams = req.query

  const { errors, isValid } = validateListVenues(queryParams)
  if (!isValid) return res.status(400).json(errors)

  let coordinates = queryParams.location.split(',')
  if (queryParams.keywords && !queryParams.page) {
    const geocodeParams = `?key=${process.env.PLACES_API_KEY}&address=${slugify(
      queryParams.keywords
    )}`

    let geocodeResponse
    try {
      geocodeResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json${geocodeParams}`
      )
    } catch (err) {
      logger.error(
        `Geocode failed to be found at list-venues.\nQuery Params: ${JSON.stringify(
          queryParams
        )}`
      )
      return next(err)
    }

    const statusCode = geocodeResponse.data.status
    if (statusCode === 'ZERO_RESULTS') {
      return res.status(404).json({ keywords: 'Address not found' })
    } else if (statusCode === 'OVER_QUERY_LIMIT') {
      return next(new Error('Over query limit with Google Places API'))
    } else if (statusCode === 'REQUEST_DENIED') {
      return next(new Error('Request denied with Google Places API'))
    } else if (statusCode === 'INVALID_REQUEST') {
      return next(new Error('Invalid request with Google Places API'))
    } else if (statusCode === 'UNKNOWN_ERROR') {
      return next(new Error('Unknown error with Google Places API'))
    }

    coordinates = [
      geocodeResponse.data.results[0].geometry.location.lat,
      geocodeResponse.data.results[0].geometry.location.lng
    ]
  }

  let venuesFilters = {}

  if (queryParams.entryScore) {
    venuesFilters.entryScore = {
      $gte: parseFloat(queryParams.entryScore)
    }
  }

  if (queryParams.bathroomScore) {
    venuesFilters.bathroomScore = {
      $gte: parseFloat(queryParams.bathroomScore)
    }
  }

  if (queryParams.allowsGuideDog) {
    const allowsGuideDog = parseFloat(queryParams.allowsGuideDog) === 1
    if (allowsGuideDog) {
      venuesFilters['allowsGuideDog.yes'] = { $gte: 1 }
    } else {
      venuesFilters['allowsGuideDog.no'] = { $gte: 1 }
    }
  }

  if (queryParams.hasParking) {
    const hasParking = parseFloat(queryParams.hasParking) === 1
    if (hasParking) {
      venuesFilters['hasParking.yes'] = { $gte: 1 }
    } else {
      venuesFilters['hasParking.no'] = { $gte: 1 }
    }
  }

  if (queryParams.hasRamp) {
    const hasRamp = parseFloat(queryParams.hasRamp) === 1
    if (hasRamp) {
      venuesFilters['hasRamp.yes'] = { $gte: 1 }
    } else {
      venuesFilters['hasRamp.no'] = { $gte: 1 }
    }
  }

  if (queryParams.hasSecondEntry) {
    const hasSecondEntry = parseFloat(queryParams.hasSecondEntry) === 1
    if (hasSecondEntry) {
      venuesFilters['hasSecondEntry.yes'] = { $gte: 1 }
    } else {
      venuesFilters['hasSecondEntry.no'] = { $gte: 1 }
    }
  }

  if (queryParams.hasWellLit) {
    const hasWellLit = parseFloat(queryParams.hasWellLit) === 1
    if (hasWellLit) {
      venuesFilters['hasWellLit.yes'] = { $gte: 1 }
    } else {
      venuesFilters['hasWellLit.no'] = { $gte: 1 }
    }
  }

  if (queryParams.isQuiet) {
    const isQuiet = parseFloat(queryParams.isQuiet) === 1
    if (isQuiet) {
      venuesFilters['isQuiet.yes'] = { $gte: 1 }
    } else {
      venuesFilters['isQuiet.no'] = { $gte: 1 }
    }
  }

  if (queryParams.isSpacious) {
    const isSpacious = parseFloat(queryParams.isSpacious) === 1
    if (isSpacious) {
      venuesFilters['isSpacious.yes'] = { $gte: 1 }
    } else {
      venuesFilters['isSpacious.no'] = { $gte: 1 }
    }
  }

  if (queryParams.steps) {
    if (parseFloat(queryParams.steps) === 0) {
      venuesFilters['steps.zero'] = { $gte: 1 }
    } else if (parseFloat(queryParams.steps) === 1) {
      venuesFilters['steps.one'] = { $gte: 1 }
    } else if (parseFloat(queryParams.steps) === 2) {
      venuesFilters['steps.two'] = { $gte: 1 }
    } else if (parseFloat(queryParams.steps) === 3) {
      venuesFilters['steps.moreThanTwo'] = { $gte: 1 }
    }
  }

  let dataResponse

  if (!isEmpty(venuesFilters)) {
    venuesFilters.location = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coordinates[1], coordinates[0]]
        },
        $maxDistance: 50000
      }
    }

    if (queryParams.type) {
      venuesFilters.types = queryParams.type
    }

    venuesFilters.isArchived = false

    let page = 1
    if (isNumber(queryParams.page)) {
      page = queryParams.page
    }

    const pageLimit = 20

    if (page > 0) {
      page -= 1
    } else {
      return res
        .status(400)
        .json({ page: 'Should be equal to or greater than 1' })
    }

    let total
    let venues
    try {
      ;[venues, total] = await Promise.all([
        Venue.find(
          venuesFilters,
          'address allowsGuideDog bathroomScore entryScore hasParking hasSecondEntry hasWellLit isQuiet isSpacious location name photos placeId steps types'
        )
          .skip(page * pageLimit)
          .limit(pageLimit),
        Venue.find(venuesFilters).count()
      ])
    } catch (err) {
      logger.error(
        `Venues failed to be found or count at list-venues.\nvenuesQuery: ${JSON.stringify(
          venuesFilters
        )}`
      )
      return next(err)
    }

    venues = venues.map(venue =>
      Object.assign({}, venue.toObject(), {
        id: venue._id,
        _id: undefined,
        location: venue.coordinates
      })
    )

    const lastPage = Math.ceil(total / pageLimit)
    let nextPage
    if (lastPage > 0) {
      page += 1
      if (page > lastPage || page > 3) {
        return res.status(400).json({
          page: `Should be equal to or less than ${lastPage > 3 ? 3 : lastPage}`
        })
      }
    }

    dataResponse = {
      nextPage,
      results: venues
    }
  } else {
    let nearbyParams = `?key=${process.env.PLACES_API_KEY}`

    if (!queryParams.page) {
      nearbyParams = `${nearbyParams}&location=${coordinates[0]},${coordinates[1]}&rankby=distance`

      if (queryParams.type) {
        nearbyParams = `${nearbyParams}&type=${queryParams.type}`
      } else {
        nearbyParams = `${nearbyParams}&type=establishment`
      }
    } else {
      nearbyParams = `${nearbyParams}&pagetoken=${queryParams.page}`
    }

    let placesResponse
    try {
      placesResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json${nearbyParams}`
      )
    } catch (err) {
      logger.error(
        `Places failed to be found at list-venues.\nQuery Params: ${JSON.stringify(
          queryParams
        )}`
      )
      return next(err)
    }

    const statusCode = placesResponse.data.status
    if (statusCode === 'OVER_QUERY_LIMIT') {
      return next(new Error('Over query limit with Google Places API'))
    } else if (statusCode === 'REQUEST_DENIED') {
      return next(new Error('Request denied with Google Places API'))
    } else if (statusCode === 'INVALID_REQUEST') {
      return next(new Error('Invalid request with Google Places API'))
    } else if (statusCode === 'UNKNOWN_ERROR') {
      return next(new Error('Unknown error with Google Places API'))
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
        address: place.vicinity,
        location: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng
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
        return Object.assign({}, place, {
          allowsGuideDog: venue.allowsGuideDog,
          bathroomScore: venue.bathroomScore,
          entryScore: venue.entryScore,
          hasParking: venue.hasParking,
          hasSecondEntry: venue.hasSecondEntry,
          hasWellLit: venue.hasWellLit,
          isQuiet: venue.isQuiet,
          isSpacious: venue.isSpacious,
          steps: venue.steps
        })
      }

      return Object.assign({}, place, {
        allowsGuideDog: { yes: 0, no: 0 },
        bathroomReviews: 0,
        bathroomScore: null,
        entryReviews: 0,
        entryScore: null,
        hasParking: { yes: 0, no: 0 },
        hasSecondEntry: { yes: 0, no: 0 },
        hasWellLit: { yes: 0, no: 0 },
        isQuiet: { yes: 0, no: 0 },
        isSpacious: { yes: 0, no: 0 },
        steps: {
          zero: 0,
          one: 0,
          two: 0,
          moreThanTwo: 0
        }
      })
    })

    dataResponse = {
      nextPage: placesResponse.data.next_page_token,
      results: places
    }
  }

  return res.status(200).json(dataResponse)
}
