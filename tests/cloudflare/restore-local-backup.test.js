const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');

async function envelope(snapshot, password) {
  const salt = new Uint8Array(16).fill(4), iv = new Uint8Array(12).fill(9), enc = new TextEncoder();
  const material = await webcrypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ciphertext = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(snapshot)));
  const b64 = (value) => Buffer.from(value).toString('base64');
  return { format: 'xsteam-encrypted-backup', version: 1, algorithm: 'AES-GCM', kdf: 'PBKDF2-SHA-256', iterations: 600000, salt: b64(salt), iv: b64(iv), ciphertext: b64(ciphertext) };
}

test('restauração decifra envelope válido e gera SQL', async () => {
  const { decryptEnvelope, buildRestoreSql } = require('../../scripts/restore-local-backup');
  const data = await decryptEnvelope(await envelope({ format: 'xsteam-local-backup', version: 1, tables: { students: [{ student_id: '1', name: "O'Hara" }] } }, 'senha-longa-123'), 'senha-longa-123');
  assert.equal(data.tables.students[0].name, "O'Hara");
  assert.match(buildRestoreSql(data.tables), /O''Hara/);
});

test('senha errada, versão inválida e banco não confirmado são recusados', async () => {
  const { decryptEnvelope, assertApplyAllowed } = require('../../scripts/restore-local-backup');
  const file = await envelope({ format: 'xsteam-local-backup', version: 1, tables: {} }, 'senha-longa-123');
  await assert.rejects(() => decryptEnvelope(file, 'senha-errada-123'), /Não foi possível decifrar/);
  await assert.rejects(() => decryptEnvelope({ ...file, version: 99 }, 'senha-longa-123'), /[Vv]ersão/);
  assert.throws(() => assertApplyAllowed(['--apply', '--confirm-database', 'outro']), /confirm-database xsteam-gestao/);
});
