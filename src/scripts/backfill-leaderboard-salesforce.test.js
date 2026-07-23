const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const {
  baselineDocuments,
  contributorPipeline
} = require('./backfill-leaderboard-salesforce');

test('builds a leaderboard baseline without retroactive milestone events', () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const allTime = [
    { _id: 'user-a', reviewCount: 50, salesforceContactId: '003a' },
    { _id: 'user-b', reviewCount: 10 }
  ];
  const monthly = [{ _id: 'user-b', reviewCount: 3 }];
  const rows = baselineDocuments(allTime, monthly, now);

  assert.equal(rows[0].state.allTimePosition, 1);
  assert.equal(rows[0].state.monthlyPosition, null);
  assert.equal(rows[0].job.kind, 'contact');
  assert.equal(rows[1].state.allTimePosition, 2);
  assert.equal(rows[1].state.monthlyPosition, 1);
  assert.equal(rows[1].job.contactId, null);
  assert.equal(rows[0].events, undefined);
});

test('leaderboard aggregation excludes banned reviews and system users', () => {
  const pipeline = contributorPipeline();
  assert.equal(pipeline[0].$match.isBanned, false);
  assert.ok(pipeline[0].$match.user.$nin.length > 0);
  assert.ok(pipeline.some(stage => stage.$sort));
});
