const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

function setup(additions = {}) {
  return loadGas([
    'apps-script/00_Config.gs',
    'apps-script/16_DashboardExecutionApi.gs',
    'apps-script/17_DashboardPublicWebApi.gs'
  ], {
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'chave-teste' }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: content => ({ content, setMimeType() { return this; } })
    },
    console: { error() {} },
    obterBootstrapDashboard: () => ({ versao: 'v1' }),
    ...additions
  });
}

test('adaptador público encaminha somente pedido autenticado para a API interna', () => {
  const gas = setup();
  const output = gas.responderApiPublicaDashboard_({
    postData: { contents: JSON.stringify({ sharedSecret: 'chave-teste', action: 'bootstrap', payload: {} }) }
  });
  assert.deepEqual(JSON.parse(output.content), {
    ok: true,
    data: { versao: 'v1' },
    meta: { versao: 'v1' }
  });
});

test('adaptador público oculta chave inválida e JSON malformado', () => {
  const gas = setup();
  const semChave = gas.responderApiPublicaDashboard_({ postData: { contents: '{}' } });
  const invalido = gas.responderApiPublicaDashboard_({ postData: { contents: '{' } });
  assert.equal(JSON.parse(semChave.content).error.code, 'UNAUTHORIZED');
  assert.equal(JSON.parse(invalido.content).error.code, 'VALIDATION_ERROR');
  assert.doesNotMatch(semChave.content, /chave-teste/);
});

test('adaptador público não aceita um segredo ausente na configuração', () => {
  const gas = setup({
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => '' }) }
  });
  const output = gas.responderApiPublicaDashboard_({
    postData: { contents: JSON.stringify({ sharedSecret: '', action: 'bootstrap', payload: {} }) }
  });
  assert.equal(JSON.parse(output.content).error.code, 'UNAUTHORIZED');
});
