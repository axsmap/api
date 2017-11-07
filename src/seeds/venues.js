const mongoose = require('mongoose')

require('dotenv').config()

const logger = require('../helpers/logger')

const uri = process.env.MONGODB_URI
const options = {
  useMongoClient: true,
  promiseLibrary: global.Promise,
  socketTimeoutMS: 0,
  keepAlive: 2000
}
const connection = mongoose.createConnection(uri, options)

connection.on('connected', () =>
  logger.info('Connection established successfully')
)

connection.on('error', err => {
  logger.error('Connection to database failed ' + err)
})

connection.on('disconnected', () => logger.log('Connection closed'))

process.on('SIGINT', () =>
  connection.close(() => {
    logger.log('Connection closed through termination')
    process.exit(0)
  })
)
