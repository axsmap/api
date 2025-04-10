const express = require("express");

const { isAuthenticated } = require("../../helpers");

const createEvent = require("./create-event");
const deleteEvent = require("./delete-event");
const editEvent = require("./edit-event");
const getEvent = require("./get-event");
const leaveEvent = require("./leave-event");
const listEvents = require("./list-events");
const listOldEvents = require("./list-old-events");
const joinEvent = require("./join-event");
const listUpcoimgEvents = require("./list-upcoimg-events");

const router = new express.Router();

router.get("", listEvents);
router.get("/old", isAuthenticated({ isOptional: false }), listOldEvents);
router.get("/upComing", listUpcoimgEvents);
router.post("", isAuthenticated({ isOptional: false }), createEvent);
router.get("/:eventId", getEvent);
router.put("/:eventId", isAuthenticated({ isOptional: false }), editEvent);
router.delete("/:eventId", isAuthenticated({ isOptional: false }), deleteEvent);
router.post(
  "/:eventId/join",
  isAuthenticated({ isOptional: false }),
  joinEvent
);
router.put(
  "/:eventId/leave",
  isAuthenticated({ isOptional: false }),
  leaveEvent
);

module.exports = router;
