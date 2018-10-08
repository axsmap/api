const express = require('express');

const { isAuthenticated } = require('../../helpers');

const banReview = require('./ban-review');
const createReview = require('./create-review');
const editReview = require('./edit-review');
const flagReview = require('./flag-review');
const listReviews = require('./list-reviews');
const voteReview = require('./vote-review');

const router = new express.Router();

router.get('', isAuthenticated({ isOptional: false }), listReviews);
router.post('', isAuthenticated({ isOptional: false }), createReview);
router.put('/:reviewId', isAuthenticated({ isOptional: false }), editReview);
router.put(
  '/:reviewId/vote',
  isAuthenticated({ isOptional: false }),
  voteReview
);
router.post(
  '/:reviewId/flag',
  isAuthenticated({ isOptional: false }),
  flagReview
);
router.put('/:reviewId/ban', isAuthenticated({ isOptional: false }), banReview);

module.exports = router;
