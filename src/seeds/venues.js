const moment = require('moment')
const mongoose = require('mongoose')

require('dotenv').config()

const logger = require('../helpers/logger')
const { userSchema } = require('../models/user')
const { venueSchema } = require('../models/venue')

mongoose.Promise = global.Promise

const uri = process.env.MONGODB_URI
const options = {
  useMongoClient: true,
  socketTimeoutMS: 0,
  keepAlive: 2000
}
const db = mongoose.createConnection(uri, options)

db.on('connected', async () => {
  logger.info('Connection established successfully')

  const User = db.model('User', userSchema)
  const email = 'andrescabral.c@gmail.com'
  let user
  try {
    user = await User.findOne({ email })
  } catch (error) {
    logger.info(`User with email ${email} failed to be found.`)
    logger.error(error)
    db.disconnect()
  }

  logger.info(user.toObject())

  const Venue = db.model('Venue', venueSchema)

  try {
    await Venue.remove({})
  } catch (error) {
    logger.info('Venues failed to be removed.')
    logger.error(error)
    db.disconnect()
  }

  const reviewData = {
    allowsGuideDog: { yes: 1 },
    bathroomReviews: 2,
    bathroomScore: 4,
    entryReviews: 2,
    entryScore: 3.5,
    hasParking: { no: 2 },
    hasRamp: { yes: 2, no: 2 },
    hasSecondEntry: { no: 3 },
    hasWellLit: { yes: 4 },
    isQuiet: { yes: 3, no: 4 },
    isSpacious: { yes: 1, no: 5 },
    photos: [
      {
        uploadedAt: moment.utc().toDate(),
        url:
          'http://www.reduca-al.net/images/noticias/600_03_20_39_28_10_2013Fenaes_chico.jpg',
        user
      }
    ],
    steps: { moreThanTwo: 5 },
    types: ['point_of_interest', 'establishment']
  }
  const placesData = [
    {
      address: 'Av. Mariscal López 1750, Asunción, Paraguay',
      location: { coordinates: [-25.2928095, -57.60468599999999] },
      name: 'Juntos por la Educación',
      placeId: 'ChIJzVBztnioXZQRoZJG5GwaVGc'
    },
    {
      address: 'Avda Mcal Lopez, Asunción, Paraguay',
      location: { coordinates: [-25.2931905, -57.60397389999999] },
      name: 'Embassy of the United States',
      placeId: 'ChIJGY9NLnmoXZQRiqqJR6uwgZU'
    },
    {
      address: 'Av. Mariscal López 1730, Asunción 595, Paraguay',
      location: { coordinates: [-25.2930684, -57.605086] },
      name: 'Claro',
      placeId: 'ChIJ29ayuXioXZQR4gCvhQkwk1g'
    },
    {
      address: 'Fernando De La Mora, Paraguay',
      location: { coordinates: [-25.3170158, -57.5519492] },
      name: 'Plaza Villa Marangatu',
      placeId: 'ChIJfd8cQCuvXZQR3-0AecBLo5I'
    },
    {
      address: 'Villa Marangatu, Fernando De La Mora, Paraguay',
      location: { coordinates: [-25.3169936, -57.552135] },
      name: 'Plaza Yrendague',
      placeId: 'ChIJj1zeQCuvXZQR1ApZCWkCFgQ'
    }
  ]

  for (const place of placesData) {
    const venueData = Object.assign({}, reviewData, place)
    try {
      await Venue.create(venueData)
    } catch (error) {
      logger.info(
        `Venue failed to be created.\nData: ${JSON.stringify(venueData)}`
      )
      logger.error(error)
      db.disconnect()
    }
  }

  let venues
  try {
    venues = await Venue.find({})
  } catch (error) {
    logger.info('Venues failed to be found.')
    logger.error(error)
    db.disconnect()
  }

  for (const venue of venues) {
    logger.info(venue.toObject())
  }

  try {
    await db.close()
  } catch (error) {
    logger.error(error)
    process.exit(0)
  }
})

db.on('error', err => {
  logger.error('Connection to database failed ' + err)
})

db.on('disconnected', () => {
  logger.log('Connection closed')
  process.exit(0)
})

process.on('SIGINT', () => db.close())
