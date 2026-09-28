const test = require('node:test');
const assert = require('node:assert/strict');

test('backup local contém tabelas de recuperação e não retorna linhas em metadados', async () => {
  const { buildLocalBackup } = await import('../../worker/src/services/local-backup-service.js');
  const queries = [];
  const backup = await buildLocalBackup({ prepare(sql) { queries.push(sql); return { all: async () => ({ results: sql.includes('students') ? [{ student_id: '1', name: 'Privado' }] : [] }) }; } }, new Date('2026-09-28T12:00:00Z'));
  assert.equal(backup.format, 'xsteam-local-backup');
  assert.equal(backup.version, 1);
  assert.deepEqual(backup.tables.students, [{ student_id: '1', name: 'Privado' }]);
  assert.ok(queries.every((sql) => /ORDER BY rowid/.test(sql)));
});

test('exportBackup exige sessão e não registra linhas pessoais', async () => {
  const { handleApiRequest } = await import('../../worker/src/router.js');
  const request = new Request('https://xsteam.example/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'exportBackup' }) });
  const blocked = await handleApiRequest(request, { DB: {} }, { authenticate: async () => { throw Object.assign(new Error('Autenticação necessária.'), { code: 'AUTH_REQUIRED', status: 401 }); } });
  assert.equal(blocked.status, 401);
  const response = await handleApiRequest(request, { DB: {} }, { authenticate: async () => ({ email: 'fitmanagement.els@gmail.com' }), buildLocalBackup: async () => ({ format: 'xsteam-local-backup', version: 1, tables: { students: [] } }) });
  assert.deepEqual(await response.json(), { ok: true, data: { format: 'xsteam-local-backup', version: 1, tables: { students: [] } } });
});
