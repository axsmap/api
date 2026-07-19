const mongoose = require('mongoose');
const validator = require('validator');

require('dotenv').config();

const badgeCatalog = require('../data/badge-catalog');
const salesforce = require('../helpers/salesforce');
const { BadgeDefinition } = require('../models/badge-definition');
const { User } = require('../models/user');

async function seedDefinitions() {
  let created = 0;
  let updated = 0;
  for (const definition of badgeCatalog) {
    const result = await BadgeDefinition.updateOne(
      { badgeId: definition.badgeId },
      { $set: definition },
      { upsert: true }
    );
    if (result.upserted || result.upsertedId) created += 1;
    else updated += 1;
  }
  return { total: badgeCatalog.length, created, updated };
}

async function mapContacts() {
  const contacts = await salesforce.queryAll(
    'SELECT Id, Email, FirstName, LastName, MongoDb_Id__c FROM Contact'
  );
  const byMongoId = new Map();
  const byEmail = new Map();
  const duplicates = new Set();
  contacts.forEach(contact => {
    if (contact.MongoDb_Id__c) {
      const id = String(contact.MongoDb_Id__c);
      if (byMongoId.has(id)) duplicates.add(id);
      else byMongoId.set(id, contact.Id);
    }
    if (contact.Email) {
      const email = String(contact.Email)
        .trim()
        .toLowerCase();
      if (!byEmail.has(email)) byEmail.set(email, []);
      byEmail.get(email).push(contact);
    }
  });
  duplicates.forEach(id => byMongoId.delete(id));

  const users = await User.find({})
    .select('_id email firstName lastName salesforceContactId')
    .lean();
  let contactsLinkedByEmail = 0;
  let contactsCreated = 0;
  const unresolved = [];

  async function ensureContact(user) {
    const userId = String(user._id);
    if (byMongoId.has(userId)) return byMongoId.get(userId);
    if (!user.email) {
      unresolved.push({ userId, reason: 'missing email' });
      return null;
    }
    const email = String(user.email)
      .trim()
      .toLowerCase();
    const candidates = byEmail.get(email) || [];
    const unclaimed = candidates.filter(contact => !contact.MongoDb_Id__c);
    const normalized = value =>
      String(value || '')
        .trim()
        .toLowerCase();
    const exactNameMatches = unclaimed.filter(
      contact =>
        normalized(contact.FirstName) === normalized(user.firstName) &&
        normalized(contact.LastName) === normalized(user.lastName)
    );
    const candidate =
      unclaimed.length === 1
        ? unclaimed[0]
        : exactNameMatches.length === 1
          ? exactNameMatches[0]
          : null;
    if (candidate) {
      await salesforce.updateRecord({
        objectName: 'Contact',
        recordId: candidate.Id,
        fields: { MongoDb_Id__c: userId }
      });
      contactsLinkedByEmail += 1;
      return candidate.Id;
    }
    const created = await salesforce.createRecord({
      objectName: 'Contact',
      fields: {
        FirstName: user.firstName || undefined,
        LastName: user.lastName || 'AXS Map User',
        ...(candidates.length === 0 && validator.isEmail(String(user.email))
          ? { Email: user.email }
          : {}),
        MongoDb_Id__c: userId
      }
    });
    contactsCreated += 1;
    return created.Id;
  }

  for (let offset = 0; offset < users.length; offset += 10) {
    const batch = users.slice(offset, offset + 10);
    const resolved = await Promise.all(batch.map(ensureContact));
    resolved.forEach((contactId, index) => {
      if (contactId) byMongoId.set(String(batch[index]._id), contactId);
    });
  }

  const operations = [];
  byMongoId.forEach((contactId, userId) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) return;
    operations.push({
      updateOne: {
        filter: { _id: userId },
        update: { $set: { salesforceContactId: contactId } }
      }
    });
  });
  const result = operations.length
    ? await User.bulkWrite(operations, { ordered: false })
    : { matchedCount: 0, modifiedCount: 0, nMatched: 0, nModified: 0 };
  const matched =
    result.matchedCount == null ? result.nMatched : result.matchedCount;
  const modified =
    result.modifiedCount == null ? result.nModified : result.modifiedCount;
  return {
    contactsWithMongoId: [...byMongoId.keys()].length,
    duplicateMongoIds: duplicates.size,
    matchedUsers: matched || 0,
    modifiedUsers: modified || 0,
    contactsLinkedByEmail,
    contactsCreated,
    unresolvedUsers: unresolved.length
  };
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
  const report = {
    definitions: await seedDefinitions(),
    contactMappings: await mapContacts()
  };
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  if (
    report.contactMappings.duplicateMongoIds ||
    report.contactMappings.unresolvedUsers
  )
    process.exitCode = 1;
}

main().catch(async error => {
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
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
