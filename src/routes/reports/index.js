const express = require('express');

const { isAuthenticated } = require('../../helpers');
const createUserReport = require('./create-user-report');
const listUserReports = require('./list-user-reports');

const router = new express.Router();

router.get('/users', isAuthenticated({ isOptional: false }), listUserReports);
router.post('/users', isAuthenticated({ isOptional: false }), createUserReport);

module.exports = router;
