const express = require("express");

const auth = require("./auth");
const connections = require("./connections");
const events = require("./events");
const invites = require("./invites");
const others = require("./others");
const petitions = require("./petitions");
const photos = require("./photos");
const reports = require("./reports");
const reviews = require("./reviews");
const teams = require("./teams");
const users = require("./users");
const venues = require("./venues");
const donations = require("./donatins");

const router = new express.Router();

router.use("", others);
router.use("/auth", auth);
router.use("/connections", connections);
router.use("/events", events);
router.use("/invites", invites);
router.use("/petitions", petitions);
router.use("/photos", photos);
router.use("/reports", reports);
router.use("/reviews", reviews);
router.use("/teams", teams);
router.use("/users", users);
router.use("/venues", venues);
router.use("/donations", donations);

module.exports = router;
