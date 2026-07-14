const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const salesforce = require('../../helpers/salesforce');
const {
  DEFAULT_EXTERNAL_ID_FIELD,
  configuredExternalIdField,
  opportunityFieldMapping,
  opportunityName,
  salesforceErrorMessage,
  upsertDonationOpportunity
} = require('./salesforce-opportunity');

function restoreEnvironment(name, value) {
  if (value) {
    process.env[name] = value;
  } else {
    delete process.env[name];
  }
}

function donation(overrides = {}) {
  return {
    id: '6a397482c5d67caef20b3b8b',
    type: 'flat',
    status: 'confirmed',
    amountCents: 1250,
    donorName: 'Jane Donor',
    donorEmail: 'jane@example.com',
    anonymous: false,
    paypalOrderId: 'PAYPAL-ORDER',
    paypalCaptureId: 'PAYPAL-CAPTURE',
    confirmedAt: new Date('2026-07-14T18:12:25.281Z'),
    ...overrides
  };
}

test('uses the configured Salesforce Opportunity external ID field', () => {
  const previous = process.env.SALESFORCE_OPPORTUNITY_EXTERNAL_ID_FIELD;
  process.env.SALESFORCE_OPPORTUNITY_EXTERNAL_ID_FIELD =
    'AXS_Map_Donation_ID__c';

  try {
    assert.equal(configuredExternalIdField(), 'AXS_Map_Donation_ID__c');
  } finally {
    restoreEnvironment('SALESFORCE_OPPORTUNITY_EXTERNAL_ID_FIELD', previous);
  }
});

test('falls back to the default donation external ID field', () => {
  const previous = process.env.SALESFORCE_OPPORTUNITY_EXTERNAL_ID_FIELD;
  delete process.env.SALESFORCE_OPPORTUNITY_EXTERNAL_ID_FIELD;

  try {
    assert.equal(configuredExternalIdField(), DEFAULT_EXTERNAL_ID_FIELD);
  } finally {
    restoreEnvironment('SALESFORCE_OPPORTUNITY_EXTERNAL_ID_FIELD', previous);
  }
});

test('maps a confirmed flat donation to Opportunity fields', () => {
  const previousPaypalField =
    process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD;
  const previousContactField =
    process.env.SALESFORCE_OPPORTUNITY_PRIMARY_CONTACT_FIELD;
  const previousParticipantField =
    process.env.SALESFORCE_OPPORTUNITY_PARTICIPANT_FIELD;
  const previousDonorEmailField =
    process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD;
  const previousStage = process.env.SALESFORCE_OPPORTUNITY_PAID_STAGE;
  const previousSourceField =
    process.env.SALESFORCE_OPPORTUNITY_DONATION_SOURCE_FIELD;
  const previousSourceValue =
    process.env.SALESFORCE_OPPORTUNITY_DONATION_SOURCE_VALUE;
  const previousTypeField =
    process.env.SALESFORCE_OPPORTUNITY_DONATION_TYPE_FIELD;
  const previousTypeValue =
    process.env.SALESFORCE_OPPORTUNITY_FLAT_DONATION_VALUE;
  const previousAnonymousField =
    process.env.SALESFORCE_OPPORTUNITY_ANONYMOUS_FIELD;
  const previousReceiptField =
    process.env.SALESFORCE_OPPORTUNITY_RECEIPT_SENT_FIELD;

  process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD =
    'PayPal_Transaction_ID__c';
  process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD = 'Donor_Email__c';
  process.env.SALESFORCE_OPPORTUNITY_PRIMARY_CONTACT_FIELD =
    'Primary_Contact__c';
  process.env.SALESFORCE_OPPORTUNITY_PARTICIPANT_FIELD =
    'Mapathon_Participant__c';
  process.env.SALESFORCE_OPPORTUNITY_PAID_STAGE = 'Posted - Fully Paid';
  process.env.SALESFORCE_OPPORTUNITY_DONATION_SOURCE_FIELD =
    'Donation_Source__c';
  process.env.SALESFORCE_OPPORTUNITY_DONATION_SOURCE_VALUE = 'AXS Map';
  process.env.SALESFORCE_OPPORTUNITY_DONATION_TYPE_FIELD = 'Donation_Type__c';
  process.env.SALESFORCE_OPPORTUNITY_FLAT_DONATION_VALUE = 'Flat Donation';
  process.env.SALESFORCE_OPPORTUNITY_ANONYMOUS_FIELD = 'idw_npa_Anonymous__c';
  process.env.SALESFORCE_OPPORTUNITY_RECEIPT_SENT_FIELD = 'Receipt_sent__c';

  try {
    const fields = opportunityFieldMapping({
      donation: donation(),
      event: { name: 'New York Mapathon' },
      campaignId: '701campaign',
      donorContactId: '003donor',
      participantContactId: '003participant',
      externalIdField: 'AXS_Map_Donation_ID__c'
    });

    assert.deepEqual(fields, {
      Name: 'AXS Map donation 6a397482c5d67caef20b3b8b - New York Mapathon',
      Amount: 12.5,
      CloseDate: '2026-07-14',
      StageName: 'Posted - Fully Paid',
      CampaignId: '701campaign',
      AXS_Map_Donation_ID__c: '6a397482c5d67caef20b3b8b',
      PayPal_Transaction_ID__c: 'PAYPAL-CAPTURE',
      Donor_Email__c: 'jane@example.com',
      Primary_Contact__c: '003donor',
      Mapathon_Participant__c: '003participant',
      Donation_Source__c: 'AXS Map',
      Donation_Type__c: 'Flat Donation',
      idw_npa_Anonymous__c: false,
      Receipt_sent__c: false
    });
  } finally {
    restoreEnvironment(
      'SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD',
      previousPaypalField
    );
    restoreEnvironment(
      'SALESFORCE_OPPORTUNITY_PRIMARY_CONTACT_FIELD',
      previousContactField
    );
    restoreEnvironment(
      'SALESFORCE_OPPORTUNITY_PARTICIPANT_FIELD',
      previousParticipantField
    );
    restoreEnvironment(
      'SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD',
      previousDonorEmailField
    );
    restoreEnvironment('SALESFORCE_OPPORTUNITY_PAID_STAGE', previousStage);
    restoreEnvironment(
      'SALESFORCE_OPPORTUNITY_DONATION_SOURCE_FIELD',
      previousSourceField
    );
    restoreEnvironment(
      'SALESFORCE_OPPORTUNITY_DONATION_SOURCE_VALUE',
      previousSourceValue
    );
    restoreEnvironment(
      'SALESFORCE_OPPORTUNITY_DONATION_TYPE_FIELD',
      previousTypeField
    );
    restoreEnvironment(
      'SALESFORCE_OPPORTUNITY_FLAT_DONATION_VALUE',
      previousTypeValue
    );
    restoreEnvironment(
      'SALESFORCE_OPPORTUNITY_ANONYMOUS_FIELD',
      previousAnonymousField
    );
    restoreEnvironment(
      'SALESFORCE_OPPORTUNITY_RECEIPT_SENT_FIELD',
      previousReceiptField
    );
  }
});

test('updates an existing Opportunity matched by PayPal transaction', async () => {
  const previousEnvironment = {
    campaign: process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD,
    donation: process.env.SALESFORCE_OPPORTUNITY_EXTERNAL_ID_FIELD,
    email: process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD,
    paypal: process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD,
    participant: process.env.SALESFORCE_OPPORTUNITY_PARTICIPANT_FIELD
  };
  const originalFindOne = salesforce.findOne;
  const originalUpdateRecord = salesforce.updateRecord;
  const originalUpsertRecord = salesforce.upsertRecord;
  process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD = 'AXS_Map_Mapathon_ID__c';
  process.env.SALESFORCE_OPPORTUNITY_EXTERNAL_ID_FIELD =
    'AXS_Map_Donation_ID__c';
  process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD = 'Donor_Email__c';
  process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD =
    'PayPal_Transaction_ID__c';
  process.env.SALESFORCE_OPPORTUNITY_PARTICIPANT_FIELD =
    'Mapathon_Participant__c';

  let updateRequest;
  let upsertCalled = false;
  salesforce.findOne = async request => {
    if (request.objectName === 'Campaign') return { Id: '701campaign' };
    if (request.objectName === 'Contact') {
      return request.value === 'participant@example.com'
        ? { Id: '003participant' }
        : null;
    }
    if (request.objectName === 'Opportunity') {
      return { Id: '006existing' };
    }
    return null;
  };
  salesforce.updateRecord = async request => {
    updateRequest = request;
    return { Id: request.recordId };
  };
  salesforce.upsertRecord = async () => {
    upsertCalled = true;
  };

  try {
    const record = await upsertDonationOpportunity({
      donation: donation({
        id: '6a36bf002de97a67d63ccf24',
        amountCents: 1500,
        donorEmail: 'new-donor@example.com'
      }),
      event: {
        id: '6a2845b6de671e6376f4f44',
        name: 'NYC Summer Mapathon'
      },
      participant: {
        email: 'participant@example.com'
      }
    });

    assert.equal(record.Id, '006existing');
    assert.equal(updateRequest.recordId, '006existing');
    assert.equal(
      updateRequest.fields.AXS_Map_Donation_ID__c,
      '6a36bf002de97a67d63ccf24'
    );
    assert.equal(
      updateRequest.fields.Mapathon_Participant__c,
      '003participant'
    );
    assert.equal(upsertCalled, false);
  } finally {
    salesforce.findOne = originalFindOne;
    salesforce.updateRecord = originalUpdateRecord;
    salesforce.upsertRecord = originalUpsertRecord;
    Object.entries(previousEnvironment).forEach(([name, value]) => {
      const environmentName = {
        campaign: 'SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD',
        donation: 'SALESFORCE_OPPORTUNITY_EXTERNAL_ID_FIELD',
        email: 'SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD',
        paypal: 'SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD',
        participant: 'SALESFORCE_OPPORTUNITY_PARTICIPANT_FIELD'
      }[name];
      restoreEnvironment(environmentName, value);
    });
  }
});

test('falls back to the general donation Campaign when Mapathon is unsynced', async () => {
  const previousCampaign = process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD;
  const previousFallback =
    process.env.SALESFORCE_GENERAL_DONATION_CAMPAIGN_EXTERNAL_ID;
  const originalFindOne = salesforce.findOne;
  process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD = 'AXS_Map_Mapathon_ID__c';
  process.env.SALESFORCE_GENERAL_DONATION_CAMPAIGN_EXTERNAL_ID =
    'general-donations';
  const requests = [];

  salesforce.findOne = async request => {
    requests.push(request);
    return request.value === 'general-donations' ? { Id: '701general' } : null;
  };

  try {
    const { resolveCampaign } = require('./salesforce-opportunity');
    const campaign = await resolveCampaign({
      id: '6a4698274733d97ae17ec75b'
    });

    assert.deepEqual(campaign, { Id: '701general' });
    assert.deepEqual(requests.map(request => request.value), [
      '6a4698274733d97ae17ec75b',
      'general-donations'
    ]);
  } finally {
    salesforce.findOne = originalFindOne;
    restoreEnvironment(
      'SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD',
      previousCampaign
    );
    restoreEnvironment(
      'SALESFORCE_GENERAL_DONATION_CAMPAIGN_EXTERNAL_ID',
      previousFallback
    );
  }
});

test('formats Salesforce error bodies into saved sync errors', () => {
  const message = salesforceErrorMessage({
    response: {
      data: [
        {
          message: 'Mapathon Participant: id value of incorrect type',
          errorCode: 'MALFORMED_ID'
        }
      ]
    }
  });

  assert.equal(message, 'Mapathon Participant: id value of incorrect type');
});

test('Opportunity names are bounded for Salesforce', () => {
  const name = opportunityName({
    donation: { id: 'donation-id' },
    event: { name: 'x'.repeat(200) }
  });
  assert.equal(name.length, 120);
});
