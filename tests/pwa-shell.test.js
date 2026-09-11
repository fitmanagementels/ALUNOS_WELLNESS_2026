const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('shell PWA inicia sem login Google e possui manifesto e service worker', () => {
  const html = fs.readFileSync('pwa/index.html', 'utf8');
  const manifest = JSON.parse(fs.readFileSync('pwa/manifest.webmanifest', 'utf8'));
  const worker = fs.readFileSync('pwa/sw.js', 'utf8');
  const styles = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  const appIcon = fs.readFileSync('pwa/assets/xsteam-gestao-icon.svg', 'utf8');
  assert.match(html, /runtime-config\.js/);
  assert.doesNotMatch(html, /accounts\.google\.com\/gsi\/client/);
  assert.doesNotMatch(html, /loginButton|authScreen/);
  assert.match(html, /id="loading-screen"/);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.icons[0].src, './assets/xsteam-gestao-icon.svg');
  assert.match(appIcon, /data-variant="gestao"/);
  assert.match(worker, /xsteam-static-v11/);
  assert.match(worker, /\.\/css\/student-profiles\.css/);
  assert.match(worker, /\.\/css\/permanencia\.css/);
  assert.match(worker, /\.\/js\/student-profiles\.js/);
  assert.match(worker, /\.\/js\/permanencia\.js/);
  assert.match(worker, /addAll\(STATIC_ASSETS\)/);
  assert.match(worker, /fetch\(event\.request\)/);
  assert.doesNotMatch(worker, /script\.googleapis\.com/);
  assert.match(styles, /\.svg-symbol-definitions\s*\{[^}]*position:\s*absolute/);
});

test('configuração de exemplo contém somente endpoint público do Worker', () => {
  const config = fs.readFileSync('pwa/runtime-config.js.example', 'utf8');
  const api = fs.readFileSync('pwa/js/api.js', 'utf8');
  const dashboard = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(config, /workerUrl/);
  assert.match(api, /XsteamConfig\.workerUrl/);
  assert.doesNotMatch(api, /requestAccessToken|script\.googleapis\.com|oauth/i);
  assert.doesNotMatch(config, /oauthClientId|client_secret|refresh_token|password/i);
  assert.doesNotMatch(dashboard, /XsteamApi\.account/);
});
