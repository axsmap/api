const express = require('express');

const contact = require('./contact');
const migrateScores = require('./migrate-scores');

const router = new express.Router();

router.post('/contact', contact);
router.get('/migrate-scores', migrateScores);

module.exports = router;
