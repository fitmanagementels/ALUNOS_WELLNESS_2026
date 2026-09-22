const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('runtime Cloudflare usa assets, D1 e R2 sem upstream Google', () => {
  const config = fs.readFileSync('worker/wrangler.jsonc', 'utf8');
  const ignore = fs.readFileSync('.gitignore', 'utf8');

  assert.match(config, /"directory"\s*:\s*"\.\.\/pwa"/);
  assert.match(config, /"binding"\s*:\s*"DB"/);
  assert.match(config, /"binding"\s*:\s*"FILES"/);
  assert.doesNotMatch(config, /APPS_SCRIPT/);
  assert.match(ignore, /worker\/\.wrangler\//);
});
