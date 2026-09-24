const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { downloadBackup } = require('../../scripts/download-r2-backup');

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

test('download de backup busca manifesto e somente objetos do mesmo prefixo seguro', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'xsteam-download-'));
  const key = 'backups/2026-09-24/backup-id/manifest.json';
  const body = Buffer.from('{"student_id":"1"}\n');
  const manifest = JSON.stringify({ schemaVersion: 1, tables: {
    students: { key: 'backups/2026-09-24/backup-id/students.jsonl.gz', rows: 1, sha256: hash(body) }
  } });
  const requested = [];
  await downloadBackup({
    manifestKey: key,
    outputDirectory: folder,
    fetchObject: async (objectKey, destination) => {
      requested.push(objectKey);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, objectKey.endsWith('manifest.json') ? manifest : body);
    }
  });
  assert.deepEqual(requested, [key, 'backups/2026-09-24/backup-id/students.jsonl.gz']);
  assert.equal(fs.readFileSync(path.join(folder, key), 'utf8'), manifest);
});

test('download recusa objeto fora do prefixo do manifesto', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'xsteam-download-'));
  const key = 'backups/2026-09-24/backup-id/manifest.json';
  await assert.rejects(() => downloadBackup({
    manifestKey: key,
    outputDirectory: folder,
    fetchObject: async (objectKey, destination) => {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, objectKey.endsWith('manifest.json') ? JSON.stringify({ schemaVersion: 1, tables: {
        students: { key: 'backups/outra-data/outro-id/students.jsonl.gz', rows: 0, sha256: '0'.repeat(64) }
      } }) : '');
    }
  }), /prefixo/);
});
