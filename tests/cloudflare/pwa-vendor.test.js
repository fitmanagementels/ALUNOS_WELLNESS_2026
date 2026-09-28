const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('PWA carrega Chart.js localmente e o mantém disponível offline', () => {
  const html = fs.readFileSync('pwa/index.html', 'utf8');
  const worker = fs.readFileSync('pwa/sw.js', 'utf8');
  assert.ok(fs.statSync('pwa/vendor/chart.umd.js').size > 100000);
  assert.match(html, /\.\/vendor\/chart\.umd\.js/);
  assert.doesNotMatch(html, /cdn\.jsdelivr|unpkg\.com/);
  assert.match(worker, /\.\/vendor\/chart\.umd\.js/);
});
