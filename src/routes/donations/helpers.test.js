const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const { captureFromOrder, payerEmail, publicDonation } = require('./helpers');

test('public donation respects donor privacy choices', () => {
  const visible = publicDonation({
    id: 'donation-1',
    event: 'event-1',
    creditedUser: 'user-1',
    amountCents: 1500,
    currency: 'USD',
    status: 'confirmed',
    anonymous: false,
    donorName: 'Jamie R.',
    showAmountPublicly: true,
    confirmedAt: new Date('2026-06-15T12:00:00Z'),
    createdAt: new Date('2026-06-15T11:00:00Z')
  });
  const anonymous = publicDonation({
    ...visible,
    amountCents: 500,
    anonymous: true,
    donorName: 'Should not be public'
  });

  assert.strictEqual(visible.donorName, 'Jamie R.');
  assert.strictEqual(visible.amount, 15);
  assert.strictEqual(anonymous.donorName, 'Anonymous');
});

test('capture helpers read PayPal order details', () => {
  const capture = { id: 'CAPTURE-1', status: 'COMPLETED' };
  const order = {
    payer: { email_address: 'donor@example.com' },
    purchase_units: [{ payments: { captures: [capture] } }]
  };

  assert.strictEqual(captureFromOrder(order), capture);
  assert.strictEqual(payerEmail(order), 'donor@example.com');
  assert.strictEqual(captureFromOrder({}), undefined);
  assert.strictEqual(payerEmail({}), '');
});
