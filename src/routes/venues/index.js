const express = require("express");

const { isAuthenticated } = require("../../helpers");

const archiveVenue = require("./archive-venue");
const getVenue = require("./get-venue");
const listVenues = require("./list-venues");
const venueDetails = require("./venue-details");

const router = new express.Router();

router.get("", isAuthenticated({ isOptional: true }), listVenues);
// Place the more specific route before the generic "/:placeId" so it doesn't get
// captured by the parameterized route. If "/:placeId" is first, requests like
// "/detail/XYZ" are treated as placeId="detail" and never reach the detail
// handler.
router.get("/detail/:placeId", venueDetails);
router.get("/:placeId", getVenue);
router.put(
  "/:venueId/archive",
  isAuthenticated({ isOptional: false }),
  archiveVenue
);

module.exports = router;
