const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Configurações inclui Segurança e backup e carrega módulo offline', () => {
  const dashboard = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  const index = fs.readFileSync('pwa/index.html', 'utf8');
  const worker = fs.readFileSync('pwa/sw.js', 'utf8');
  assert.match(dashboard, /\['backup', 'Segurança e backup'\]/);
  assert.match(index, /\.\/js\/local-backup\.js/);
  assert.match(worker, /\.\/js\/local-backup\.js/);
});

test('tela não persiste nem envia senha para API', () => {
  const dashboard = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.doesNotMatch(dashboard, /localStorage\.setItem\([^)]*(senha|password)/i);
  assert.match(dashboard, /XsteamApi\.call\('exportBackup'\)/);
  assert.doesNotMatch(dashboard, /XsteamApi\.call\('exportBackup',\s*(senha|password)/i);
});
