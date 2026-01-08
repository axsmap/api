const express = require("express");

const contact = require("./contact");
const migrateScores = require("./migrate-scores");
const survey = require("./survey");
const triggerNotifications = require("./trigger-notifications");
const { isAuthenticated } = require("../../helpers");

const router = new express.Router();

router.post("/contact", contact);
router.post("/survey", isAuthenticated({ isOptional: false }), survey);
router.get("/migrate-scores", migrateScores);
router.post(
  "/trigger-notifications",
  isAuthenticated({ isOptional: false }),
  triggerNotifications
);

module.exports = router;
