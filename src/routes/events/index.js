const express = require('express');

const { isAuthenticated } = require('../../helpers');

const createEvent = require('./create-event');
const deleteEvent = require('./delete-event');
const editEvent = require('./edit-event');
const getEvent = require('./get-event');
const getMapathonLeaderboard = require('./get-mapathon-leaderboard');
const getOverallLeaderboard = require('./get-overall-leaderboard');
const listJoinedEvents = require('./list-joined-events');
const leaveEvent = require('./leave-event');
const listEvents = require('./list-events');
const listOldEvents = require('./list-old-events');
const listUpcomingEvents = require('./list-upcoming-events');
const joinEvent = require('./join-event');

const router = new express.Router();

router.get('', listEvents);
router.post('', isAuthenticated({ isOptional: false }), createEvent);
router.get('/leaderboard/overall', getOverallLeaderboard);
router.get(
  '/joinedEvents',
  isAuthenticated({ isOptional: false }),
  listJoinedEvents
);
router.get('/old', listOldEvents);
router.get('/upComing', listUpcomingEvents);
router.get('/:eventId/leaderboard', getMapathonLeaderboard);
router.get('/:eventId', getEvent);
router.put('/:eventId', isAuthenticated({ isOptional: false }), editEvent);
router.delete('/:eventId', isAuthenticated({ isOptional: false }), deleteEvent);
router.post(
  '/:eventId/join',
  isAuthenticated({ isOptional: false }),
  joinEvent
);
router.put(
  '/:eventId/leave',
  isAuthenticated({ isOptional: false }),
  leaveEvent
);

module.exports = router;
