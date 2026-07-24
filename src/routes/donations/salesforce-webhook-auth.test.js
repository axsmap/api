const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const { verifySalesforceWebhook } = require('./salesforce-webhook-auth');

test('accepts the configured Salesforce bearer secret', () => {
  const previous = process.env.SALESFORCE_WEBHOOK_SECRET;
  process.env.SALESFORCE_WEBHOOK_SECRET = 'test-secret';
  try {
    assert.equal(
      verifySalesforceWebhook({ authorization: 'Bearer test-secret' }),
      true
    );
    assert.equal(
      verifySalesforceWebhook({ authorization: 'Bearer wrong-secret' }),
      false
    );
  } finally {
    if (previous) process.env.SALESFORCE_WEBHOOK_SECRET = previous;
    else delete process.env.SALESFORCE_WEBHOOK_SECRET;
  }
});

test('rejects missing or malformed authorization', () => {
  const previous = process.env.SALESFORCE_WEBHOOK_SECRET;
  process.env.SALESFORCE_WEBHOOK_SECRET = 'test-secret';
  try {
    assert.equal(verifySalesforceWebhook({}), false);
    assert.equal(
      verifySalesforceWebhook({ authorization: 'Basic test-secret' }),
      false
    );
  } finally {
    if (previous) process.env.SALESFORCE_WEBHOOK_SECRET = previous;
    else delete process.env.SALESFORCE_WEBHOOK_SECRET;
  }
});
