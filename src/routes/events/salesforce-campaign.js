const salesforce = require('../../helpers/salesforce');

function isoDate(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function requireCampaignExternalIdField() {
  const externalIdField = process.env.SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD;
  if (!externalIdField) {
    const error = new Error(
      'SALESFORCE_CAMPAIGN_EXTERNAL_ID_FIELD is not configured'
    );
    error.code = 'SALESFORCE_CAMPAIGN_EXTERNAL_ID_REQUIRED';
    throw error;
  }
  return externalIdField;
}

function campaignFieldMapping({ event, externalIdField }) {
  const fields = {
    Name: event.name,
    IsActive: event.status !== 'draft',
    StartDate: isoDate(event.startDate),
    EndDate: isoDate(event.endDate)
  };

  if (event.description) fields.Description = event.description;
  fields[externalIdField] = event.id;
  return fields;
}

async function syncMapathonCampaign(event) {
  const externalIdField = requireCampaignExternalIdField();
  const fields = campaignFieldMapping({ event, externalIdField });

  console.log(
    `Syncing Salesforce Campaign for Mapathon ${event.id} using ` +
      `${externalIdField}`
  );

  return salesforce.upsertRecord({
    objectName: 'Campaign',
    externalIdField,
    externalIdValue: event.id,
    fields
  });
}

module.exports = {
  campaignFieldMapping,
  isoDate,
  requireCampaignExternalIdField,
  syncMapathonCampaign
};
