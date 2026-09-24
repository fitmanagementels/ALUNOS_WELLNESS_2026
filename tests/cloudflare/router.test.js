const test = require('node:test');
const assert = require('node:assert/strict');

function request(action, payload) {
  return new Request('https://xsteam-gestao.example/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, payload: payload || {} })
  });
}

test('API do Worker autentica e entrega bootstrap sem proxy legado', async () => {
  const { handleApiRequest } = await import('../../worker/src/router.js');
  let authenticated = false;
  const response = await handleApiRequest(request('bootstrap'), { DB: {} }, {
    authenticate: async () => { authenticated = true; return { email: 'fitmanagement.els@gmail.com' }; },
    buildBootstrap: async () => ({ versao: 'importacao:7|config:7|fluxo:7', alunos: [] })
  });
  assert.equal(response.status, 200);
  assert.equal(authenticated, true);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: { versao: 'importacao:7|config:7|fluxo:7', alunos: [] },
    meta: { versao: 'importacao:7|config:7|fluxo:7' }
  });
});

test('API do Worker despacha gravação e análise para os serviços D1 autenticados', async () => {
  const { handleApiRequest } = await import('../../worker/src/router.js');
  const deps = {
    authenticate: async () => ({ email: 'fitmanagement.els@gmail.com' }),
    saveMutations: async (_db, actor, payload) => ({ actor: actor.email, requestId: payload.requestId }),
    analyzeChurn: async (_db, filters) => ({ filtros: filters, mensal: [] })
  };
  const saved = await handleApiRequest(request('salvarMutacoes', { requestId: 'r1', patches: [{ tipo: 'configDashboard', valores: {} }] }), { DB: {} }, deps);
  const analyzed = await handleApiRequest(request('analiseChurn', { mesInicio: '2026-09' }), { DB: {} }, deps);
  assert.deepEqual(await saved.json(), { ok: true, data: { actor: 'fitmanagement.els@gmail.com', requestId: 'r1' } });
  assert.deepEqual(await analyzed.json(), { ok: true, data: { filtros: { mesInicio: '2026-09' }, mensal: [] } });
});

test('API do Worker rejeita rota, método e ação antes de acessar dados', async () => {
  const { handleApiRequest } = await import('../../worker/src/router.js');
  const deps = { authenticate: async () => ({ email: 'fitmanagement.els@gmail.com' }) };
  const noRoute = await handleApiRequest(new Request('https://xsteam-gestao.example/nope'), { DB: {} }, deps);
  const get = await handleApiRequest(new Request('https://xsteam-gestao.example/api'), { DB: {} }, deps);
  const unknown = await handleApiRequest(request('upstreamGoogle'), { DB: {} }, deps);
  assert.equal(noRoute.status, 404);
  assert.equal(get.status, 405);
  assert.equal(unknown.status, 400);
});

test('falha da API registra contexto operacional sem e-mail do usuário', async () => {
  const { handleApiRequest } = await import('../../worker/src/router.js');
  const entries = [];
  const original = console.error;
  console.error = (entry) => entries.push(entry);
  try {
    const response = await handleApiRequest(request('bootstrap'), { DB: {} }, {
      authenticate: async () => ({ email: 'fitmanagement.els@gmail.com' }),
      buildBootstrap: async () => { throw Object.assign(new Error('falhou'), { code: 'D1_ERROR' }); }
    });
    assert.equal(response.status, 503);
  } finally {
    console.error = original;
  }
  assert.deepEqual(entries, [{ event: 'dashboard_api_error', action: 'bootstrap', code: 'D1_ERROR' }]);
});
