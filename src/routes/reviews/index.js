const express = require('express')

const { isAuthenticated } = require('../../helpers')

const banReview = require('./ban-review')
const createReview = require('./create-review')
const editReview = require('./edit-review')
const flagReview = require('./flag-review')
const listReviews = require('./list-reviews')
const voteReview = require('./vote-review')

const router = new express.Router()

router.get('', isAuthenticated, listReviews)
router.post('', isAuthenticated, createReview)
router.put('/:reviewID', isAuthenticated, editReview)
router.put('/:reviewID/vote', isAuthenticated, voteReview)
router.post('/:reviewID/flag', isAuthenticated, flagReview)
router.put('/:reviewID/ban', isAuthenticated, banReview)

module.exports = router
