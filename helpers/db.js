const mongoose = require('mongoose')

mongoose.Promise = global.Promise
let isConnected

module.exports.connectToDatabase = () => {
  if (isConnected) {
    console.log('Using existing database connection')
    return Promise.resolve()
  }

  console.log('Using new database connection')

  const mongodbURI = process.env.MONGODB_URI
  const options = {
    connectTimeoutMS: 30000,
    keepAlive: 120
  }

  return mongoose.connect(mongodbURI, options).then(db => {
    isConnected = db.connections[0].readyState
  })
}
