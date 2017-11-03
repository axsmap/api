const axios = require('axios')
const { find, isEmpty } = require('lodash')

const { isNumber } = require('../../helpers')
const logger = require('../../helpers/logger')
const Venue = require('../../models/venue')

const { validateListVenues } = require('./validations')

module.exports = async (req, res, next) => {
  const queryParams = req.query
  const { errors, isValid } = validateListVenues(queryParams)

  if (!isValid) {
    return res.status(400).json(errors)
  }

  let venuesQuery = {}

  if (queryParams.bathroomScore) {
    venuesQuery.bathroomScore = {
      $gte: queryParams.bathroomScore,
      $lt: queryParams.bathroomScore + 1
    }
  }

  if (queryParams.entryScore) {
    venuesQuery.entryScore = {
      $gte: queryParams.entryScore,
      $lt: queryParams.entryScore + 1
    }
  }

  if (typeof queryParams.allowsGuideDog !== 'undefined') {
    const allowsGuideDog = parseFloat(queryParams.allowsGuideDog) === 1
    if (allowsGuideDog) {
      venuesQuery.allowsGuideDog.yes = { $gte: 1 }
    } else {
      venuesQuery.allowsGuideDog.no = { $gte: 1 }
    }
  }

  if (typeof queryParams.hasParking !== 'undefined') {
    const hasParking = parseFloat(queryParams.hasParking) === 1
    if (hasParking) {
      venuesQuery.hasParking.yes = { $gte: 1 }
    } else {
      venuesQuery.hasParking.no = { $gte: 1 }
    }
  }

  if (typeof queryParams.hasRamp !== 'undefined') {
    const hasRamp = parseFloat(queryParams.hasRamp) === 1
    if (hasRamp) {
      venuesQuery.hasRamp.yes = { $gte: 1 }
    } else {
      venuesQuery.hasRamp.no = { $gte: 1 }
    }
  }

  if (typeof queryParams.hasSecondEntry !== 'undefined') {
    const hasSecondEntry = parseFloat(queryParams.hasSecondEntry) === 1
    if (hasSecondEntry) {
      venuesQuery.hasSecondEntry.yes = { $gte: 1 }
    } else {
      venuesQuery.hasSecondEntry.no = { $gte: 1 }
    }
  }

  if (typeof queryParams.hasWellLit !== 'undefined') {
    const hasWellLit = parseFloat(queryParams.hasWellLit) === 1
    if (hasWellLit) {
      venuesQuery.hasWellLit.yes = { $gte: 1 }
    } else {
      venuesQuery.hasWellLit.no = { $gte: 1 }
    }
  }

  if (typeof queryParams.isQuiet !== 'undefined') {
    const isQuiet = parseFloat(queryParams.isQuiet) === 1
    if (isQuiet) {
      venuesQuery.isQuiet.yes = { $gte: 1 }
    } else {
      venuesQuery.isQuiet.no = { $gte: 1 }
    }
  }

  if (typeof queryParams.isSpacious !== 'undefined') {
    const isSpacious = parseFloat(queryParams.isSpacious) === 1
    if (isSpacious) {
      venuesQuery.isSpacious.yes = { $gte: 1 }
    } else {
      venuesQuery.isSpacious.no = { $gte: 1 }
    }
  }

  if (typeof queryParams.steps !== 'undefined') {
    if (parseFloat(queryParams.steps) === 0) {
      venuesQuery.steps.zero = { $gte: 1 }
    } else if (parseFloat(queryParams.steps) === 1) {
      venuesQuery.steps.one = { $gte: 1 }
    } else if (parseFloat(queryParams.steps) === 2) {
      venuesQuery.steps.two = { $gte: 1 }
    } else if (parseFloat(queryParams.steps) === 3) {
      venuesQuery.steps.moreThanTwo = { $gte: 1 }
    }
  }

  let dataResponse

  if (!isEmpty(venuesQuery)) {
    if (queryParams.keywords) {
      venuesQuery.$text = { $search: queryParams.keywords }
    }

    const coordinates = queryParams.location.split(',')
    queryParams.location = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coordinates[1], coordinates[0]]
        },
        $maxDistance: 5000
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

    const pageLimit = 6

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
        Venue.find(venuesQuery)
          .select(
            '-__v -bathroomReviews -createdAt -entryReviews -isArchived -reviews -updatedAt'
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

    const lastPage = Math.ceil(total / pageLimit)
    let last = `${process.env.API_URL}/venues?page=${lastPage}`
    if (lastPage > 0) {
      page += 1
      if (page > lastPage) {
        return res
          .status(400)
          .json({ page: `Should be equal to or less than ${lastPage}` })
      }
    } else {
      last = null
      page = null
    }

    dataResponse = {
      last,
      page,
      results: venues
    }
  } else {
    let placesQuery = `?key=${process.env.PLACES_API_KEY}`

    if (!queryParams.page) {
      placesQuery = `${placesQuery}&location=${queryParams.location}&rankby=distance`

      if (queryParams.keywords) {
        placesQuery = `${placesQuery}&keyword=${queryParams.keywords}`
      }

      if (queryParams.language) {
        placesQuery = `${placesQuery}&language=${queryParams.language}`
      } else {
        placesQuery = `${placesQuery}&language=en`
      }

      if (queryParams.type) {
        placesQuery = `${placesQuery}&type=${queryParams.type}`
      } else {
        placesQuery = `${placesQuery}&type=establishment`
      }
    } else {
      placesQuery = `${placesQuery}&pagetoken=${queryParams.page}`
    }

    let placesResponse
    try {
      placesResponse = await axios.get(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json${placesQuery}`
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

    dataResponse = {
      nextPage: placesResponse.data.next_page_token,
      results: places
    }
  }

  return res.status(200).json(dataResponse)
}
