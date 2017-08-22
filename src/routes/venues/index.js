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
router.get('/:venueID', isAuthenticated, getVenue)
router.put('/:venueID/archive', isAuthenticated, archiveVenue)
router.post('/:venueID/photos', isAuthenticated, addVenuePhoto)
router.delete('/:venueID/photos/:photoID', isAuthenticated, removeVenuePhoto)
router.post('/:venueID/photos/:photoID/flag', isAuthenticated, flagVenuePhoto)

module.exports = router
