const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const {
  applySalesforcePaymentUpdate
} = require('./salesforce-payment-helpers');

test('paid pledge uses its frozen final amount', () => {
  const now = new Date('2026-07-23T15:00:00.000Z');
  const pledge = {
    status: 'calculated',
    amountCents: 5000,
    pledgeFinalAmountCents: 900
  };
  applySalesforcePaymentUpdate({
    pledge,
    status: 'Paid',
    opportunityId: '006payment',
    paypalTransactionId: 'PAYPAL-CAPTURE',
    paymentDate: '2026-07-23',
    receiptSent: true,
    now
  });
  assert.equal(pledge.status, 'paid');
  assert.equal(pledge.amountCents, 900);
  assert.equal(pledge.salesforcePaymentId, '006payment');
  assert.equal(pledge.receiptSentAt, now);
});

test('paid pledges cannot move backward', () => {
  assert.throws(
    () =>
      applySalesforcePaymentUpdate({
        pledge: { status: 'paid' },
        status: 'Cancelled'
      }),
    error => error.code === 'PLEDGE_ALREADY_PAID'
  );
});
