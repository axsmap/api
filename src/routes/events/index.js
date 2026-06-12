const express = require("express");

const { isAuthenticated } = require("../../helpers");

const createEvent = require("./create-event");
const deleteEvent = require("./delete-event");
const editEvent = require("./edit-event");
const getEvent = require("./get-event");
const getParticipant = require("./get-participant");
const leaveEvent = require("./leave-event");
const listEventLeaderboard = require("./list-event-leaderboard");
const listEvents = require("./list-events");
const listOldEvents = require("./list-old-events");
const joinEvent = require("./join-event");
const listUpcoimgEvents = require("./list-upcoimg-events");
const JoinedEvents = require("./joined-events");
const publishEvent = require("./publish-event");
const updateParticipantGoal = require("./update-participant-goal");
const updateParticipantMessage = require("./update-participant-message");
const updateParticipantVisibility = require("./update-participant-visibility");

const router = new express.Router();

router.get("", isAuthenticated({ isOptional: true }), listEvents);
router.get("/joinedEvents", JoinedEvents);
router.get("/old", isAuthenticated({ isOptional: false }), listOldEvents);
router.get("/upComing", listUpcoimgEvents);
router.post("", isAuthenticated({ isOptional: false }), createEvent);
router.get(
  "/:eventId/leaderboard",
  isAuthenticated({ isOptional: true }),
  listEventLeaderboard
);
router.get("/:eventId", getEvent);
router.put("/:eventId", isAuthenticated({ isOptional: false }), editEvent);
router.put(
  "/:eventId/publish",
  isAuthenticated({ isOptional: false }),
  publishEvent
);
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
router.get(
  "/:eventId/participants/:userId",
  isAuthenticated({ isOptional: true }),
  getParticipant
);
router.patch(
  "/:eventId/participants/:userId/message",
  isAuthenticated({ isOptional: false }),
  updateParticipantMessage
);
router.patch(
  "/:eventId/participants/:userId/goal",
  isAuthenticated({ isOptional: false }),
  updateParticipantGoal
);
router.patch(
  "/:eventId/participants/:userId/visibility",
  isAuthenticated({ isOptional: false }),
  updateParticipantVisibility
);

module.exports = router;
