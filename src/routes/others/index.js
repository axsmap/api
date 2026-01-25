const express = require("express");

const contact = require("./contact");
const migrateScores = require("./migrate-scores");
const survey = require("./survey");
const { runDailyCheck, runWeeklyReportEndpoint } = require("./inactivity-cron");
const { isAuthenticated } = require("../../helpers");

const router = new express.Router();

router.post("/contact", contact);
router.post("/survey", isAuthenticated({ isOptional: false }), survey);
router.get("/migrate-scores", migrateScores);

// Cron job endpoints for inactivity tracking
router.post("/cron/inactivity-check", runDailyCheck);
router.post("/cron/weekly-report", runWeeklyReportEndpoint);

module.exports = router;
