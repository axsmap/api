const express = require("express");

const contact = require("./contact");
const migrateScores = require("./migrate-scores");
const survey = require("./survey");
const { runDailyCheck } = require("./inactivity-cron");
const { isAuthenticated } = require("../../helpers");

const router = new express.Router();

router.post("/contact", contact);
router.post("/survey", isAuthenticated({ isOptional: false }), survey);
router.get("/migrate-scores", migrateScores);

// Cron job endpoint for inactivity tracking
router.post("/cron/inactivity-check", runDailyCheck);

module.exports = router;
