const test = require('node:test');
const assert = require('node:assert/strict');

test('backup pagina tabelas, grava manifesto por último e não inclui linhas no retorno', async () => {
  const { createBackup } = await import('../../worker/src/services/backup-service.js');
  const writes = [];
  const db = {
    prepare(sql) {
      return { bind(limit, offset) { return { all: async () => ({ results: offset === 0 ? [{ student_id: '1', name: 'PRIVADO' }] : [] }) }; } };
    }
  };
  const files = { put: async (key, body) => { writes.push({ key, body }); } };
  const result = await createBackup(db, files, new Date('2026-09-24T12:00:00.000Z'), { tables: ['students'], pageSize: 1, id: 'backup-test' });

  assert.equal(result.id, 'backup-test');
  assert.equal(result.tables.students.rows, 1);
  assert.equal(result.tables.students.key, 'backups/2026-09-24/backup-test/students.jsonl.gz');
  assert.equal(writes.at(-1).key, 'backups/2026-09-24/backup-test/manifest.json');
  assert.equal(JSON.stringify(result).includes('PRIVADO'), false);
});

test('backup não publica manifesto quando um objeto de dados falha', async () => {
  const { createBackup } = await import('../../worker/src/services/backup-service.js');
  const db = { prepare() { return { bind() { return { all: async () => ({ results: [{ student_id: '1' }] }) }; } }; } };
  const writes = [];
  const files = { put: async (key) => { writes.push(key); throw new Error('r2 indisponível'); } };
  await assert.rejects(() => createBackup(db, files, new Date('2026-09-24T12:00:00.000Z'), { tables: ['students'], id: 'backup-fail' }), /r2 indisponível/);
  assert.equal(writes.some(key => key.endsWith('/manifest.json')), false);
});
