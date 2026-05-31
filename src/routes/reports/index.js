const express = require("express");

const { isAuthenticated } = require("../../helpers");

const createUserReport = require("./create-user-report");
const listUserReports = require("./list-user-reports");

const router = new express.Router();

router.post(
  "/users",
  isAuthenticated({ isOptional: false }),
  createUserReport
);
router.get("/users", isAuthenticated({ isOptional: false }), listUserReports);

module.exports = router;
