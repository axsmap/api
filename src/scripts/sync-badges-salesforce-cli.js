const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();

const { BadgeDefinition } = require('../models/badge-definition');
const { EarnedBadge } = require('../models/earned-badge');
const { User } = require('../models/user');
const {
  config,
  definitionPayload,
  earnedPayload
} = require('../services/badge-sync');

const targetOrg = process.env.SALESFORCE_CLI_TARGET_ORG || 'codex-integration';

function sf(arguments_) {
  const result = spawnSync('sf', [...arguments_, '--json'], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
  if (result.status !== 0) {
    const error = new Error('Salesforce CLI command failed');
    error.details = result.stdout || result.stderr;
    throw error;
  }
  const response = JSON.parse(result.stdout);
  if (response.status !== 0) {
    const error = new Error(
      response.message || 'Salesforce CLI request failed'
    );
    error.details = response;
    throw error;
  }
  return response.result;
}

function csvValue(value) {
  if (value == null) return '';
  const string = String(value);
  return /[",\r\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
}

function writeCsv(file, rows) {
  const fields = [
    ...new Set(rows.reduce((all, row) => [...all, ...Object.keys(row)], []))
  ];
  fs.writeFileSync(
    file,
    [
      fields.join(','),
      ...rows.map(row => fields.map(field => csvValue(row[field])).join(','))
    ].join('\n') + '\n'
  );
}

function query(objectName, fields) {
  return (
    sf([
      'data',
      'query',
      '--target-org',
      targetOrg,
      '--query',
      `SELECT ${fields.join(', ')} FROM ${objectName}`
    ]).records || []
  );
}

function upsert(objectName, externalId, rows, temporary) {
  if (!rows.length) return;
  const file = path.join(temporary, `${objectName}-upsert.csv`);
  writeCsv(file, rows);
  sf([
    'data',
    'upsert',
    'bulk',
    '--target-org',
    targetOrg,
    '--sobject',
    objectName,
    '--external-id',
    externalId,
    '--file',
    file,
    '--line-ending',
    'LF',
    '--wait',
    '10'
  ]);
}

function remove(objectName, records, temporary) {
  if (!records.length) return;
  const file = path.join(temporary, `${objectName}-delete.csv`);
  writeCsv(file, records.map(record => ({ Id: record.Id })));
  sf([
    'data',
    'delete',
    'bulk',
    '--target-org',
    targetOrg,
    '--sobject',
    objectName,
    '--file',
    file,
    '--line-ending',
    'LF',
    '--wait',
    '10'
  ]);
}

function normalize(value, field) {
  if (value == null || value === '') return null;
  if (/Date__c$/.test(field)) {
    return Math.floor(new Date(value).getTime() / 1000);
  }
  if (typeof value === 'number') return Number(value);
  return value;
}

function compare(expected, actual, id, type, mismatches) {
  Object.keys(expected).forEach(field => {
    if (normalize(expected[field], field) !== normalize(actual[field], field)) {
      mismatches.push({
        type,
        id,
        field,
        mongo: expected[field],
        salesforce: actual[field]
      });
    }
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
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'axs-badge-sync-'));
  const definitions = await BadgeDefinition.find({})
    .sort({ displayOrder: 1, badgeId: 1 })
    .lean();
  const earned = await EarnedBadge.find({})
    .populate('badge')
    .populate({ path: 'user', model: User });
  const definitionExternal = settings.definitionFields.badgeId;
  const earnedExternal = settings.earnedFields.earnedId;
  const beforeDefinitions = query(settings.definitionObject, [
    'Id',
    definitionExternal
  ]);
  const beforeEarned = query(settings.earnedObject, ['Id', earnedExternal]);
  const beforeDefinitionIds = new Set(
    beforeDefinitions.map(record => String(record[definitionExternal]))
  );
  const beforeEarnedIds = new Set(
    beforeEarned.map(record => String(record[earnedExternal]))
  );

  upsert(
    settings.definitionObject,
    definitionExternal,
    definitions.map(definition => ({
      [definitionExternal]: definition.badgeId,
      ...definitionPayload(definition, settings.definitionFields)
    })),
    temporary
  );
  const syncedDefinitions = query(settings.definitionObject, [
    'Id',
    definitionExternal
  ]);
  const definitionSalesforceIds = new Map(
    syncedDefinitions.map(record => [
      String(record[definitionExternal]),
      record.Id
    ])
  );
  const orphanedRecords = [];
  const earnedRows = earned
    .map(item => {
      const badgeId = item.badge && item.badge.badgeId;
      const definitionId = badgeId && definitionSalesforceIds.get(badgeId);
      const contactId = item.user && item.user.salesforceContactId;
      if (!definitionId || !contactId) {
        orphanedRecords.push({ type: 'earned', id: String(item._id) });
        return null;
      }
      return {
        [earnedExternal]: String(item._id),
        ...earnedPayload(item, definitionId, contactId, settings.earnedFields)
      };
    })
    .filter(Boolean);
  upsert(settings.earnedObject, earnedExternal, earnedRows, temporary);

  const mongoEarnedIds = new Set(earned.map(item => String(item._id)));
  const earnedRemovals = beforeEarned.filter(
    record => !mongoEarnedIds.has(String(record[earnedExternal]))
  );
  remove(settings.earnedObject, earnedRemovals, temporary);
  const mongoDefinitionIds = new Set(definitions.map(item => item.badgeId));
  const definitionRemovals = beforeDefinitions.filter(
    record => !mongoDefinitionIds.has(String(record[definitionExternal]))
  );
  remove(settings.definitionObject, definitionRemovals, temporary);

  const definitionFields = [
    definitionExternal,
    ...Object.values(settings.definitionFields).filter(
      field => field !== definitionExternal
    )
  ];
  const earnedFields = [
    earnedExternal,
    ...Object.values(settings.earnedFields).filter(
      field => field !== earnedExternal && field.indexOf('__r.') < 0
    )
  ];
  const finalDefinitions = query(settings.definitionObject, [
    'Id',
    ...definitionFields
  ]);
  const finalEarned = query(settings.earnedObject, ['Id', ...earnedFields]);
  const definitionById = new Map();
  const earnedById = new Map();
  const duplicateRecords = [];
  finalDefinitions.forEach(record => {
    const id = String(record[definitionExternal]);
    if (definitionById.has(id))
      duplicateRecords.push({ type: 'definition', id });
    else {
      definitionById.set(id, record);
    }
  });
  finalEarned.forEach(record => {
    const id = String(record[earnedExternal]);
    if (earnedById.has(id)) duplicateRecords.push({ type: 'earned', id });
    else {
      earnedById.set(id, record);
    }
  });
  const missingRecords = [];
  const fieldMismatches = [];
  definitions.forEach(definition => {
    const record = definitionById.get(definition.badgeId);
    if (!record) {
      missingRecords.push({ type: 'definition', id: definition.badgeId });
    } else {
      compare(
        definitionPayload(definition, settings.definitionFields),
        record,
        definition.badgeId,
        'definition',
        fieldMismatches
      );
    }
  });
  earnedRows.forEach(row => {
    const id = String(row[earnedExternal]);
    const record = earnedById.get(id);
    if (!record) {
      missingRecords.push({ type: 'earned', id });
    } else {
      const expected = { ...row };
      delete expected[earnedExternal];
      compare(expected, record, id, 'earned', fieldMismatches);
    }
  });
  const report = {
    generatedAt: new Date().toISOString(),
    oauthUser: 'whentheywalk+codex@gmail.com',
    counts: {
      mongoDefinitions: definitions.length,
      salesforceDefinitions: finalDefinitions.length,
      localApiMongoBackedDefinitions: definitions.length,
      mongoEarned: earned.length,
      salesforceEarned: finalEarned.length,
      localApiMongoBackedEarned: earned.length
    },
    operations: {
      definitionsCreated: definitions.filter(
        item => !beforeDefinitionIds.has(item.badgeId)
      ).length,
      definitionsUpdated: definitions.filter(item =>
        beforeDefinitionIds.has(item.badgeId)
      ).length,
      earnedCreated: earned.filter(
        item => !beforeEarnedIds.has(String(item._id))
      ).length,
      earnedUpdated: earned.filter(item =>
        beforeEarnedIds.has(String(item._id))
      ).length,
      removed: definitionRemovals.length + earnedRemovals.length
    },
    missingRecords,
    duplicateRecords,
    orphanedRecords,
    fieldMismatches,
    errors: []
  };
  report.totalFailures =
    missingRecords.length +
    duplicateRecords.length +
    orphanedRecords.length +
    fieldMismatches.length;
  report.success = report.totalFailures === 0;
  fs.writeFileSync(
    path.resolve(process.cwd(), 'badge-sync-report.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  if (!report.success) process.exitCode = 1;
}

main().catch(async error => {
  console.error(
    JSON.stringify({ message: error.message, details: error.details }, null, 2)
  );
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
