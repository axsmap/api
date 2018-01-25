const mongoose = require('mongoose')

require('dotenv').config()

const logger = require('../../helpers/logger')
const { eventSchema } = require('../../models/event')
const { reviewSchema } = require('../../models/review')

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
  const Review = db.model('Review', reviewSchema)

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
      logger.info('Teams failed to be found')
      logger.error(error)
      await closeConnections(db)
    }

    const updateEvents = []
    for (let event of events) {
      let eventReviews
      try {
        eventReviews = await Review.find({ event: event.id }).count()
      } catch (err) {
        logger.info('Event reviews failed to be count')
        logger.error(err)
        await closeConnections(db)
      }

      event.reviewsAmount = eventReviews
      updateEvents.push(event.save())
    }

    try {
      await Promise.all(updateEvents)
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

    page = page + 1
    i = i + events.length
    logger.info(i)
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
