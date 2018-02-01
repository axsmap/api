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
router.post('', isAuthenticated, isUnblocked, createEvent)
router.get('/:eventId', isAuthenticated, getEvent)
router.put('/:eventId', isAuthenticated, editEvent)
router.delete('/:eventId', isAuthenticated, deleteEvent)
router.put('/:eventId/poster', isAuthenticated, uploadEventPoster)
router.put('/:eventId/leave', isAuthenticated, leaveEvent)
router.post('/:eventId/photos', isAuthenticated, addEventPhoto)
router.delete('/:eventId/photos/:photoId', isAuthenticated, removeEventPhoto)
router.post('/:eventId/photos/:photoId/flag', isAuthenticated, flagEventPhoto)
router.put('/:eventId/photos/:photoId/ban', isAuthenticated, banEventPhoto)
router.put('/:eventId/participate', isAuthenticated, participateEvent)

module.exports = router
