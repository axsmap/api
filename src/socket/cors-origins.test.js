const assert = require('assert');
const test = require('node:test');

const {
  getChatAllowedOrigins,
  parseOrigins
} = require('./cors-origins');

test('production web origins include both canonical and Amplify hosts', () => {
  const origins = getChatAllowedOrigins({});

  assert.ok(origins.includes('https://axsmap.com'));
  assert.ok(origins.includes('https://www.axsmap.com'));
  assert.ok(
    origins.includes(
      'https://prod-next-app.d1hq3xdk40wf8p.amplifyapp.com'
    )
  );
});

test('configured origin lists are normalized and deduplicated', () => {
  const origins = getChatAllowedOrigins({
    WEB_APP_URL: 'https://preview.example.com/',
    WEB_APP_URLS:
      'https://preview.example.com, https://staging.example.com/'
  });

  assert.strictEqual(
    origins.filter(origin => origin === 'https://preview.example.com').length,
    1
  );
  assert.ok(origins.includes('https://staging.example.com'));
});

test('empty configured values do not create wildcard origins', () => {
  assert.deepStrictEqual(parseOrigins(' , '), []);
  assert.ok(!getChatAllowedOrigins({ WEB_APP_URL: '*' }).includes('*'));
});
