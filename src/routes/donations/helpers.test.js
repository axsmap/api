const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const {
  captureFromOrder,
  payerEmail,
  publicDonation,
  publicDonorName,
  receiptEmail
} = require('./helpers');

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

test('AXS Map donor email takes priority over PayPal payer email', () => {
  const order = {
    payer: { email_address: 'paypal-sandbox@example.com' }
  };

  assert.strictEqual(
    receiptEmail('donor-entered@example.com', order),
    'donor-entered@example.com'
  );
  assert.strictEqual(
    receiptEmail('', order),
    'paypal-sandbox@example.com'
  );
});

test('public donation includes pledge details without exposing donor email', () => {
  const pledge = publicDonation({
    id: 'pledge-1',
    event: 'event-1',
    creditedUser: 'user-1',
    type: 'pledge',
    amountCents: 5000,
    pledgeAmountCents: 300,
    pledgeCapCents: 5000,
    currency: 'USD',
    status: 'pledged',
    anonymous: false,
    donorName: 'Joe W.',
    donorEmail: 'private@example.com',
    showAmountPublicly: true,
    showPledgePublicly: true,
    createdAt: new Date('2026-06-15T11:00:00Z')
  });

  assert.strictEqual(pledge.type, 'pledge');
  assert.strictEqual(pledge.pledgeAmount, 3);
  assert.strictEqual(pledge.pledgeCap, 50);
  assert.strictEqual(pledge.showPledgePublicly, true);
  assert.strictEqual(pledge.donorEmail, undefined);
});

test('public donor names use first name and last initial', () => {
  assert.strictEqual(publicDonorName('Jason DaSilva'), 'Jason D.');
  assert.strictEqual(publicDonorName('  Mary Jane Watson  '), 'Mary W.');
  assert.strictEqual(publicDonorName('Prince'), 'Prince');
});
