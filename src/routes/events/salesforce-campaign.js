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

function campaignIsActive(event, now = new Date()) {
  return (
    event.status !== 'draft' &&
    event.isArchived !== true &&
    (!event.endDate || new Date(event.endDate).getTime() >= now.getTime())
  );
}

function campaignFieldMapping({ event, externalIdField, now }) {
  const fields = {
    Name: event.name,
    IsActive: campaignIsActive(event, now),
    StartDate: isoDate(event.startDate),
    EndDate: isoDate(event.endDate)
  };

  if (event.description) fields.Description = event.description;
  fields[externalIdField] = event.id;
  return fields;
}

function soqlDateLiteral(value) {
  const date = isoDate(value);
  return date ? salesforce.escapeSoql(date) : 'null';
}

async function findReusableCampaign({ event, externalIdField }) {
  const records = await salesforce.query(
    `SELECT Id, ${externalIdField} FROM Campaign WHERE Name = ` +
      `'${salesforce.escapeSoql(event.name)}' AND StartDate = ` +
      `${soqlDateLiteral(event.startDate)} AND EndDate = ` +
      `${soqlDateLiteral(event.endDate)} ` +
      `AND (${externalIdField} = null OR ${externalIdField} = ` +
      `'${salesforce.escapeSoql(event.id)}') ` +
      'ORDER BY LastModifiedDate DESC LIMIT 2'
  );
  const exactMatch = records.find(
    record => record[externalIdField] === event.id
  );
  if (exactMatch) return exactMatch;
  return records.length === 1 ? records[0] : null;
}

async function syncMapathonCampaign(event) {
  const externalIdField = requireCampaignExternalIdField();
  const fields = campaignFieldMapping({ event, externalIdField });

  console.log(
    `Syncing Salesforce Campaign for Mapathon ${event.id} using ` +
      `${externalIdField}`
  );

  const existingCampaign = await findReusableCampaign({
    event,
    externalIdField
  });
  if (existingCampaign) {
    return salesforce.updateRecord({
      objectName: 'Campaign',
      recordId: existingCampaign.Id,
      fields
    });
  }

  return salesforce.upsertRecord({
    objectName: 'Campaign',
    externalIdField,
    externalIdValue: event.id,
    fields
  });
}

module.exports = {
  campaignIsActive,
  campaignFieldMapping,
  findReusableCampaign,
  isoDate,
  requireCampaignExternalIdField,
  soqlDateLiteral,
  syncMapathonCampaign
};
