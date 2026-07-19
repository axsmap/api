const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const { progressForDefinition } = require('./badge-evaluator');

const metrics = {
  approvedReviews: 12,
  categoryReviews: { restaurant: 8, cafe: 3 },
  mapathons: 6,
  fundraisers: 2,
  countries: [],
  geographicDataComplete: false
};

test('computes progress for supported badge criteria', () => {
  assert.deepStrictEqual(
    progressForDefinition({ criteria: { type: 'approved_reviews' } }, metrics),
    { supported: true, value: 12 }
  );
  assert.deepStrictEqual(
    progressForDefinition(
      {
        criteria: {
          type: 'category_review',
          googlePlaceTypes: ['restaurant', 'cafe']
        }
      },
      metrics
    ),
    { supported: true, value: 11 }
  );
  assert.strictEqual(
    progressForDefinition(
      { criteria: { type: 'mapathon_participation' } },
      metrics
    ).value,
    6
  );
  assert.strictEqual(
    progressForDefinition(
      { criteria: { type: 'fundraiser_participation' } },
      metrics
    ).value,
    2
  );
});

test('marks geographic progress unavailable without country data', () => {
  const result = progressForDefinition(
    { criteria: { type: 'geographic_review' } },
    metrics
  );
  assert.strictEqual(result.supported, false);
  assert.strictEqual(result.value, null);
  assert.match(result.reason, /countryCode/);
});
