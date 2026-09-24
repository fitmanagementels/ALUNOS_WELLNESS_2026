const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { validateAndDecodeBackup, buildRestoreSql, assertApplyAllowed } = require('../../scripts/restore-r2-backup');

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

test('restauração aceita somente manifesto compatível e objetos com hash confirmado', async () => {
  const body = Buffer.from('{"student_id":"1","name":"O\'HARA"}\n');
  const manifest = {
    schemaVersion: 1,
    id: 'backup-test',
    tables: {
      students: { key: 'backups/2026-09-24/backup-test/students.jsonl.gz', rows: 1, sha256: hash(body) }
    }
  };
  const rows = await validateAndDecodeBackup(manifest, async (key) => {
    assert.equal(key, manifest.tables.students.key);
    return body;
  });

  assert.deepEqual(rows.students, [{ student_id: '1', name: "O'HARA" }]);
  const sql = buildRestoreSql(rows);
  assert.match(sql, /BEGIN IMMEDIATE;/);
  assert.match(sql, /DELETE FROM "students";/);
  assert.match(sql, /O''HARA/);
  assert.match(sql, /COMMIT;/);
});

test('restauração recusa hash, schema e tabela fora do contrato antes de produzir SQL', async () => {
  const validBody = Buffer.from('{"student_id":"1"}\n');
  const invalidHash = {
    schemaVersion: 1,
    id: 'backup-test',
    tables: { students: { key: 'x', rows: 1, sha256: '0'.repeat(64) } }
  };
  await assert.rejects(() => validateAndDecodeBackup(invalidHash, async () => validBody), /Hash inválido/);

  await assert.rejects(() => validateAndDecodeBackup({ schemaVersion: 2, tables: {} }, async () => validBody), /schema incompatível/);

  await assert.rejects(() => validateAndDecodeBackup({
    schemaVersion: 1,
    tables: { invasora: { key: 'x', rows: 0, sha256: hash(Buffer.alloc(0)) } }
  }, async () => Buffer.alloc(0)), /Tabela de backup inválida/);
});

test('restauração só permite aplicar SQL ao banco confirmado explicitamente', () => {
  assert.equal(assertApplyAllowed([]), false);
  assert.throws(() => assertApplyAllowed(['--apply', '--confirm-database', 'outro-banco']), /Confirmação obrigatória/);
  assert.equal(assertApplyAllowed(['--apply', '--confirm-database', 'xsteam-gestao']), true);
});
