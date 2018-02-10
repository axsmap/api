const express = require('express')

const { isAuthenticated } = require('../../helpers')

const archiveVenue = require('./archive-venue')
const getVenue = require('./get-venue')
const listVenues = require('./list-venues')

const router = new express.Router()

router.get('', listVenues)
router.get('/:placeId', getVenue)
router.put(
  '/:venueId/archive',
  isAuthenticated({ isOptional: false }),
  archiveVenue
)

module.exports = router
