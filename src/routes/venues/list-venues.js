const axios = require('axios')
const { find, intersection, isEmpty } = require('lodash')

const { directionsTypes } = require('../../helpers/constants')
const { isNumber } = require('../../helpers')
const logger = require('../../helpers/logger')
const { Venue } = require('../../models/venue')

const { validateListVenues } = require('./validations')

module.exports = async (req, res, next) => {
  const queryParams = req.query
  const { errors, isValid } = validateListVenues(queryParams)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  let venuesQuery = {}

  if (queryParams.entryScore) {
    venuesQuery.entryScore = {
      $gte: parseFloat(queryParams.entryScore),
      $lt: parseFloat(queryParams.entryScore) + 1
    }
  }

  if (queryParams.bathroomScore) {
    venuesQuery.bathroomScore = {
      $gte: parseFloat(queryParams.bathroomScore),
      $lt: parseFloat(queryParams.bathroomScore) + 1
    }
  }

  if (queryParams.allowsGuideDog) {
    const allowsGuideDog = parseFloat(queryParams.allowsGuideDog) === 1
    if (allowsGuideDog) {
      venuesQuery['allowsGuideDog.yes'] = { $gte: 1 }
    } else {
      venuesQuery['allowsGuideDog.no'] = { $gte: 1 }
    }
  }

  if (queryParams.hasParking) {
    const hasParking = parseFloat(queryParams.hasParking) === 1
    if (hasParking) {
      venuesQuery['hasParking.yes'] = { $gte: 1 }
    } else {
      venuesQuery['hasParking.no'] = { $gte: 1 }
    }
  }

  if (queryParams.hasRamp) {
    const hasRamp = parseFloat(queryParams.hasRamp) === 1
    if (hasRamp) {
      venuesQuery['hasRamp.yes'] = { $gte: 1 }
    } else {
      venuesQuery['hasRamp.no'] = { $gte: 1 }
    }
  }

  if (queryParams.hasSecondEntry) {
    const hasSecondEntry = parseFloat(queryParams.hasSecondEntry) === 1
    if (hasSecondEntry) {
      venuesQuery['hasSecondEntry.yes'] = { $gte: 1 }
    } else {
      venuesQuery['hasSecondEntry.no'] = { $gte: 1 }
    }
  }

  if (queryParams.hasWellLit) {
    const hasWellLit = parseFloat(queryParams.hasWellLit) === 1
    if (hasWellLit) {
      venuesQuery['hasWellLit.yes'] = { $gte: 1 }
    } else {
      venuesQuery['hasWellLit.no'] = { $gte: 1 }
    }
  }

  if (queryParams.isQuiet) {
    const isQuiet = parseFloat(queryParams.isQuiet) === 1
    if (isQuiet) {
      venuesQuery['isQuiet.yes'] = { $gte: 1 }
    } else {
      venuesQuery['isQuiet.no'] = { $gte: 1 }
    }
  }

  if (queryParams.isSpacious) {
    const isSpacious = parseFloat(queryParams.isSpacious) === 1
    if (isSpacious) {
      venuesQuery['isSpacious.yes'] = { $gte: 1 }
    } else {
      venuesQuery['isSpacious.no'] = { $gte: 1 }
    }
  }

  if (queryParams.steps) {
    if (parseFloat(queryParams.steps) === 0) {
      venuesQuery['steps.zero'] = { $gte: 1 }
    } else if (parseFloat(queryParams.steps) === 1) {
      venuesQuery['steps.one'] = { $gte: 1 }
    } else if (parseFloat(queryParams.steps) === 2) {
      venuesQuery['steps.two'] = { $gte: 1 }
    } else if (parseFloat(queryParams.steps) === 3) {
      venuesQuery['steps.moreThanTwo'] = { $gte: 1 }
    }
  }

  let dataResponse

  if (!isEmpty(venuesQuery)) {
    if (queryParams.keywords) {
      venuesQuery.$text = { $search: queryParams.keywords }
    }

    const coordinates = queryParams.location.split(',')
    venuesQuery.location = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coordinates[1], coordinates[0]]
        },
        $maxDistance: 50000
      }
    }

    if (queryParams.type) {
      venuesQuery.types = queryParams.type
    }

    venuesQuery.isArchived = false

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
          venuesQuery,
          'address allowsGuideDog bathroomScore entryScore hasParking hasSecondEntry hasWellLit isQuiet isSpacious location name photos placeId steps types'
        )
          .skip(page * pageLimit)
          .limit(pageLimit),
        Venue.find(venuesQuery).count()
      ])
    } catch (err) {
      logger.error(
        `Venues failed to be found or count at list-venues.\nvenuesQuery: ${JSON.stringify(
          venuesQuery
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
    let useTextSearch = false
    let placesQuery = `?key=${process.env.PLACES_API_KEY}`

    if (!queryParams.page) {
      if (queryParams.keywords) {
        useTextSearch = true
        placesQuery = `${placesQuery}&query=${escape(
          queryParams.keywords
        )}&location=${queryParams.location}&radius=50000`
      } else {
        placesQuery = `${placesQuery}&location=${queryParams.location}&rankby=distance`
      }

      if (!useTextSearch) {
        if (queryParams.type) {
          placesQuery = `${placesQuery}&type=${queryParams.type}`
        } else {
          placesQuery = `${placesQuery}&type=establishment`
        }
      }
    } else {
      placesQuery = `${placesQuery}&pagetoken=${queryParams.page}`
    }

    let placesResponse
    try {
      if (useTextSearch) {
        placesResponse = await axios.get(
          `https://maps.googleapis.com/maps/api/place/textsearch/json${placesQuery}`
        )
      } else {
        placesResponse = await axios.get(
          `https://maps.googleapis.com/maps/api/place/nearbysearch/json${placesQuery}`
        )
      }
    } catch (err) {
      logger.error(
        `Places failed to be found at list-venues.\nQuery Params: ${JSON.stringify(
          queryParams
        )}`
      )
      return next(err)
    }

    if (placesResponse.data.results.length > 0 && !queryParams.page) {
      console.log(JSON.stringify(placesResponse.data.results, null, 2))
      const firstPlace = placesResponse.data.results[0]
      const firstPlaceTypes = firstPlace.types
      const commonTypes = intersection(firstPlaceTypes, directionsTypes)
      if (commonTypes.length > 0) {
        try {
          placesResponse = await axios.get(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=${process
              .env.PLACES_API_KEY}&location=${firstPlace.geometry.location
              .lat},${firstPlace.geometry.location
              .lng}&rankby=distance&type=${queryParams.type || 'establishment'}`
          )
        } catch (err) {
          logger.error(
            `Places failed to be found at list-venues.\nQuery Params: ${JSON.stringify(
              queryParams
            )}`
          )
          return next(err)
        }
      } else {
        try {
          placesResponse = await axios.get(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json?key=${process
              .env.PLACES_API_KEY}&keyword=${escape(
              queryParams.keywords
            )}&location=${firstPlace.geometry.location.lat},${firstPlace
              .geometry.location.lng}&rankby=distance&type=${queryParams.type ||
              'establishment'}`
          )
        } catch (err) {
          logger.error(
            `Places failed to be found at list-venues.\nQuery Params: ${JSON.stringify(
              queryParams
            )}`
          )
          return next(err)
        }
      }
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
