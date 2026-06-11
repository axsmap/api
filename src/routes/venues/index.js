const express = require('express');

const { isAuthenticated } = require('../../helpers');

const archiveVenue = require('./archive-venue');
const getPlaceLocation = require('./get-place-location');
const getVenue = require('./get-venue');
const listVenues = require('./list-venues');
const searchPlaces = require('./search-places');

const router = new express.Router();

router.get('', listVenues);
router.get('/places/autocomplete', searchPlaces);
router.get('/places/:placeId', getPlaceLocation);
router.get('/detail/:placeId', getVenue);
router.get('/:placeId', getVenue);
router.put(
  '/:venueId/archive',
  isAuthenticated({ isOptional: false }),
  archiveVenue
);

module.exports = router;
