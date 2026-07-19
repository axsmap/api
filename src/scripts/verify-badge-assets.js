const http = require('http');
const https = require('https');

require('dotenv').config();

const badgeCatalog = require('../data/badge-catalog');

const baseUrl = (
  process.argv[2] ||
  process.env.BADGE_ASSET_BASE_URL ||
  'https://api.axsmap.com/badges'
).replace(/\/$/, '');

function check(url) {
  return new Promise(resolve => {
    const client = url.startsWith('https:') ? https : http;
    const request = client.request(
      url,
      { method: 'HEAD', timeout: 15000 },
      response => {
        response.resume();
        resolve({
          url,
          status: response.statusCode,
          contentType: response.headers['content-type'] || '',
          cacheControl: response.headers['cache-control'] || ''
        });
      }
    );
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', error =>
      resolve({ url, status: 0, error: error.message })
    );
    request.end();
  });
}

async function main() {
  const activeDefinitions = badgeCatalog.filter(badge => badge.isActive);
  const results = await Promise.all(
    activeDefinitions.map(badge => check(`${baseUrl}/${badge.badgeId}.svg`))
  );
  const failures = results.filter(
    result =>
      result.status !== 200 ||
      !String(result.contentType).includes('image/svg+xml')
  );
  console.log(
    JSON.stringify(
      {
        baseUrl,
        checked: results.length,
        passed: results.length - failures.length,
        failed: failures.length,
        failures
      },
      null,
      2
    )
  );
  if (failures.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
