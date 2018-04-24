const mongoose = require('mongoose')

require('dotenv').config()

const logger = require('../../helpers/logger')
const { reviewSchema } = require('../../models/review')

const oldReviewSchema = require('./old-schemas/review')

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

    const OldReview = oldDb.model('reviews', oldReviewSchema)

    let totalOldReviews
    try {
      totalOldReviews = await OldReview.count()
    } catch (error) {
      logger.info('Old reviews failed to be count')
      logger.error(error)
      await closeConnections(db, oldDb)
    }

    logger.info(`Total old reviews: ${totalOldReviews}`)

    console.time('createReviews')

    let page = 0
    const pageLimit = 100
    let i = 0
    do {
      let oldReviews
      try {
        oldReviews = await OldReview.find({})
          .skip(page * pageLimit)
          .limit(pageLimit)
      } catch (error) {
        logger.info('Old reviews failed to be found')
        logger.error(error)
        await closeConnections(db, oldDb)
      }

      const Review = db.model('Review', reviewSchema)

      const createReviews = []
      for (let oldReview of oldReviews) {
        if (oldReview.venue_id && oldReview.user_id) {
          const reviewData = {
            _id: oldReview.id,
            allowsGuideDog: oldReview.guidedog,
            createdAt: oldReview.created_at,
            bathroomScore: oldReview.bathroom,
            entryScore: oldReview.entry,
            event: oldReview.event,
            hasParking: oldReview.parking,
            hasRamp: oldReview.ramp,
            hasSecondEntry: oldReview.secondentrance,
            hasWellLit: oldReview.welllit,
            isQuiet: oldReview.quiet,
            isSpacious: oldReview.spacious,
            steps: oldReview.steps,
            team: oldReview.team,
            updatedAt: oldReview.updated_at,
            user: oldReview.user_id,
            venue: oldReview.venue_id
          }

          if (oldReview.comment && oldReview.comment.length <= 300) {
            reviewData.comments = oldReview.comment
          }

          createReviews.push(Review.create(reviewData))
        }
      }

      try {
        await Promise.all(createReviews)
      } catch (error) {
        logger.info(
          `Reviews failed to be created.\nData: ${JSON.stringify({
            page,
            i
          })}`
        )
        logger.error(error)
        await closeConnections(db, oldDb)
      }

      page = page + 1
      i = i + oldReviews.length
      logger.info(i)
    } while (i < totalOldReviews)

    console.timeEnd('createReviews')

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
