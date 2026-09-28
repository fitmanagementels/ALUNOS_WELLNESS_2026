const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function moduleUnderTest() {
  const context = { crypto: globalThis.crypto, TextEncoder, Blob, btoa, atob, console };
  context.window = context;
  vm.runInNewContext(fs.readFileSync('pwa/js/local-backup.js', 'utf8'), context);
  return context.XsteamLocalBackup;
}

test('backup cifra com PBKDF2 de 600000 iterações sem serializar a senha', async () => {
  const backup = moduleUnderTest();
  const file = await backup.createEncryptedFile({ format: 'xsteam-local-backup', tables: { students: [] } }, 'senha-longa-123');
  const text = await file.text();
  assert.match(text, /AES-GCM/);
  assert.match(text, /600000/);
  assert.doesNotMatch(text, /senha-longa-123/);
});

test('senha curta ou confirmação diferente é recusada antes da cifra', async () => {
  const backup = moduleUnderTest();
  assert.throws(() => backup.validatePasswordPair('curta', 'curta'), /12 caracteres/);
  assert.throws(() => backup.validatePasswordPair('senha-longa-123', 'outra-senha-456'), /não coincidem/);
});
