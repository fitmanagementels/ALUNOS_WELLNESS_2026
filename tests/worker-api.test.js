const test = require('node:test');
const assert = require('node:assert/strict');

async function worker() { return import('../worker/src/index.js'); }

test('Worker entrega API same-origin e os assets locais sem Apps Script', async () => {
  const app = await worker();
  const api = await app.handleRequest(new Request('https://xsteam-gestao.example/api', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'bootstrap' })
  }), { DB: {} }, {}, {
    authenticate: async () => ({ email: 'fitmanagement.els@gmail.com' }),
    buildBootstrap: async () => ({ versao: 'v1', alunos: [] })
  });
  const asset = await app.handleRequest(new Request('https://xsteam-gestao.example/index.html'), {
    ASSETS: { fetch: async (request) => new Response(`asset:${new URL(request.url).pathname}`) }
  });
  assert.deepEqual(await api.json(), { ok: true, data: { versao: 'v1', alunos: [] }, meta: { versao: 'v1' } });
  assert.equal(await asset.text(), 'asset:/index.html');
});

test('Worker não mascara falta de assets como acesso à API', async () => {
  const app = await worker();
  const response = await app.handleRequest(new Request('https://xsteam-gestao.example/nope'), {}, {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'ASSETS_UNAVAILABLE');
});

test('agendamento semanal envia a criação de backup para o contexto sem bloquear requisições', async () => {
  const app = await worker();
  let waited = false;
  let received;
  await app.handleScheduled({ scheduledTime: Date.parse('2026-09-28T06:00:00.000Z') }, { DB: {}, FILES: {} }, {
    waitUntil(promise) { waited = true; return promise; }
  }, { createBackup: async (db, files, now) => { received = { db, files, now: now.toISOString() }; } });
  assert.equal(waited, true);
  assert.deepEqual(received, { db: {}, files: {}, now: '2026-09-28T06:00:00.000Z' });
});
