const express = require('express');

const { isAuthenticated } = require('../../helpers');

const createEvent = require('./create-event');
const deleteEvent = require('./delete-event');
const editEvent = require('./edit-event');
const getEvent = require('./get-event');
const leaveEvent = require('./leave-event');
const listEvents = require('./list-events');
const joinEvent = require('./join-event');

const router = new express.Router();

router.get('', listEvents);
router.post('', isAuthenticated({ isOptional: false }), createEvent);
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
