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
router.put('/:reviewId', isAuthenticated, editReview)
router.put('/:reviewId/vote', isAuthenticated, voteReview)
router.post('/:reviewId/flag', isAuthenticated, flagReview)
router.put('/:reviewId/ban', isAuthenticated, banReview)

module.exports = router
