const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isoDate,
  pledgeFieldMapping,
  publicRecognition,
  splitContactName,
  syncCalculatedPledge
} = require('./salesforce-pledge');

test('maps a calculated pledge to the exact Salesforce fields', () => {
  const fields = pledgeFieldMapping({
    pledge: {
      id: 'pledge-id',
      anonymous: false,
      donorEmail: 'joe@example.com',
      pledgeAmountCents: 300,
      pledgeCapCents: 5000,
      pledgeEligibleLocations: 3,
      pledgeFinalAmountCents: 900,
      createdAt: new Date('2026-06-01T18:30:00.000Z')
    },
    event: {
      id: 'event-id'
    },
    participant: {
      id: 'participant-id',
      firstName: 'Jack',
      lastName: 'Mosley'
    },
    campaignId: '701xx',
    donorContactId: '003donor',
    participantContactId: '003participant',
    externalIdField: 'AXS_Map_Pledge_ID__c'
  });

  assert.deepEqual(fields, {
    Amount_Per_Location__c: 3,
    Approved_Locations__c: 3,
    Calculated_Amount__c: 9,
    Donor__c: '003donor',
    Donor_email__c: 'joe@example.com',
    Locations_Target__c: 17,
    Mapathon__c: '701xx',
    Mapathon_Participant__c: '003participant',
    Mapathon_Participant_Name__c: 'Jack Mosley',
    Maximum_cap__c: 50,
    Notes__c:
      'AXS Map pledge pledge-id; Mapathon event-id; ' +
      'Participant participant-id',
    Pledge_Date__c: '2026-06-01',
    Pledge_Type__c: 'Per Location',
    Public_Recognition__c: 'First Name + Last Initial',
    Status__c: 'Calculated',
    AXS_Map_Pledge_ID__c: 'pledge-id'
  });
});

test('maps anonymous recognition without exposing the public donor name', () => {
  assert.equal(publicRecognition({ anonymous: true }), 'Anonymous');
  assert.equal(
    publicRecognition({ anonymous: false }),
    'First Name + Last Initial'
  );
});

test('builds valid Salesforce Contact names', () => {
  assert.deepEqual(splitContactName('Joe Walker'), {
    firstName: 'Joe',
    lastName: 'Walker'
  });
  assert.deepEqual(splitContactName('Prince'), {
    firstName: '',
    lastName: 'Prince'
  });
  assert.deepEqual(splitContactName(''), {
    firstName: '',
    lastName: 'Anonymous Donor'
  });
});

test('formats Salesforce date fields without time components', () => {
  assert.equal(
    isoDate(new Date('2026-06-01T18:30:00.000Z')),
    '2026-06-01'
  );
  assert.equal(isoDate(null), null);
});

test('refuses to sync without a duplicate-safe external ID field', async () => {
  const previous = process.env.SALESFORCE_PLEDGE_EXTERNAL_ID_FIELD;
  delete process.env.SALESFORCE_PLEDGE_EXTERNAL_ID_FIELD;

  await assert.rejects(
    syncCalculatedPledge({
      pledge: {},
      event: {},
      participant: {}
    }),
    error => error.code === 'SALESFORCE_EXTERNAL_ID_REQUIRED'
  );

  if (previous) {
    process.env.SALESFORCE_PLEDGE_EXTERNAL_ID_FIELD = previous;
  }
});
