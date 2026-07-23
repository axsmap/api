const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const {
  monthKey,
  positionEvents,
  reviewEvents
} = require('./leaderboard-milestones');

test('detects every leaderboard threshold crossed by a rank jump', () => {
  const events = positionEvents({
    userId: 'user-1',
    leaderboardType: 'All-Time',
    oldPosition: 22,
    newPosition: 4
  });
  assert.deepEqual(
    events.map(event => event.eventType),
    ['Reached Top 20', 'Reached Top 10', 'Reached Top 5']
  );
});

test('creates only a joined event when leaderboard state is initialized', () => {
  const events = positionEvents({
    userId: 'user-1',
    leaderboardType: 'Monthly',
    oldPosition: null,
    newPosition: 3,
    periodKey: '2026-07'
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, 'Joined Leaderboard');
  assert.equal(events[0].uniqueEventKey, 'user-1:monthly:2026-07:joined');
});

test('detects review milestones without requiring exact equality', () => {
  const events = reviewEvents({
    userId: 'user-1',
    oldReviewCount: 9,
    newReviewCount: 26
  });
  assert.deepEqual(
    events.map(event => event.eventType),
    ['Reached 10 Reviews', 'Reached 25 Reviews']
  );
});

test('uses a stable UTC month key', () => {
  assert.equal(monthKey(new Date('2026-07-31T23:59:59Z')), '2026-07');
});
