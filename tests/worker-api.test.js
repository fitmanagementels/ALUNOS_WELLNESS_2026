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
