const express = require('express')

const { isAuthenticated } = require('../../helpers')

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

router.get('', isAuthenticated, listEvents)
router.post('', isAuthenticated, createEvent)
router.get('/:eventID', isAuthenticated, getEvent)
router.put('/:eventID', isAuthenticated, editEvent)
router.delete('/:eventID', isAuthenticated, deleteEvent)
router.put('/:eventID/poster', isAuthenticated, uploadEventPoster)
router.put('/:eventID/leave', isAuthenticated, leaveEvent)
router.post('/:eventID/photos', isAuthenticated, addEventPhoto)
router.delete('/:eventID/photos/:photoID', isAuthenticated, removeEventPhoto)
router.post('/:eventID/photos/:photoID/flag', isAuthenticated, flagEventPhoto)
router.put('/:eventID/photos/:photoID/ban', isAuthenticated, banEventPhoto)
router.put('/:eventID/participate', isAuthenticated, participateEvent)

module.exports = router
