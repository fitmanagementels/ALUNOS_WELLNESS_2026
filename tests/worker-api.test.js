const test = require('node:test');
const assert = require('node:assert/strict');

const env = {
  APPS_SCRIPT_WEBAPP_URL: 'https://script.google.com/macros/s/test/exec',
  APPS_SCRIPT_SHARED_SECRET: 'segredo-interno'
};

async function carregarWorker() {
  return import('../worker/src/index.js');
}

function pedido(action, payload, origin = 'https://fitmanagementels.github.io') {
  return new Request('https://api.example/api', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.1' },
    body: JSON.stringify({ action, payload: payload || {} })
  });
}

test('worker responde CORS e encaminha ação aceita sem expor o segredo', async () => {
  const worker = await carregarWorker();
  let upstreamBody = '';
  const response = await worker.handleRequest(pedido('bootstrap'), env, {
    fetch: async (_url, init) => {
      upstreamBody = init.body;
      return new Response(JSON.stringify({ ok: true, data: { versao: 'v1' }, meta: { versao: 'v1' } }));
    }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://fitmanagementels.github.io');
  assert.equal(JSON.parse(upstreamBody).sharedSecret, 'segredo-interno');
  assert.doesNotMatch(await response.text(), /segredo-interno/);
});

test('worker rejeita origem, método e ações fora do contrato', async () => {
  const worker = await carregarWorker();
  const origem = await worker.handleRequest(pedido('bootstrap', {}, 'https://example.com'), env);
  const metodo = await worker.handleRequest(new Request('https://api.example/api', { method: 'GET' }), env);
  const acao = await worker.handleRequest(pedido('importar'), env);
  assert.equal(origem.status, 403);
  assert.equal(metodo.status, 405);
  assert.equal(acao.status, 400);
});

test('worker converte resposta não JSON do Apps Script em erro seguro', async () => {
  const worker = await carregarWorker();
  const logs = [];
  const response = await worker.handleRequest(pedido('versao'), env, {
    fetch: async () => new Response('<html>erro interno</html>', {
      status: 500,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    }),
    logger: { error: event => logs.push(event) }
  });
  const body = await response.json();
  assert.equal(response.status, 502);
  assert.equal(body.error.code, 'UPSTREAM_ERROR');
  assert.doesNotMatch(JSON.stringify(body), /html|segredo/i);
  assert.deepEqual(logs, [{
    event: 'apps_script_upstream_error',
    reason: 'invalid_json',
    upstreamStatus: 500,
    contentType: 'text/html; charset=utf-8'
  }]);
  assert.doesNotMatch(JSON.stringify(logs), /erro interno|segredo-interno|script\.google/i);
});

test('worker atende preflight do navegador sem chamar o Apps Script', async () => {
  const worker = await carregarWorker();
  const response = await worker.handleRequest(new Request('https://api.example/api', {
    method: 'OPTIONS', headers: { origin: 'https://fitmanagementels.github.io' }
  }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
});
