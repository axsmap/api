const express = require('express');

const contact = require('./contact');

const router = new express.Router();

router.post('/contact', contact);

module.exports = router;
