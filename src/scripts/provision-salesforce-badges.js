const axios = require('axios');
const salesforce = require('../helpers/salesforce');

require('dotenv').config();

const objects = [
  {
    fullName: 'Badge_Definition__c',
    metadata: {
      label: 'Badge Definition',
      pluralLabel: 'Badge Definitions',
      deploymentStatus: 'Deployed',
      sharingModel: 'ReadWrite',
      nameField: { label: 'Badge Definition Name', type: 'Text' }
    }
  },
  {
    fullName: 'Badge_Earned__c',
    metadata: {
      label: 'Badge Earned',
      pluralLabel: 'Badges Earned',
      deploymentStatus: 'Deployed',
      sharingModel: 'ReadWrite',
      nameField: {
        label: 'Badge Earned Number',
        type: 'AutoNumber',
        displayFormat: 'BE-{000000}',
        startingNumber: 1
      }
    }
  }
];

const definitionFields = [
  [
    'AXS_Map_Badge_ID__c',
    text('Badge ID', 100, { externalId: true, unique: true, required: true })
  ],
  ['Description__c', longText('Description')],
  ['Category__c', text('Category', 100)],
  ['Criteria_JSON__c', longText('Criteria JSON')],
  ['Threshold__c', number('Threshold')],
  ['Icon_URL__c', url('Icon URL')],
  ['Display_Order__c', number('Display Order')],
  ['Active__c', checkbox('Active', true)],
  ['Level_Tier__c', text('Level / Tier', 100)],
  ['Visibility_JSON__c', longText('Visibility JSON')],
  ['Metadata_JSON__c', longText('Metadata JSON')],
  ['Mongo_Created_Date__c', dateTime('Mongo Created Date')],
  ['Mongo_Last_Modified_Date__c', dateTime('Mongo Last Modified Date')]
];

const earnedFields = [
  [
    'AXS_Map_Earned_Badge_ID__c',
    text('Earned Badge ID', 100, {
      externalId: true,
      unique: true,
      required: true
    })
  ],
  [
    'Badge__c',
    lookup('Badge', 'Badge_Definition__c', 'Badges Earned', 'Badges_Earned')
  ],
  [
    'Contact__c',
    lookup('Contact', 'Contact', 'Badges Earned', 'Badges_Earned')
  ],
  ['Earned_Date__c', dateTime('Earned Date')],
  ['Level_Tier__c', text('Level / Tier', 100)],
  ['Visibility_JSON__c', longText('Visibility JSON')],
  ['Metadata_JSON__c', longText('Metadata JSON')],
  ['Mongo_Created_Date__c', dateTime('Mongo Created Date')],
  ['Mongo_Last_Modified_Date__c', dateTime('Mongo Last Modified Date')]
];

function text(label, length, extra = {}) {
  return { label, type: 'Text', length, ...extra };
}

function longText(label) {
  return { label, type: 'LongTextArea', length: 32768, visibleLines: 5 };
}

function number(label) {
  return { label, type: 'Number', precision: 18, scale: 2 };
}

function url(label) {
  return { label, type: 'Url' };
}

function checkbox(label, defaultValue) {
  return { label, type: 'Checkbox', defaultValue };
}

function dateTime(label) {
  return { label, type: 'DateTime' };
}

function lookup(label, referenceTo, relationshipLabel, relationshipName) {
  return {
    label,
    type: 'Lookup',
    referenceTo,
    relationshipLabel,
    relationshipName,
    deleteConstraint: 'Restrict'
  };
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function metadataXml(metadata) {
  return Object.keys(metadata)
    .map(key => {
      const value = metadata[key];
      if (value == null) return '';
      if (typeof value === 'object') {
        return `<met:${key}>${metadataXml(value)}</met:${key}>`;
      }
      return `<met:${key}>${xmlEscape(value)}</met:${key}>`;
    })
    .join('');
}

async function metadataCreate(type, fullName, metadata) {
  const session = await salesforce.authenticate();
  const envelope =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:met="http://soap.sforce.com/2006/04/metadata" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<soapenv:Header><met:SessionHeader><met:sessionId>' +
    xmlEscape(session.accessToken) +
    '</met:sessionId></met:SessionHeader></soapenv:Header>' +
    '<soapenv:Body><met:createMetadata>' +
    `<met:metadata xsi:type="met:${type}">` +
    `<met:fullName>${xmlEscape(fullName)}</met:fullName>` +
    metadataXml(metadata) +
    '</met:metadata>' +
    '</met:createMetadata></soapenv:Body>' +
    '</soapenv:Envelope>';
  const response = await axios.post(
    `${session.instanceUrl}/services/Soap/m/64.0`,
    envelope,
    {
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        SOAPAction: 'createMetadata'
      },
      timeout: 30000
    }
  );
  if (!/<success>true<\/success>/.test(response.data)) {
    const problem = (response.data.match(/<problem>([\s\S]*?)<\/problem>/) ||
      [])[1];
    const statusCode = (response.data.match(
      /<statusCode>([\s\S]*?)<\/statusCode>/
    ) || [])[1];
    const error = new Error(
      problem || `Salesforce metadata creation failed for ${fullName}`
    );
    error.code = statusCode || 'METADATA_CREATE_FAILED';
    throw error;
  }
  return { fullName, success: true };
}

async function entityExists(apiName) {
  const records = await salesforce.queryAll(
    `SELECT QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName = '${salesforce.escapeSoql(
      apiName
    )}'`
  );
  return records.length > 0;
}

async function fieldNames(objectName) {
  const description = await salesforce.request({
    method: 'get',
    path: `/sobjects/${objectName}/describe`
  });
  return new Set(description.fields.map(field => field.name));
}

async function provisionObject(object) {
  if (await entityExists(object.fullName)) return 'skipped';
  await metadataCreate('CustomObject', object.fullName, object.metadata);
  return 'created';
}

async function provisionFields(objectName, fields) {
  const existing = await fieldNames(objectName);
  const results = [];
  for (const [name, metadata] of fields) {
    if (existing.has(name)) results.push({ name, action: 'skipped' });
    else {
      await metadataCreate('CustomField', `${objectName}.${name}`, metadata);
      results.push({ name, action: 'created' });
    }
  }
  return results;
}

async function main() {
  const result = { objects: [], fields: {} };
  for (const object of objects) {
    result.objects.push({
      name: object.fullName,
      action: await provisionObject(object)
    });
  }
  result.fields.Badge_Definition__c = await provisionFields(
    'Badge_Definition__c',
    definitionFields
  );
  result.fields.Badge_Earned__c = await provisionFields(
    'Badge_Earned__c',
    earnedFields
  );
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(
      JSON.stringify(
        {
          message: error.message,
          status: error.response && error.response.status,
          details: error.response && error.response.data
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  });
}

module.exports = { objects, definitionFields, earnedFields };
