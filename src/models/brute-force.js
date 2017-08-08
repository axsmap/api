const bruteForceSchema = require('express-brute-mongoose/dist/schema')
const mongoose = require('mongoose')

module.exports = mongoose.model('BruteForce', bruteForceSchema)
