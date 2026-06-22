const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildSalesforcePledgePayload,
  calculateFinalPledgeAmount
} = require('./pledge-settlement-helpers');

test('final pledge amount uses only eligible locations', () => {
  assert.equal(
    calculateFinalPledgeAmount({
      pledgeAmountCents: 300,
      pledgeCapCents: 5000,
      eligibleLocations: 3
    }),
    900
  );
});

test('final pledge amount never exceeds the donor cap', () => {
  assert.equal(
    calculateFinalPledgeAmount({
      pledgeAmountCents: 1500,
      pledgeCapCents: 5000,
      eligibleLocations: 10
    }),
    5000
  );
});

test('zero eligible locations produces a zero-dollar settlement', () => {
  assert.equal(
    calculateFinalPledgeAmount({
      pledgeAmountCents: 500,
      pledgeCapCents: 5000,
      eligibleLocations: 0
    }),
    0
  );
});

test('Salesforce payload includes the closed pledge context', () => {
  const payload = buildSalesforcePledgePayload({
    pledge: {
      id: 'pledge-id',
      anonymous: false,
      donorName: 'Joe W',
      donorEmail: 'joe@example.com',
      pledgeAmountCents: 300,
      pledgeCapCents: 5000,
      pledgeEligibleLocations: 3,
      pledgeFinalAmountCents: 900,
      currency: 'USD',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      pledgeCalculatedAt: new Date('2026-06-20T00:00:00.000Z'),
      pledgeClosedAt: new Date('2026-06-20T00:00:00.000Z'),
      status: 'calculated'
    },
    event: {
      id: 'event-id',
      name: 'Queens Accessibility Mapathon',
      endDate: new Date('2026-06-19T23:59:59.999Z')
    },
    participant: {
      id: 'participant-id',
      firstName: 'Jack',
      lastName: 'Mosley'
    }
  });

  assert.deepEqual(payload, {
    axsMapPledgeId: 'pledge-id',
    axsMapMapathonId: 'event-id',
    axsMapParticipantId: 'participant-id',
    donorName: 'Joe W',
    donorEmail: 'joe@example.com',
    anonymous: false,
    mapathonName: 'Queens Accessibility Mapathon',
    mapathonEndDate: new Date('2026-06-19T23:59:59.999Z'),
    participantName: 'Jack Mosley',
    amountPerLocation: 3,
    maximumAmount: 50,
    eligibleLocations: 3,
    finalAmount: 9,
    currency: 'USD',
    pledgeDate: new Date('2026-06-01T00:00:00.000Z'),
    calculatedAt: new Date('2026-06-20T00:00:00.000Z'),
    closedAt: new Date('2026-06-20T00:00:00.000Z'),
    status: 'calculated'
  });
});
