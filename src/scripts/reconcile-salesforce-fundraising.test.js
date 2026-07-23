const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const {
  activePledgeQuery,
  isEnded,
  safeError
} = require('./reconcile-salesforce-fundraising');

test('selects only pledge states eligible for settlement reconciliation', () => {
  assert.deepEqual(activePledgeQuery(), {
    type: 'pledge',
    status: { $in: ['pledged', 'approved', 'calculated'] },
    'salesforceSync.status': { $ne: 'synced' }
  });
});

test('recognizes Mapathons that ended at or before the reconciliation time', () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  assert.equal(
    isEnded({ endDate: new Date('2026-07-23T12:00:00.000Z') }, now),
    true
  );
  assert.equal(
    isEnded({ endDate: new Date('2026-07-23T12:00:01.000Z') }, now),
    false
  );
  assert.equal(isEnded(null, now), false);
});

test('normalizes Salesforce error bodies without exceeding storage limits', () => {
  const error = {
    response: { data: [{ errorCode: 'INVALID_FIELD', message: 'Bad field' }] }
  };
  assert.match(safeError(error), /INVALID_FIELD/);
  assert.ok(safeError(new Error('x'.repeat(3000))).length <= 2000);
});
