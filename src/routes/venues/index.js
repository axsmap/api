const express = require('express')

const { isAuthenticated } = require('../../helpers')

const addVenuePhoto = require('./add-venue-photo')
const archiveVenue = require('./archive-venue')
const flagVenuePhoto = require('./flag-venue-photo')
const getVenue = require('./get-venue')
const listVenues = require('./list-venues')
const removeVenuePhoto = require('./remove-venue-photo')

const router = new express.Router()

router.get('', listVenues)
router.get('/:placeId', getVenue)
router.put('/:venueId/archive', isAuthenticated, archiveVenue)
router.post('/:venueId/photos', isAuthenticated, addVenuePhoto)
router.delete('/:venueId/photos/:photoId', isAuthenticated, removeVenuePhoto)
router.post('/:venueId/photos/:photoId/flag', isAuthenticated, flagVenuePhoto)

module.exports = router
