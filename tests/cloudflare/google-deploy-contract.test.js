const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('configuração final usa Assets e D1 sem R2, Access ou segredos versionados', () => {
  const config = fs.readFileSync('worker/wrangler.jsonc', 'utf8');
  const oauth = fs.readFileSync('worker/src/google-oauth.js', 'utf8');
  assert.match(config, /"binding"\s*:\s*"DB"/);
  assert.match(config, /"directory"\s*:\s*"\.\.\/pwa"/);
  assert.doesNotMatch(config, /r2_buckets|"FILES"|cloudflareaccess|ACCESS_|GOOGLE_CLIENT_SECRET|SESSION_SECRET/i);
  assert.match(oauth, /GOOGLE_CLIENT_ID/);
  assert.match(oauth, /GOOGLE_CLIENT_SECRET/);
  assert.match(oauth, /SESSION_SECRET/);
});
