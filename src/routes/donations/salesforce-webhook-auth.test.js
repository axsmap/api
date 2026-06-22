const assert = require('node:assert/strict');
const test = require('node:test');

const {
  expectedSignature,
  verifySalesforceWebhook
} = require('./salesforce-webhook-auth');

test('verifies a current Salesforce HMAC signature', () => {
  const previous = process.env.SALESFORCE_WEBHOOK_SECRET;
  process.env.SALESFORCE_WEBHOOK_SECRET = 'test-secret';
  const timestamp = '1782054000000';
  const body = {
    axsMapPledgeId: '6a36bf002de97a67d63ccf24',
    status: 'Paid',
    opportunityId: '006opportunity',
    paypalTransactionId: 'PAYPAL-CAPTURE',
    paymentDate: '2026-06-21',
    receiptSent: true
  };
  const signature = expectedSignature({
    body,
    timestamp,
    secret: 'test-secret'
  });

  try {
    assert.equal(
      verifySalesforceWebhook({
        body,
        headers: {
          'x-axsmap-timestamp': timestamp,
          'x-axsmap-signature': signature
        },
        now: Number(timestamp)
      }),
      true
    );
  } finally {
    if (previous) {
      process.env.SALESFORCE_WEBHOOK_SECRET = previous;
    } else {
      delete process.env.SALESFORCE_WEBHOOK_SECRET;
    }
  }
});

test('rejects expired Salesforce signatures', () => {
  const previous = process.env.SALESFORCE_WEBHOOK_SECRET;
  process.env.SALESFORCE_WEBHOOK_SECRET = 'test-secret';
  const timestamp = '1782054000000';
  const body = { axsMapPledgeId: 'pledge', status: 'Paid' };
  const signature = expectedSignature({
    body,
    timestamp,
    secret: 'test-secret'
  });

  try {
    assert.equal(
      verifySalesforceWebhook({
        body,
        headers: {
          'x-axsmap-timestamp': timestamp,
          'x-axsmap-signature': signature
        },
        now: Number(timestamp) + 300001
      }),
      false
    );
  } finally {
    if (previous) {
      process.env.SALESFORCE_WEBHOOK_SECRET = previous;
    } else {
      delete process.env.SALESFORCE_WEBHOOK_SECRET;
    }
  }
});
