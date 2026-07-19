const assert = require('assert');
// eslint-disable-next-line import/no-unresolved
const test = require('node:test');

const { countryCodeFromPlace } = require('./place-country');

test('extracts a normalized country code from Google address components', () => {
  assert.strictEqual(
    countryCodeFromPlace({
      address_components: [
        {
          long_name: 'United States',
          short_name: 'us',
          types: ['country', 'political']
        }
      ]
    }),
    'US'
  );
});

test('returns null when Google does not supply a country component', () => {
  assert.strictEqual(countryCodeFromPlace({ address_components: [] }), null);
  assert.strictEqual(countryCodeFromPlace(null), null);
});

test('supports Places API New address component names', () => {
  assert.strictEqual(
    countryCodeFromPlace({
      addressComponents: [
        { longText: 'Canada', shortText: 'ca', types: ['country', 'political'] }
      ]
    }),
    'CA'
  );
});
