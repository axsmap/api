const express = require("express");

const { isAuthenticated } = require("../../helpers");

const archiveVenue = require("./archive-venue");
const getPlaceLocation = require("./get-place-location");
const getVenue = require("./get-venue");
const listVenues = require("./list-venues");
const searchPlaces = require("./search-places");
const venueDetails = require("./venue-details");

const router = new express.Router();

router.get("", isAuthenticated({ isOptional: true }), listVenues);
router.get("/places/autocomplete", searchPlaces);
router.get("/places/:placeId", getPlaceLocation);
// Place the more specific route before the generic "/:placeId" so it doesn't get
// captured by the parameterized route. If "/:placeId" is first, requests like
// "/detail/XYZ" are treated as placeId="detail" and never reach the detail
// handler.
router.get("/detail/:placeId", isAuthenticated({ isOptional: true }), venueDetails);
router.get("/:placeId", isAuthenticated({ isOptional: true }), getVenue);
router.put(
  "/:venueId/archive",
  isAuthenticated({ isOptional: false }),
  archiveVenue
);

module.exports = router;
