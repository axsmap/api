const assert = require('assert');
const fs = require('fs');
const path = require('path');

const badgeCatalog = require('./badge-catalog');

assert.strictEqual(badgeCatalog.length, 20);
assert.strictEqual(new Set(badgeCatalog.map(badge => badge.badgeId)).size, 20);

badgeCatalog.forEach(badge => {
  assert.strictEqual(badge.isActive, true);
  assert.strictEqual(
    badge.iconUrl,
    `https://api.axsmap.com/badges/${badge.badgeId}.svg`
  );
  assert.ok(
    fs.existsSync(
      path.join(__dirname, '../../public/badges', `${badge.badgeId}.svg`)
    ),
    `Missing SVG for ${badge.badgeId}`
  );
});

assert.strictEqual(badgeCatalog.filter(badge => badge.isActive).length, 20);
console.log('Active badge catalog assets verified: 20/20');
