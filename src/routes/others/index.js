const express = require("express");

const contact = require("./contact");
const migrateScores = require("./migrate-scores");
const survey = require("./survey");

const router = new express.Router();

router.post("/contact", contact);
router.post("/survey", survey);
router.get("/migrate-scores", migrateScores);

module.exports = router;
