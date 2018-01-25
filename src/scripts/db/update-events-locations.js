const axios = require('axios')
const mongoose = require('mongoose')

require('dotenv').config()

const logger = require('../../helpers/logger')
const { eventSchema } = require('../../models/event')
const { venueSchema } = require('../../models/venue')

mongoose.Promise = global.Promise

async function closeConnections(db) {
  try {
    await db.close()
  } catch (error) {
    logger.error(error)
    process.exit(0)
  }

  process.exit(0)
}

const uri = process.env.MONGODB_URI
const options = {
  useMongoClient: true,
  socketTimeoutMS: 0,
  keepAlive: 2000
}
const db = mongoose.createConnection(uri, options)

db.on('connected', async () => {
  logger.info('Connection to DB established successfully')

  const Event = db.model('Event', eventSchema)
  const Venue = db.model('Venue', venueSchema)

  let totalEvents
  try {
    totalEvents = await Event.count()
  } catch (error) {
    logger.info('Events failed to be count')
    logger.error(error)
    await closeConnections(db)
  }

  logger.info(`Total events: ${totalEvents}`)

  let i = 0
  let page = 0
  const pageLimit = 100
  do {
    let events
    try {
      events = await Event.find({}).skip(page * pageLimit).limit(pageLimit)
    } catch (error) {
      logger.info('Events failed to be found')
      logger.error(error)
      await closeConnections(db)
    }

    logger.info(`${events.length} events found`)

    const getVenues = events.map(e => Venue.findOne({ _id: e.venue }))
    let venues
    try {
      venues = await Promise.all(getVenues)
    } catch (err) {
      logger.info('Venues failed to be found')
      logger.error(err)
      await closeConnections(db)
    }

    logger.info(`${venues.length} venues found`)

    const getPlaces = venues.map(v => {
      if (v) {
        return axios.get(
          `https://maps.googleapis.com/maps/api/place/details/json?placeid=${v.placeId}&key=${process
            .env.PLACES_API_KEY}`
        )
      }
    })
    let places
    try {
      places = await Promise.all(getPlaces)
    } catch (err) {
      logger.info('Places failed to be found')
      logger.error(err)
      await closeConnections(db)
    }

    logger.info(`${places.length} places found`)

    const updateEvents = []
    const removeEvents = []
    places.map((p, i) => {
      if ((p && p.data && p.data.result) || venues[i]) {
        const place = p && p.data && p.data.result ? p.data.result : undefined
        const event = events[i]
        event.address = place ? place.formatted_address : venues[i].address
        event.location.coordinates = place
          ? [place.geometry.location.lng, place.geometry.location.lat]
          : venues[i].location.coordinates
        updateEvents.push(event.save())
      } else {
        const event = events[i]
        removeEvents.push(event.remove())
      }
    })
    try {
      await Promise.all([...updateEvents, ...removeEvents])
    } catch (err) {
      logger.info(
        `Events failed to be updated.\nData: ${JSON.stringify({
          page,
          i
        })}`
      )
      logger.error(err)
      await closeConnections(db)
    }

    logger.info('Events updated')

    page = page + 1
    i = i + events.length
    logger.info(i)

    try {
      totalEvents = await Event.count()
    } catch (error) {
      logger.info('Events failed to be count')
      logger.error(error)
      await closeConnections(db)
    }
  } while (i < totalEvents)

  await closeConnections(db)
})

db.on('error', err => {
  logger.error('Connection to DB failed ' + err)
  process.exit(0)
})

db.on('disconnected', () => {
  logger.info('Connection from DB closed')
})
