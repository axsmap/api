const { spawnSync } = require('child_process');
const https = require('https');
const mongoose = require('mongoose');

require('dotenv').config();

const { BadgeDefinition } = require('../models/badge-definition');
const { User } = require('../models/user');
const { config, definitionPayload } = require('../services/badge-sync');

function sfQuery(soql) {
  const result = spawnSync(
    'sf',
    [
      'data',
      'query',
      '--target-org',
      'codex-integration',
      '--query',
      soql,
      '--json'
    ],
    { encoding: 'utf8' }
  );
  if (result.status !== 0) throw new Error(result.stdout || result.stderr);
  return JSON.parse(result.stdout).result.records || [];
}

function normalize(value, field) {
  if (value == null || value === '') return null;
  if (/Date__c$/.test(field))
    return Math.floor(new Date(value).getTime() / 1000);
  return value;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, response => {
        let body = '';
        response.on('data', chunk => {
          body += chunk;
        });
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            return resolve({ status: response.statusCode, body: null });
          }
          try {
            return resolve({
              status: response.statusCode,
              body: JSON.parse(body)
            });
          } catch (error) {
            return reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

async function main() {
  await mongoose.connect(
    process.env.MONGODB_URI,
    {
      connectTimeoutMS: 30000,
      useCreateIndex: true,
      useNewUrlParser: true
    }
  );
  const settings = config();
  const definitions = await BadgeDefinition.find({})
    .sort({ displayOrder: 1, badgeId: 1 })
    .lean();
  const fields = [
    ...new Set(['Id', ...Object.values(settings.definitionFields)])
  ];
  const salesforce = sfQuery(
    `SELECT ${fields.join(', ')} FROM ${settings.definitionObject}`
  );
  const salesforceById = new Map(
    salesforce.map(record => [
      String(record[settings.definitionFields.badgeId]),
      record
    ])
  );
  const mismatches = [];
  definitions.forEach(definition => {
    const actual = salesforceById.get(definition.badgeId);
    if (!actual) {
      mismatches.push({
        id: definition.badgeId,
        field: '_record',
        issue: 'missing from Salesforce'
      });
      return;
    }
    const expected = definitionPayload(definition, settings.definitionFields);
    Object.keys(expected).forEach(field => {
      if (
        normalize(expected[field], field) !== normalize(actual[field], field)
      ) {
        mismatches.push({ id: definition.badgeId, field });
      }
    });
  });
  const duplicateMongo =
    definitions.length - new Set(definitions.map(item => item.badgeId)).size;
  const duplicateSalesforce =
    salesforce.length -
    new Set(
      salesforce.map(item => String(item[settings.definitionFields.badgeId]))
    ).size;
  const user = await User.findOne({ isArchived: false })
    .select('_id')
    .lean();
  const axsMap = user
    ? await getJson(`https://api.axsmap.com/users/${user._id}/badges`)
    : { status: null, body: null };
  const axsDefinitions =
    axsMap.body && Array.isArray(axsMap.body.definitions)
      ? axsMap.body.definitions
      : null;
  const report = {
    verifiedAt: new Date().toISOString(),
    counts: {
      mongo: definitions.length,
      salesforce: salesforce.length,
      axsMapLiveEndpoint: axsDefinitions ? axsDefinitions.length : null
    },
    duplicates: { mongo: duplicateMongo, salesforce: duplicateSalesforce },
    fieldMismatches: mismatches,
    axsMapEndpointStatus: axsMap.status,
    definitions: definitions.map(item => ({
      badgeId: item.badgeId,
      name: item.name,
      category: item.category,
      threshold: item.threshold,
      displayOrder: item.displayOrder,
      active: item.isActive
    }))
  };
  report.mongoSalesforceSynchronized =
    definitions.length === salesforce.length &&
    duplicateMongo === 0 &&
    duplicateSalesforce === 0 &&
    mismatches.length === 0;
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async error => {
  console.error(error.stack || error.message);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
