const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ensureOpportunityContactRole,
  donorContactFields,
  donorNameParts,
  opportunityFieldMapping,
  opportunityName,
  resolveOrCreateDonorContact,
  syncConfirmedFlatDonation
} = require('./salesforce-opportunity');
const salesforce = require('../../helpers/salesforce');

test('maps a confirmed flat donation to an Opportunity', () => {
  const previousPaypalField =
    process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD;
  const previousContactField =
    process.env.SALESFORCE_OPPORTUNITY_PRIMARY_CONTACT_FIELD;
  const previousParticipantField =
    process.env.SALESFORCE_OPPORTUNITY_PARTICIPANT_FIELD;
  const previousDonorEmailField =
    process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD;
  process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD =
    'PayPal_Transaction_ID__c';
  process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD = 'Donor_Email__c';
  process.env.SALESFORCE_OPPORTUNITY_PRIMARY_CONTACT_FIELD =
    'Primary_Contact__c';
  process.env.SALESFORCE_OPPORTUNITY_PARTICIPANT_FIELD =
    'Mapathon_Participant__c';

  try {
    const fields = opportunityFieldMapping({
      donation: {
        id: 'donation-id',
        amountCents: 2500,
        confirmedAt: new Date('2026-06-21T12:00:00.000Z'),
        paypalCaptureId: 'PAYPAL-CAPTURE',
        paypalOrderId: 'PAYPAL-ORDER',
        donorEmail: 'donor@example.com'
      },
      event: {
        name: 'NYC Summer Mapathon'
      },
      campaignId: '701campaign',
      donorContactId: '003donor',
      participantContactId: '003participant',
      externalIdField: 'AXS_Map_Donation_ID__c'
    });

    assert.deepEqual(fields, {
      Name: 'AXS Map donation donation-id - NYC Summer Mapathon',
      Amount: 25,
      CloseDate: '2026-06-21',
      StageName: 'Posted - Fully Paid',
      CampaignId: '701campaign',
      AXS_Map_Donation_ID__c: 'donation-id',
      PayPal_Transaction_ID__c: 'PAYPAL-CAPTURE',
      Donor_Email__c: 'donor@example.com',
      Primary_Contact__c: '003donor',
      Mapathon_Participant__c: '003participant'
    });
  } finally {
    if (previousPaypalField) {
      process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD =
        previousPaypalField;
    } else {
      delete process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD;
    }
    if (previousContactField) {
      process.env.SALESFORCE_OPPORTUNITY_PRIMARY_CONTACT_FIELD =
        previousContactField;
    } else {
      delete process.env.SALESFORCE_OPPORTUNITY_PRIMARY_CONTACT_FIELD;
    }
    if (previousParticipantField) {
      process.env.SALESFORCE_OPPORTUNITY_PARTICIPANT_FIELD =
        previousParticipantField;
    } else {
      delete process.env.SALESFORCE_OPPORTUNITY_PARTICIPANT_FIELD;
    }
    if (previousDonorEmailField) {
      process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD =
        previousDonorEmailField;
    } else {
      delete process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD;
    }
  }
});

test('omits donor Contact field when no Contact matches', () => {
  const previousPaypalField =
    process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD;
  const previousContactField =
    process.env.SALESFORCE_OPPORTUNITY_PRIMARY_CONTACT_FIELD;
  const previousDonorEmailField =
    process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD;
  process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD =
    'PayPal_Transaction_ID__c';
  process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD = 'Donor_Email__c';
  process.env.SALESFORCE_OPPORTUNITY_PRIMARY_CONTACT_FIELD =
    'Primary_Contact__c';

  try {
    const fields = opportunityFieldMapping({
      donation: {
        id: 'donation-id',
        amountCents: 500,
        confirmedAt: new Date('2026-06-21T12:00:00.000Z'),
        paypalOrderId: 'PAYPAL-ORDER',
        donorEmail: 'new-donor@example.com'
      },
      event: { name: 'Mapathon' },
      campaignId: '701campaign',
      donorContactId: null,
      participantContactId: '003participant',
      externalIdField: 'AXS_Map_Donation_ID__c'
    });

    assert.equal(fields.Primary_Contact__c, undefined);
    assert.equal(fields.PayPal_Transaction_ID__c, 'PAYPAL-ORDER');
    assert.equal(fields.Donor_Email__c, 'new-donor@example.com');
  } finally {
    if (previousPaypalField) {
      process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD =
        previousPaypalField;
    } else {
      delete process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD;
    }
    if (previousContactField) {
      process.env.SALESFORCE_OPPORTUNITY_PRIMARY_CONTACT_FIELD =
        previousContactField;
    } else {
      delete process.env.SALESFORCE_OPPORTUNITY_PRIMARY_CONTACT_FIELD;
    }
    if (previousDonorEmailField) {
      process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD =
        previousDonorEmailField;
    } else {
      delete process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD;
    }
  }
});

test('maps donor name and email to Contact fields', () => {
  const previousEnvironment = {
    accountId: process.env.SALESFORCE_CONTACT_ACCOUNT_ID,
    sourceField: process.env.SALESFORCE_CONTACT_SOURCE_FIELD,
    sourceValue: process.env.SALESFORCE_CONTACT_SOURCE_VALUE
  };
  process.env.SALESFORCE_CONTACT_ACCOUNT_ID = '001donoraccount';
  process.env.SALESFORCE_CONTACT_SOURCE_FIELD = 'LeadSource';
  process.env.SALESFORCE_CONTACT_SOURCE_VALUE = 'AXS Map Donation';

  try {
    assert.deepEqual(donorNameParts({ donorName: 'Jason D.' }), {
      firstName: 'Jason',
      lastName: 'D.'
    });
    assert.deepEqual(donorNameParts({ donorName: '' }), {
      firstName: 'AXS Map',
      lastName: 'Donor'
    });
    assert.deepEqual(
      donorContactFields({
        donorName: 'Jason D.',
        donorEmail: 'jason@example.com'
      }),
      {
        Email: 'jason@example.com',
        FirstName: 'Jason',
        LastName: 'D.',
        AccountId: '001donoraccount',
        LeadSource: 'AXS Map Donation'
      }
    );
  } finally {
    Object.entries(previousEnvironment).forEach(([name, value]) => {
      const environmentName = {
        accountId: 'SALESFORCE_CONTACT_ACCOUNT_ID',
        sourceField: 'SALESFORCE_CONTACT_SOURCE_FIELD',
        sourceValue: 'SALESFORCE_CONTACT_SOURCE_VALUE'
      }[name];
      if (value) process.env[environmentName] = value;
      else delete process.env[environmentName];
    });
  }
});

test('creates a donor Contact only when enabled and no Contact matches', async () => {
  const previousEnvironment = {
    createEnabled: process.env.SALESFORCE_CONTACT_CREATE_ENABLED,
    accountId: process.env.SALESFORCE_CONTACT_ACCOUNT_ID
  };
  const originalFindOne = salesforce.findOne;
  const originalCreateRecord = salesforce.createRecord;
  process.env.SALESFORCE_CONTACT_CREATE_ENABLED = 'true';
  process.env.SALESFORCE_CONTACT_ACCOUNT_ID = '001donoraccount';

  let createRequest;
  salesforce.findOne = async () => null;
  salesforce.createRecord = async request => {
    createRequest = request;
    return { Id: '003created' };
  };

  try {
    const contact = await resolveOrCreateDonorContact({
      donorName: 'Jane Q.',
      donorEmail: 'jane@example.com'
    });

    assert.deepEqual(contact, { Id: '003created' });
    assert.deepEqual(createRequest, {
      objectName: 'Contact',
      fields: {
        Email: 'jane@example.com',
        FirstName: 'Jane',
        LastName: 'Q.',
        AccountId: '001donoraccount'
      }
    });
  } finally {
    salesforce.findOne = originalFindOne;
    salesforce.createRecord = originalCreateRecord;
    if (previousEnvironment.createEnabled) {
      process.env.SALESFORCE_CONTACT_CREATE_ENABLED =
        previousEnvironment.createEnabled;
    } else {
      delete process.env.SALESFORCE_CONTACT_CREATE_ENABLED;
    }
    if (previousEnvironment.accountId) {
      process.env.SALESFORCE_CONTACT_ACCOUNT_ID =
        previousEnvironment.accountId;
    } else {
      delete process.env.SALESFORCE_CONTACT_ACCOUNT_ID;
    }
  }
});

test('keeps donor Contact lookup-only when Contact creation is disabled', async () => {
  const previousCreateEnabled = process.env.SALESFORCE_CONTACT_CREATE_ENABLED;
  const originalFindOne = salesforce.findOne;
  const originalCreateRecord = salesforce.createRecord;
  delete process.env.SALESFORCE_CONTACT_CREATE_ENABLED;

  let createCalled = false;
  salesforce.findOne = async () => null;
  salesforce.createRecord = async () => {
    createCalled = true;
  };

  try {
    const contact = await resolveOrCreateDonorContact({
      donorName: 'Jane Q.',
      donorEmail: 'jane@example.com'
    });

    assert.equal(contact, null);
    assert.equal(createCalled, false);
  } finally {
    salesforce.findOne = originalFindOne;
    salesforce.createRecord = originalCreateRecord;
    if (previousCreateEnabled) {
      process.env.SALESFORCE_CONTACT_CREATE_ENABLED = previousCreateEnabled;
    }
  }
});

test('requires the PayPal transaction field to avoid package duplicates', () => {
  const previous = process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD;
  delete process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD;

  try {
    assert.throws(
      () =>
        opportunityFieldMapping({
          donation: {},
          event: {},
          externalIdField: 'AXS_Map_Donation_ID__c'
        }),
      (error) => error.code === 'SALESFORCE_PAYPAL_TRANSACTION_FIELD_REQUIRED'
    );
  } finally {
    if (previous) {
      process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD = previous;
    }
  }
});

test('requires a donor email field for first-time donors', () => {
  const previousPaypal =
    process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD;
  const previousEmail = process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD;
  process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD =
    'PayPal_Transaction_ID__c';
  delete process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD;

  try {
    assert.throws(
      () =>
        opportunityFieldMapping({
          donation: {},
          event: {},
          externalIdField: 'AXS_Map_Donation_ID__c'
        }),
      (error) => error.code === 'SALESFORCE_DONOR_EMAIL_FIELD_REQUIRED'
    );
  } finally {
    if (previousPaypal) {
      process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD =
        previousPaypal;
    } else {
      delete process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD;
    }
    if (previousEmail) {
      process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD = previousEmail;
    }
  }
});

test('Opportunity names are bounded for Salesforce', () => {
  const name = opportunityName({
    donation: { id: 'donation-id' },
    event: { name: 'x'.repeat(200) }
  });
  assert.equal(name.length, 120);
});

test('updates an existing Opportunity matched by PayPal transaction', async () => {
  const previousEnvironment = {
    campaign: process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD,
    donation: process.env.SALESFORCE_OPPORTUNITY_EXTERNAL_ID_FIELD,
    email: process.env.SALESFORCE_OPPORTUNITY_DONOR_EMAIL_FIELD,
    paypal: process.env.SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD
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

  let updateRequest;
  let upsertCalled = false;
  salesforce.findOne = async (request) => {
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
  salesforce.updateRecord = async (request) => {
    updateRequest = request;
    return { Id: request.recordId };
  };
  salesforce.upsertRecord = async () => {
    upsertCalled = true;
  };

  try {
    const record = await syncConfirmedFlatDonation({
      donation: {
        id: '6a36bf002de97a67d63ccf24',
        type: 'flat',
        status: 'confirmed',
        amountCents: 1500,
        confirmedAt: new Date('2026-06-21T12:00:00.000Z'),
        paypalCaptureId: 'PAYPAL-CAPTURE',
        donorEmail: 'new-donor@example.com'
      },
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
        paypal: 'SALESFORCE_OPPORTUNITY_PAYPAL_TRANSACTION_FIELD'
      }[name];
      if (value) process.env[environmentName] = value;
      else delete process.env[environmentName];
    });
  }
});

test('creates an Opportunity Contact Role when enabled', async () => {
  const previousEnvironment = {
    enabled: process.env.SALESFORCE_OPPORTUNITY_CONTACT_ROLE_ENABLED,
    role: process.env.SALESFORCE_OPPORTUNITY_CONTACT_ROLE_VALUE,
    primary: process.env.SALESFORCE_OPPORTUNITY_CONTACT_ROLE_PRIMARY
  };
  const originalQuery = salesforce.query;
  const originalCreateRecord = salesforce.createRecord;
  process.env.SALESFORCE_OPPORTUNITY_CONTACT_ROLE_ENABLED = 'true';
  process.env.SALESFORCE_OPPORTUNITY_CONTACT_ROLE_VALUE = 'Donor';
  delete process.env.SALESFORCE_OPPORTUNITY_CONTACT_ROLE_PRIMARY;

  let queryText;
  let createRequest;
  salesforce.query = async (soql) => {
    queryText = soql;
    return [];
  };
  salesforce.createRecord = async (request) => {
    createRequest = request;
    return { Id: '00Krole' };
  };

  try {
    const record = await ensureOpportunityContactRole({
      opportunityId: '006opportunity',
      contactId: '003donor'
    });

    assert.equal(record.Id, '00Krole');
    assert.match(queryText, /OpportunityContactRole/);
    assert.deepEqual(createRequest, {
      objectName: 'OpportunityContactRole',
      fields: {
        OpportunityId: '006opportunity',
        ContactId: '003donor',
        Role: 'Donor',
        IsPrimary: true
      }
    });
  } finally {
    salesforce.query = originalQuery;
    salesforce.createRecord = originalCreateRecord;
    Object.entries(previousEnvironment).forEach(([name, value]) => {
      const environmentName = {
        enabled: 'SALESFORCE_OPPORTUNITY_CONTACT_ROLE_ENABLED',
        role: 'SALESFORCE_OPPORTUNITY_CONTACT_ROLE_VALUE',
        primary: 'SALESFORCE_OPPORTUNITY_CONTACT_ROLE_PRIMARY'
      }[name];
      if (value) process.env[environmentName] = value;
      else delete process.env[environmentName];
    });
  }
});

test('does not duplicate an existing Opportunity Contact Role', async () => {
  const previousEnabled =
    process.env.SALESFORCE_OPPORTUNITY_CONTACT_ROLE_ENABLED;
  const originalQuery = salesforce.query;
  const originalCreateRecord = salesforce.createRecord;
  process.env.SALESFORCE_OPPORTUNITY_CONTACT_ROLE_ENABLED = 'true';

  let createCalled = false;
  salesforce.query = async () => [{ Id: '00Kexisting' }];
  salesforce.createRecord = async () => {
    createCalled = true;
  };

  try {
    const record = await ensureOpportunityContactRole({
      opportunityId: '006opportunity',
      contactId: '003donor'
    });

    assert.equal(record.Id, '00Kexisting');
    assert.equal(createCalled, false);
  } finally {
    salesforce.query = originalQuery;
    salesforce.createRecord = originalCreateRecord;
    if (previousEnabled) {
      process.env.SALESFORCE_OPPORTUNITY_CONTACT_ROLE_ENABLED =
        previousEnabled;
    } else {
      delete process.env.SALESFORCE_OPPORTUNITY_CONTACT_ROLE_ENABLED;
    }
  }
});
