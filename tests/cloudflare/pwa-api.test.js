const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('cliente PWA usa API same-origin protegida por sessão', () => {
  const api = fs.readFileSync('pwa/js/api.js', 'utf8');
  const html = fs.readFileSync('pwa/index.html', 'utf8');
  const workerConfig = fs.readFileSync('pwa/js/config.js', 'utf8');

  assert.match(api, /fetch\('\/api'/);
  assert.match(api, /credentials:\s*'same-origin'/);
  assert.doesNotMatch(api, /workerUrl/);
  assert.doesNotMatch(html, /runtime-config\.js/);
  assert.doesNotMatch(workerConfig, /workerUrl/);
});
