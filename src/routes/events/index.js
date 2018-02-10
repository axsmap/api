const express = require('express')

const { isAuthenticated, isUnblocked } = require('../../helpers')

const addEventPhoto = require('./add-event-photo')
const banEventPhoto = require('./ban-event-photo')
const createEvent = require('./create-event')
const deleteEvent = require('./delete-event')
const editEvent = require('./edit-event')
const flagEventPhoto = require('./flag-event-photo')
const getEvent = require('./get-event')
const leaveEvent = require('./leave-event')
const listEvents = require('./list-events')
const participateEvent = require('./participate-event')
const removeEventPhoto = require('./remove-event-photo')
const uploadEventPoster = require('./upload-event-poster')

const router = new express.Router()

router.get('', listEvents)
router.post(
  '',
  isAuthenticated({ isOptional: false }),
  isUnblocked({ isOptional: false }),
  createEvent
)
router.get('/:eventId', isAuthenticated({ isOptional: false }), getEvent)
router.put('/:eventId', isAuthenticated({ isOptional: false }), editEvent)
router.delete('/:eventId', isAuthenticated({ isOptional: false }), deleteEvent)
router.put(
  '/:eventId/poster',
  isAuthenticated({ isOptional: false }),
  uploadEventPoster
)
router.put(
  '/:eventId/leave',
  isAuthenticated({ isOptional: false }),
  leaveEvent
)
router.post(
  '/:eventId/photos',
  isAuthenticated({ isOptional: false }),
  addEventPhoto
)
router.delete(
  '/:eventId/photos/:photoId',
  isAuthenticated({ isOptional: false }),
  removeEventPhoto
)
router.post(
  '/:eventId/photos/:photoId/flag',
  isAuthenticated({ isOptional: false }),
  flagEventPhoto
)
router.put(
  '/:eventId/photos/:photoId/ban',
  isAuthenticated({ isOptional: false }),
  banEventPhoto
)
router.put(
  '/:eventId/participate',
  isAuthenticated({ isOptional: false }),
  participateEvent
)

module.exports = router
