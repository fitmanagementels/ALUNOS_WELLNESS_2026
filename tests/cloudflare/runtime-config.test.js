const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('runtime Cloudflare usa assets e D1 sem R2 ou Cloudflare Access', () => {
  const config = fs.readFileSync('worker/wrangler.jsonc', 'utf8');
  const ignore = fs.readFileSync('.gitignore', 'utf8');

  assert.match(config, /"directory"\s*:\s*"\.\.\/pwa"/);
  assert.match(config, /"binding"\s*:\s*"DB"/);
  assert.match(config, /"run_worker_first"\s*:\s*\[[^\]]*"\/auth\/\*"/);
  assert.match(config, /"run_worker_first"\s*:\s*\[[^\]]*"\/"/);
  assert.doesNotMatch(config, /r2_buckets|"FILES"|"triggers"|"access"/);
  assert.doesNotMatch(config, /APPS_SCRIPT/);
  assert.match(ignore, /worker\/\.wrangler\//);
});
