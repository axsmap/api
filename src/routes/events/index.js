const express = require('express');

const { isAuthenticated } = require('../../helpers');

const createEvent = require('./create-event');
const deleteEvent = require('./delete-event');
const editEvent = require('./edit-event');
const getEvent = require('./get-event');
const getInviteLink = require('./get-invite-link');
const getMapathonLeaderboard = require('./get-mapathon-leaderboard');
const getOverallLeaderboard = require('./get-overall-leaderboard');
const listJoinedEvents = require('./list-joined-events');
const leaveEvent = require('./leave-event');
const listEvents = require('./list-events');
const listOldEvents = require('./list-old-events');
const listUpcomingEvents = require('./list-upcoming-events');
const joinEvent = require('./join-event');
const updateParticipantFundraisingGoal = require('./update-participant-fundraising-goal');
const updateParticipantGoal = require('./update-participant-goal');
const updateParticipantVisibility = require('./update-participant-visibility');

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
router.get(
  '/:eventId/invite-link',
  isAuthenticated({ isOptional: false }),
  getInviteLink
);
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
router.patch(
  '/:eventId/participants/:userId/goal',
  isAuthenticated({ isOptional: false }),
  updateParticipantGoal
);
router.patch(
  '/:eventId/participants/:userId/fundraising-goal',
  isAuthenticated({ isOptional: false }),
  updateParticipantFundraisingGoal
);
router.patch(
  '/:eventId/participants/:userId/visibility',
  isAuthenticated({ isOptional: false }),
  updateParticipantVisibility
);

module.exports = router;
