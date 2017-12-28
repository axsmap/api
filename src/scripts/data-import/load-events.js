const mongoose = require('mongoose')

require('dotenv').config({ path: '../../../.env' })

const logger = require('../../helpers/logger')
const { eventSchema } = require('../../models/event')

const oldEventsSchema = require('./old-schemas/event')

mongoose.Promise = global.Promise

async function closeConnections(db, oldDb) {
  try {
    await oldDb.close()
  } catch (error) {
    logger.error(error)
    process.exit(0)
  }

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

  const oldUri = process.env.OLD_DB_URI
  const oldDb = mongoose.createConnection(oldUri, options)

  oldDb.on('connected', async () => {
    logger.info('Connection to old DB established successfully')

    const oldEvent = oldDb.model('events', oldEventsSchema)

    let totalOldEvents
    try {
      totalOldEvents = await oldEvent.count()
    } catch (error) {
      logger.info('Old events failed to be count')
      logger.error(error)
      await closeConnections(db, oldDb)
    }

    logger.info(`Total old events: ${totalOldEvents}`)

    console.time('createEvents')

    let page = 0
    const pageLimit = 100
    let i = 0
    do {
      let oldEvents
      try {
        oldEvents = await oldEvent
          .find({})
          .skip(page * pageLimit)
          .limit(pageLimit)
      } catch (error) {
        logger.info('Old events failed to be found')
        logger.error(error)
        await closeConnections(db, oldDb)
      }

      const Event = db.model('Event', eventSchema)

      const createEvents = []
      for (let oldEventItem of oldEvents) {
        const participants = oldEventItem.members.map(member => member.user)
        const eventData = {
          _id: oldEventItem.id,
          createdAt: oldEventItem.created_at,
          creator: oldEventItem.creator,
          description: oldEventItem.description,
          endDate: oldEventItem.event_end,
          isApproved: oldEventItem.approved,
          name: oldEventItem.name,
          participants,
          participantsGoal: oldEventItem.participant_goal,
          poster: oldEventItem.image,
          reviewsGoal: oldEventItem.mapping_goal,
          startDate: oldEventItem.event_start,
          teams: oldEventItem.teams,
          updatedAt: oldEventItem.updated_at
        }

        createEvents.push(Event.create(eventData))
      }

      try {
        await Promise.all(createEvents)
      } catch (error) {
        logger.info(
          `Events failed to be created.\nData: ${JSON.stringify({
            page,
            i
          })}`
        )
        logger.error(error)
        await closeConnections(db, oldDb)
      }

      page = page + 1
      i = i + oldEvents.length
      logger.info(i)
    } while (i < totalOldEvents)

    console.timeEnd('createEvents')

    await closeConnections(db, oldDb)
  })

  oldDb.on('error', err => {
    logger.error('Connection to old DB failed ' + err)
    process.exit(0)
  })

  oldDb.on('disconnected', () => {
    logger.info('Connection from old DB closed')
  })
})

db.on('error', err => {
  logger.error('Connection to DB failed ' + err)
  process.exit(0)
})

db.on('disconnected', () => {
  logger.info('Connection from DB closed')
})
