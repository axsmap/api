// eslint-disable-next-line import/no-unresolved
const assert = require('node:assert/strict');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const { config, definitionPayload, earnedPayload } = require('./badge-sync');

test('maps every Mongo badge definition field to Salesforce', () => {
  const fields = config().definitionFields;
  const payload = definitionPayload(
    {
      name: 'Explorer',
      description: 'Visit five places',
      category: 'achievement',
      criteria: { kind: 'reviews' },
      threshold: 5,
      iconUrl: 'https://example.com/explorer.svg',
      displayOrder: 2,
      isActive: false,
      level: 'bronze',
      visibility: { public: false },
      metadata: { campaign: 'summer' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z')
    },
    fields
  );

  assert.equal(payload[fields.name], 'Explorer');
  assert.equal(payload[fields.criteria], '{"kind":"reviews"}');
  assert.equal(payload[fields.threshold], 5);
  assert.equal(payload[fields.isActive], false);
  assert.equal(payload[fields.visibility], '{"public":false}');
  assert.equal(payload[fields.metadata], '{"campaign":"summer"}');
  assert.equal(payload[fields.updatedAt], '2026-01-02T00:00:00.000Z');
});

test('maps earned badge relationships and metadata to Salesforce', () => {
  const fields = config().earnedFields;
  const payload = earnedPayload(
    {
      earnedAt: new Date('2026-02-01T00:00:00.000Z'),
      level: 'gold',
      visibility: { public: true },
      metadata: { source: 'import' },
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-02T00:00:00.000Z')
    },
    'a-definition-id',
    'a-contact-id',
    fields
  );

  assert.equal(payload[fields.badgeLookup], 'a-definition-id');
  assert.equal(payload[fields.contactLookup], 'a-contact-id');
  assert.equal(payload[fields.earnedAt], '2026-02-01T00:00:00.000Z');
  assert.equal(payload[fields.level], 'gold');
});
