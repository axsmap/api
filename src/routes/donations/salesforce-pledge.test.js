const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const salesforce = require('../../helpers/salesforce');
const {
  isoDate,
  pledgeFieldMapping,
  publicRecognition,
  resolveCampaign,
  resolveDonorContact,
  resolveParticipantContact,
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

test('omits the donor lookup when no Salesforce Contact matches', () => {
  const fields = pledgeFieldMapping({
    pledge: {
      id: 'pledge-id',
      anonymous: true,
      donorEmail: 'anonymous@example.com',
      pledgeAmountCents: 500,
      pledgeCapCents: 5000,
      pledgeEligibleLocations: 0,
      pledgeFinalAmountCents: 0,
      createdAt: new Date('2026-06-01T18:30:00.000Z')
    },
    event: { id: 'event-id' },
    participant: {
      id: 'participant-id',
      firstName: 'Jack',
      lastName: 'Mosley'
    },
    campaignId: '701xx',
    donorContactId: null,
    participantContactId: '003participant',
    externalIdField: 'AXS_Map_Pledge_ID__c'
  });

  assert.equal(fields.Donor__c, undefined);
  assert.equal(fields.Donor_email__c, 'anonymous@example.com');
});

test('donor Contact resolution is lookup-only', async () => {
  const originalFindOne = salesforce.findOne;
  let lookup;
  salesforce.findOne = async options => {
    lookup = options;
    return null;
  };

  try {
    const donor = await resolveDonorContact({
      donorEmail: 'new-donor@example.com'
    });
    assert.equal(donor, null);
    assert.deepEqual(lookup, {
      objectName: 'Contact',
      fieldName: 'Email',
      value: 'new-donor@example.com'
    });
  } finally {
    salesforce.findOne = originalFindOne;
  }
});

test('uses a mapped participant Contact without an ambiguous email lookup', async () => {
  const originalFindOne = salesforce.findOne;
  let lookupCalled = false;
  salesforce.findOne = async () => {
    lookupCalled = true;
  };
  try {
    const contact = await resolveParticipantContact({
      email: 'duplicate@example.com',
      salesforceContactId: '003mapped'
    });
    assert.deepEqual(contact, { Id: '003mapped' });
    assert.equal(lookupCalled, false);
  } finally {
    salesforce.findOne = originalFindOne;
  }
});

test('omits an ambiguous optional donor Contact during settlement', async () => {
  const originalFindOne = salesforce.findOne;
  salesforce.findOne = async () => {
    const error = new Error('Multiple Contact records match Email');
    error.code = 'SALESFORCE_AMBIGUOUS_MATCH';
    throw error;
  };
  try {
    assert.equal(
      await resolveDonorContact({ donorEmail: 'duplicate@example.com' }),
      null
    );
  } finally {
    salesforce.findOne = originalFindOne;
  }
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

test('requires a dedicated Campaign external ID field', async () => {
  const previous = process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD;
  delete process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD;

  await assert.rejects(
    resolveCampaign({ id: 'event-id', name: 'Duplicate-prone name' }),
    error => error.code === 'SALESFORCE_CAMPAIGN_EXTERNAL_ID_REQUIRED'
  );

  if (previous) {
    process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD = previous;
  }
});
