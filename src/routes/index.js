const express = require('express')

const auth = require('./auth')
const events = require('./events')
const petitions = require('./petitions')
const reviews = require('./reviews')
const teams = require('./teams')
const users = require('./users')
const venues = require('./venues')

const router = new express.Router()

router.use('/auth', auth)
router.use('/events', events)
router.use('/petitions', petitions)
router.use('/reviews', reviews)
router.use('/teams', teams)
router.use('/users', users)
router.use('/venues', venues)

module.exports = router
