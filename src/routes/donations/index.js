const express = require('express');

const cancelCheckout = require('./cancel-checkout');
const captureCheckout = require('./capture-checkout');
const createCheckout = require('./create-checkout');
const paypalWebhook = require('./paypal-webhook');

const router = new express.Router();

router.post('/paypal/checkout', createCheckout);
router.post('/paypal/capture', captureCheckout);
router.post('/paypal/webhook', paypalWebhook);
router.post('/:donationId/cancel', cancelCheckout);

module.exports = router;
