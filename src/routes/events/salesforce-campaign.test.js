const assert = require('node:assert/strict');
const test = require('node:test');

const salesforce = require('../../helpers/salesforce');
const {
  campaignFieldMapping,
  isoDate,
  requireCampaignExternalIdField,
  syncMapathonCampaign
} = require('./salesforce-campaign');

function restoreEnvironment(name, value) {
  if (value) {
    process.env[name] = value;
  } else {
    delete process.env[name];
  }
}

test('maps a Mapathon to Salesforce Campaign fields with configured external ID', () => {
  const fields = campaignFieldMapping({
    event: {
      id: 'event-id',
      name: 'Downtown Mapathon',
      description: 'Mapping downtown access',
      status: 'active',
      startDate: new Date('2026-07-01T14:00:00.000Z'),
      endDate: new Date('2026-07-31T22:00:00.000Z')
    },
    externalIdField: 'AXS_Map_Mapathon_ID__c'
  });

  assert.deepEqual(fields, {
    Name: 'Downtown Mapathon',
    IsActive: true,
    StartDate: '2026-07-01',
    EndDate: '2026-07-31',
    Description: 'Mapping downtown access',
    AXS_Map_Mapathon_ID__c: 'event-id'
  });
});

test('marks draft Mapathon Campaigns inactive', () => {
  const fields = campaignFieldMapping({
    event: {
      id: 'event-id',
      name: 'Draft Mapathon',
      status: 'draft',
      startDate: new Date('2026-07-01T14:00:00.000Z'),
      endDate: new Date('2026-07-31T22:00:00.000Z')
    },
    externalIdField: 'Mapathon_ID__c'
  });

  assert.equal(fields.IsActive, false);
  assert.equal(fields.Description, undefined);
});

test('formats Salesforce Campaign dates without time components', () => {
  assert.equal(isoDate(new Date('2026-07-01T14:00:00.000Z')), '2026-07-01');
  assert.equal(isoDate(null), null);
});

test('requires the configured Salesforce Campaign external ID field', () => {
  const previous = process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD;
  delete process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD;

  try {
    assert.throws(
      () => requireCampaignExternalIdField(),
      (error) => error.code === 'SALESFORCE_CAMPAIGN_EXTERNAL_ID_REQUIRED'
    );
  } finally {
    restoreEnvironment('SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD', previous);
  }
});

test('upserts Campaign by event id using the configured external ID field', async () => {
  const previous = process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD;
  const originalUpsertRecord = salesforce.upsertRecord;
  let upsertRequest;

  process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD = 'AXS_Map_Mapathon_ID__c';
  salesforce.upsertRecord = async (request) => {
    upsertRequest = request;
    return { Id: '701campaign' };
  };

  try {
    const record = await syncMapathonCampaign({
      id: 'event-id',
      name: 'Downtown Mapathon',
      description: 'Mapping downtown access',
      status: 'active',
      startDate: new Date('2026-07-01T14:00:00.000Z'),
      endDate: new Date('2026-07-31T22:00:00.000Z')
    });

    assert.deepEqual(record, { Id: '701campaign' });
    assert.equal(upsertRequest.objectName, 'Campaign');
    assert.equal(upsertRequest.externalIdField, 'AXS_Map_Mapathon_ID__c');
    assert.equal(upsertRequest.externalIdValue, 'event-id');
    assert.equal(upsertRequest.fields.AXS_Map_Mapathon_ID__c, 'event-id');
  } finally {
    salesforce.upsertRecord = originalUpsertRecord;
    restoreEnvironment('SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD', previous);
  }
});
