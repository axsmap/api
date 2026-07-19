const { BadgeDefinition } = require('../models/badge-definition');
const { EarnedBadge } = require('../models/earned-badge');
const { User } = require('../models/user');
const salesforce = require('../helpers/salesforce');

const definitionFields = {
  badgeId: 'AXS_Map_Badge_ID__c',
  name: 'Name',
  description: 'Description__c',
  category: 'Category__c',
  criteria: 'Criteria_JSON__c',
  threshold: 'Threshold__c',
  iconUrl: 'Icon_URL__c',
  displayOrder: 'Display_Order__c',
  isActive: 'Active__c',
  level: 'Level_Tier__c',
  visibility: 'Visibility_JSON__c',
  metadata: 'Metadata_JSON__c',
  createdAt: 'Mongo_Created_Date__c',
  updatedAt: 'Mongo_Last_Modified_Date__c'
};

const earnedFields = {
  earnedId: 'AXS_Map_Earned_Badge_ID__c',
  badgeId: 'Badge__r.AXS_Map_Badge_ID__c',
  badgeLookup: 'Badge__c',
  userId: 'Contact__r.MongoDb_Id__c',
  contactLookup: 'Contact__c',
  earnedAt: 'Earned_Date__c',
  level: 'Level_Tier__c',
  visibility: 'Visibility_JSON__c',
  metadata: 'Metadata_JSON__c',
  createdAt: 'Mongo_Created_Date__c',
  updatedAt: 'Mongo_Last_Modified_Date__c'
};

function config() {
  return {
    definitionObject:
      process.env.SALESFORCE_BADGE_DEFINITION_OBJECT || 'Badge_Definition__c',
    earnedObject:
      process.env.SALESFORCE_BADGE_EARNED_OBJECT || 'Badge_Earned__c',
    definitionFields: { ...definitionFields },
    earnedFields: { ...earnedFields }
  };
}

function json(value) {
  return JSON.stringify(value == null ? {} : value);
}

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function definitionPayload(badge, fields) {
  return {
    [fields.name]: badge.name,
    [fields.description]: badge.description || '',
    [fields.category]: badge.category,
    [fields.criteria]: json(badge.criteria),
    [fields.threshold]: badge.threshold == null ? null : badge.threshold,
    [fields.iconUrl]: badge.iconUrl || '',
    [fields.displayOrder]: badge.displayOrder || 0,
    [fields.isActive]: badge.isActive !== false,
    [fields.level]: badge.level || null,
    [fields.visibility]: json(badge.visibility),
    [fields.metadata]: json(badge.metadata),
    [fields.createdAt]: iso(badge.createdAt),
    [fields.updatedAt]: iso(badge.updatedAt)
  };
}

function earnedPayload(earned, definitionSalesforceId, contactId, fields) {
  return {
    [fields.badgeLookup]: definitionSalesforceId,
    [fields.contactLookup]: contactId,
    [fields.earnedAt]: iso(earned.earnedAt),
    [fields.level]: earned.level || null,
    [fields.visibility]: json(earned.visibility),
    [fields.metadata]: json(earned.metadata),
    [fields.createdAt]: iso(earned.createdAt),
    [fields.updatedAt]: iso(earned.updatedAt)
  };
}

function newSummary() {
  return {
    startedAt: new Date().toISOString(),
    totalUsersProcessed: 0,
    totalBadgesProcessed: 0,
    created: 0,
    updated: 0,
    removed: 0,
    skipped: 0,
    validationFailures: 0,
    errors: [],
    operations: []
  };
}

function log(summary, operation) {
  summary.operations.push({ at: new Date().toISOString(), ...operation });
  console.log(JSON.stringify({ service: 'badge-sync', ...operation }));
}

function errorDetails(error) {
  const response = error.response || {};
  return {
    code: error.code || 'SYNC_ERROR',
    message: error.message,
    status: response.status,
    details: response.data
  };
}

async function existingByExternalId(objectName, externalIdField) {
  const records = await salesforce.queryAll(
    `SELECT Id, ${externalIdField} FROM ${objectName} ` +
      `WHERE ${externalIdField} != null`
  );
  const byId = new Map();
  const duplicates = [];
  records.forEach(record => {
    const key = String(record[externalIdField]);
    if (byId.has(key)) duplicates.push(record);
    else byId.set(key, record);
  });
  return { records, byId, duplicates };
}

async function upsertDefinitions(summary, settings, dryRun) {
  const badges = await BadgeDefinition.find({}).sort({
    displayOrder: 1,
    badgeId: 1
  });
  summary.totalBadgesProcessed = badges.length;
  const existing = await existingByExternalId(
    settings.definitionObject,
    settings.definitionFields.badgeId
  );
  const mongoIds = new Set(badges.map(item => item.badgeId));
  const salesforceIds = new Map();

  for (const badge of badges) {
    const prior = existing.byId.get(badge.badgeId);
    if (!dryRun) {
      const record = await salesforce.upsertRecord({
        objectName: settings.definitionObject,
        externalIdField: settings.definitionFields.badgeId,
        externalIdValue: badge.badgeId,
        fields: definitionPayload(badge, settings.definitionFields)
      });
      salesforceIds.set(String(badge._id), record.Id);
    } else
      salesforceIds.set(
        String(badge._id),
        prior ? prior.Id : `dry-run-${badge.badgeId}`
      );
    summary[prior ? 'updated' : 'created'] += 1;
    log(summary, {
      action: prior ? 'update' : 'create',
      type: 'definition',
      id: badge.badgeId,
      dryRun
    });
  }

  const removals = existing.records.filter(
    item => !mongoIds.has(String(item[settings.definitionFields.badgeId]))
  );
  return { salesforceIds, removals: [...existing.duplicates, ...removals] };
}

async function removeDefinitions(summary, settings, removals, dryRun) {
  for (const record of removals) {
    if (!dryRun) {
      await salesforce.deleteRecord({
        objectName: settings.definitionObject,
        recordId: record.Id
      });
    }
    summary.removed += 1;
    log(summary, {
      action: 'remove',
      type: 'definition',
      id: record.Id,
      dryRun
    });
  }
}

async function upsertEarned(
  summary,
  settings,
  definitionSalesforceIds,
  dryRun
) {
  const earned = await EarnedBadge.find({})
    .populate('badge')
    .populate({ path: 'user', model: User });
  summary.totalUsersProcessed = new Set(
    earned.map(item => String(item.user && item.user._id))
  ).size;
  const existing = await existingByExternalId(
    settings.earnedObject,
    settings.earnedFields.earnedId
  );
  const mongoIds = new Set(earned.map(item => String(item._id)));

  for (const item of earned) {
    const id = String(item._id);
    const prior = existing.byId.get(id);
    const definitionId =
      item.badge && definitionSalesforceIds.get(String(item.badge._id));
    const contactId = item.user && item.user.salesforceContactId;
    if (!item.badge || !item.user || !definitionId || !contactId) {
      const error = {
        code: 'ORPHANED_EARNED_BADGE',
        id,
        badgeFound: Boolean(item.badge),
        userFound: Boolean(item.user),
        definitionMapped: Boolean(definitionId),
        contactMapped: Boolean(contactId)
      };
      summary.errors.push(error);
      summary.skipped += 1;
      log(summary, { action: 'skip', type: 'earned', ...error });
      continue;
    }
    if (!dryRun) {
      await salesforce.upsertRecord({
        objectName: settings.earnedObject,
        externalIdField: settings.earnedFields.earnedId,
        externalIdValue: id,
        fields: earnedPayload(
          item,
          definitionId,
          contactId,
          settings.earnedFields
        )
      });
    }
    summary[prior ? 'updated' : 'created'] += 1;
    log(summary, {
      action: prior ? 'update' : 'create',
      type: 'earned',
      id,
      dryRun
    });
  }

  const removals = existing.records.filter(
    item => !mongoIds.has(String(item[settings.earnedFields.earnedId]))
  );
  for (const record of [...existing.duplicates, ...removals]) {
    if (!dryRun) {
      await salesforce.deleteRecord({
        objectName: settings.earnedObject,
        recordId: record.Id
      });
    }
    summary.removed += 1;
    log(summary, { action: 'remove', type: 'earned', id: record.Id, dryRun });
  }
}

async function synchronizeBadges({ dryRun = false, validate } = {}) {
  const summary = newSummary();
  const settings = config();
  try {
    const definitions = await upsertDefinitions(summary, settings, dryRun);
    await upsertEarned(summary, settings, definitions.salesforceIds, dryRun);
    await removeDefinitions(summary, settings, definitions.removals, dryRun);
    if (validate && !dryRun) {
      const report = await validate();
      summary.validation = report;
      summary.validationFailures = report.summary.totalFailures;
    }
  } catch (error) {
    const details = errorDetails(error);
    summary.errors.push(details);
    log(summary, { action: 'error', ...details });
  }
  summary.finishedAt = new Date().toISOString();
  summary.success =
    summary.errors.length === 0 && summary.validationFailures === 0;
  return summary;
}

module.exports = {
  config,
  definitionPayload,
  earnedPayload,
  synchronizeBadges
};
