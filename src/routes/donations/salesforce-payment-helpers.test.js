const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applySalesforcePaymentUpdate
} = require('./salesforce-payment-helpers');

test('paid pledge uses its frozen final amount in MongoDB', () => {
  const now = new Date('2026-06-21T15:00:00.000Z');
  const pledge = {
    status: 'calculated',
    amountCents: 5000,
    pledgeFinalAmountCents: 900,
    salesforcePaymentId: '',
    paypalCaptureId: ''
  };

  applySalesforcePaymentUpdate({
    pledge,
    status: 'Paid',
    opportunityId: '006opportunity',
    paypalTransactionId: 'PAYPAL-CAPTURE',
    paymentDate: '2026-06-21',
    receiptSent: true,
    now
  });

  assert.equal(pledge.status, 'paid');
  assert.equal(pledge.amountCents, 900);
  assert.equal(pledge.salesforcePaymentId, '006opportunity');
  assert.equal(pledge.paypalCaptureId, 'PAYPAL-CAPTURE');
  assert.equal(pledge.confirmedAt.toISOString(), '2026-06-21T00:00:00.000Z');
  assert.equal(pledge.receiptSentAt, now);
});

test('payment requested does not count as raised', () => {
  const pledge = {
    status: 'calculated',
    amountCents: 5000,
    pledgeFinalAmountCents: 900
  };

  applySalesforcePaymentUpdate({
    pledge,
    status: 'Payment Requested',
    receiptSent: false
  });

  assert.equal(pledge.status, 'payment_requested');
  assert.equal(pledge.amountCents, 5000);
  assert.equal(pledge.confirmedAt, undefined);
});

test('rejects unknown Salesforce pledge statuses', () => {
  assert.throws(
    () =>
      applySalesforcePaymentUpdate({
        pledge: {},
        status: 'Maybe Paid',
        receiptSent: false
      }),
    (error) => error.code === 'UNSUPPORTED_PLEDGE_STATUS'
  );
});

test('does not allow a paid pledge to move backward', () => {
  assert.throws(
    () =>
      applySalesforcePaymentUpdate({
        pledge: { status: 'paid' },
        status: 'Cancelled',
        receiptSent: false
      }),
    (error) => error.code === 'PLEDGE_ALREADY_PAID'
  );
});
