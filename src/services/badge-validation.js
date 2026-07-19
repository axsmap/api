const { BadgeDefinition } = require('../models/badge-definition');
const { EarnedBadge } = require('../models/earned-badge');
const { User } = require('../models/user');
const salesforce = require('../helpers/salesforce');
const { config, definitionPayload, earnedPayload } = require('./badge-sync');

function comparable(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function compareFields(expected, actual, identity, type, mismatches) {
  Object.keys(expected).forEach(field => {
    if (comparable(expected[field]) !== comparable(actual[field])) {
      mismatches.push({
        type,
        id: identity,
        field,
        mongo: expected[field],
        salesforce: actual[field]
      });
    }
  });
}

function index(records, field) {
  const byId = new Map();
  const duplicates = [];
  records.forEach(record => {
    const id = record[field] == null ? null : String(record[field]);
    if (!id) return;
    if (byId.has(id))
      duplicates.push({ id, salesforceIds: [byId.get(id).Id, record.Id] });
    else byId.set(id, record);
  });
  return { byId, duplicates };
}

async function validateBadgeSynchronization() {
  const settings = config();
  const definitionSelect = ['Id', ...Object.values(settings.definitionFields)];
  const earnedSelect = [
    'Id',
    ...Object.values(settings.earnedFields).filter(
      field =>
        field !== settings.earnedFields.badgeLookup &&
        field !== settings.earnedFields.contactLookup
    ),
    settings.earnedFields.badgeLookup,
    settings.earnedFields.contactLookup
  ];
  const [definitions, earned, sfDefinitions, sfEarned] = await Promise.all([
    BadgeDefinition.find({}).lean(),
    EarnedBadge.find({})
      .populate('badge')
      .populate({ path: 'user', model: User }),
    salesforce.queryAll(
      `SELECT ${definitionSelect.join(', ')} FROM ${settings.definitionObject}`
    ),
    salesforce.queryAll(
      `SELECT ${earnedSelect.join(', ')} FROM ${settings.earnedObject}`
    )
  ]);
  const definitionIndex = index(
    sfDefinitions,
    settings.definitionFields.badgeId
  );
  const earnedIndex = index(sfEarned, settings.earnedFields.earnedId);
  const report = {
    generatedAt: new Date().toISOString(),
    missingRecords: [],
    fieldMismatches: [],
    duplicateRecords: [
      ...definitionIndex.duplicates.map(item => ({
        type: 'definition',
        ...item
      })),
      ...earnedIndex.duplicates.map(item => ({ type: 'earned', ...item }))
    ],
    failedSyncAttempts: [],
    orphanedRecords: []
  };
  const mongoDefinitionIds = new Set();
  const definitionSalesforceIds = new Map();

  definitions.forEach(badge => {
    mongoDefinitionIds.add(badge.badgeId);
    const sf = definitionIndex.byId.get(badge.badgeId);
    if (!sf) {
      report.missingRecords.push({
        type: 'definition',
        id: badge.badgeId,
        missingFrom: 'Salesforce'
      });
      return;
    }
    definitionSalesforceIds.set(String(badge._id), sf.Id);
    compareFields(
      definitionPayload(badge, settings.definitionFields),
      sf,
      badge.badgeId,
      'definition',
      report.fieldMismatches
    );
  });
  sfDefinitions.forEach(sf => {
    const id = String(sf[settings.definitionFields.badgeId] || '');
    if (id && !mongoDefinitionIds.has(id)) {
      report.missingRecords.push({
        type: 'definition',
        id,
        missingFrom: 'MongoDB/AXS Map'
      });
    }
  });

  const mongoEarnedIds = new Set();
  earned.forEach(item => {
    const id = String(item._id);
    mongoEarnedIds.add(id);
    if (!item.badge || !item.user) {
      report.orphanedRecords.push({
        type: 'earned',
        id,
        system: 'MongoDB'
      });
      return;
    }
    const sf = earnedIndex.byId.get(id);
    if (!sf) {
      report.missingRecords.push({
        type: 'earned',
        id,
        missingFrom: 'Salesforce'
      });
      return;
    }
    const definitionId = definitionSalesforceIds.get(String(item.badge._id));
    const contactId = item.user.salesforceContactId;
    if (!definitionId || !contactId) {
      report.orphanedRecords.push({
        type: 'earned',
        id,
        system: 'MongoDB',
        reason: !definitionId
          ? 'badge definition is not mapped'
          : 'user has no Salesforce Contact mapping'
      });
      return;
    }
    compareFields(
      earnedPayload(item, definitionId, contactId, settings.earnedFields),
      sf,
      id,
      'earned',
      report.fieldMismatches
    );
  });
  sfEarned.forEach(sf => {
    const id = String(sf[settings.earnedFields.earnedId] || '');
    if (id && !mongoEarnedIds.has(id)) {
      report.missingRecords.push({
        type: 'earned',
        id,
        missingFrom: 'MongoDB/AXS Map'
      });
    }
    if (
      !sf[settings.earnedFields.badgeLookup] ||
      !sf[settings.earnedFields.contactLookup]
    ) {
      report.orphanedRecords.push({ type: 'earned', id, system: 'Salesforce' });
    }
  });

  report.summary = {
    mongoDefinitions: definitions.length,
    salesforceDefinitions: sfDefinitions.length,
    mongoEarned: earned.length,
    salesforceEarned: sfEarned.length,
    missingRecords: report.missingRecords.length,
    fieldMismatches: report.fieldMismatches.length,
    duplicateRecords: report.duplicateRecords.length,
    failedSyncAttempts: report.failedSyncAttempts.length,
    orphanedRecords: report.orphanedRecords.length
  };
  report.summary.totalFailures =
    report.summary.missingRecords +
    report.summary.fieldMismatches +
    report.summary.duplicateRecords +
    report.summary.failedSyncAttempts +
    report.summary.orphanedRecords;
  report.success = report.summary.totalFailures === 0;
  return report;
}

module.exports = { validateBadgeSynchronization };
