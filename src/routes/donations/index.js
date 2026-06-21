const express = require('express');

const { isAuthenticated } = require('../../helpers');

const cancelCheckout = require('./cancel-checkout');
const captureCheckout = require('./capture-checkout');
const closePledge = require('./close-pledge');
const createCheckout = require('./create-checkout');
const createPledge = require('./create-pledge');
const listPledgeSettlementCandidates = require('./list-pledge-settlement-candidates');
const listUserPledges = require('./list-user-pledges');
const paypalWebhook = require('./paypal-webhook');

const router = new express.Router();

router.post('/paypal/checkout', createCheckout);
router.post('/paypal/capture', captureCheckout);
router.post('/paypal/webhook', paypalWebhook);
router.post('/pledges', createPledge);
router.get(
  '/pledges/settlement-candidates',
  isAuthenticated({ isOptional: false }),
  listPledgeSettlementCandidates
);
router.post(
  '/pledges/:donationId/close',
  isAuthenticated({ isOptional: false }),
  closePledge
);
router.get(
  '/pledges/credited-user/:userId',
  isAuthenticated({ isOptional: false }),
  listUserPledges
);
router.post('/:donationId/cancel', cancelCheckout);

module.exports = router;
