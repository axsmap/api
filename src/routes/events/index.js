const express = require('express')

const { isAuthenticated, isUnblocked } = require('../../helpers')

const createEvent = require('./create-event')
const deleteEvent = require('./delete-event')
const editEvent = require('./edit-event')
const getEvent = require('./get-event')
const leaveEvent = require('./leave-event')
const listEvents = require('./list-events')
const participateEvent = require('./participate-event')

const router = new express.Router()

router.get('', listEvents)
router.post(
  '',
  isAuthenticated({ isOptional: false }),
  isUnblocked({ isOptional: false }),
  createEvent
)
router.get('/:eventId', getEvent)
router.put(
  '/:eventId',
  isAuthenticated({ isOptional: false }),
  isUnblocked({ isOptional: false }),
  editEvent
)
router.delete(
  '/:eventId',
  isAuthenticated({ isOptional: false }),
  isUnblocked({ isOptional: false }),
  deleteEvent
)
router.put(
  '/:eventId/leave',
  isAuthenticated({ isOptional: false }),
  isUnblocked({ isOptional: false }),
  leaveEvent
)
router.put(
  '/:eventId/participate',
  isAuthenticated({ isOptional: false }),
  isUnblocked({ isOptional: false }),
  participateEvent
)

module.exports = router
