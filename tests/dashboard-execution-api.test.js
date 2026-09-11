const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

function setup(additions = {}) {
  return loadGas(['apps-script/00_Config.gs', 'apps-script/16_DashboardExecutionApi.gs'], {
    console: { error() {} },
    ...additions
  });
}

test('API aceita somente as quatro ações do PWA', () => {
  const gas = setup({
    obterBootstrapDashboard: () => ({ versao: 'v1' }),
    obterVersaoDashboard: () => ({ versao: 'v2' }),
    salvarMutacoesDashboard: value => ({ versao: 'v3', value }),
    obterAnaliseChurnsDashboard: value => ({ value })
  });
  assert.deepEqual(JSON.parse(JSON.stringify(gas.executarApiDashboard({ action: 'bootstrap', payload: {} }))), {
    ok: true,
    data: { versao: 'v1' },
    meta: { versao: 'v1' }
  });
  assert.equal(gas.executarApiDashboard({ action: 'executarImportacao', payload: {} }).error.code, 'VALIDATION_ERROR');
});

test('API não revela detalhes internos em falhas', () => {
  const gas = setup({ obterBootstrapDashboard: () => { throw new Error('telefone 85999999999'); } });
  const resposta = gas.executarApiDashboard({ action: 'bootstrap', payload: {} });
  assert.deepEqual(JSON.parse(JSON.stringify(resposta)), {
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir esta solicitação.' }
  });
});
