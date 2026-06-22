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
const salesforcePaymentConfirmation = require('./salesforce-payment-confirmation');
const syncPledgeSalesforce = require('./sync-pledge-salesforce');
const syncFlatDonationSalesforce = require('./sync-flat-donation-salesforce-route');

const router = new express.Router();

router.post('/paypal/checkout', createCheckout);
router.post('/paypal/capture', captureCheckout);
router.post('/paypal/webhook', paypalWebhook);
router.post('/salesforce/payment-confirmation', salesforcePaymentConfirmation);
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
router.post(
  '/pledges/:donationId/sync-salesforce',
  isAuthenticated({ isOptional: false }),
  syncPledgeSalesforce
);
router.post(
  '/:donationId/sync-salesforce',
  isAuthenticated({ isOptional: false }),
  syncFlatDonationSalesforce
);
router.get(
  '/pledges/credited-user/:userId',
  isAuthenticated({ isOptional: false }),
  listUserPledges
);
router.post('/:donationId/cancel', cancelCheckout);

module.exports = router;
