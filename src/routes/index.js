const express = require("express");

const auth = require("./auth");
const events = require("./events");
const others = require("./others");
const petitions = require("./petitions");
const photos = require("./photos");
const reviews = require("./reviews");
const teams = require("./teams");
const users = require("./users");
const venues = require("./venues");
const donations = require("./donatins");

const router = new express.Router();

router.use("", others);
router.use("/auth", auth);
router.use("/events", events);
router.use("/petitions", petitions);
router.use("/photos", photos);
router.use("/reviews", reviews);
router.use("/teams", teams);
router.use("/users", users);
router.use("/venues", venues);
router.use("/donations", donations);

module.exports = router;
