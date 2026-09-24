const test = require('node:test');
const assert = require('node:assert/strict');

function dbWith(churns) {
  return { prepare: () => ({ bind: () => ({ all: async () => ({ results: churns }) }) }) };
}

test('análise de churn organiza meses, semanas e cobertura de retenção', async () => {
  const { analyzeChurn } = await import('../../worker/src/services/churn-analysis-service.js');
  const analysis = await analyzeChurn(dbWith([
    { official_exit_on: '2026-08-03', manual_exit_reason: 'Mudança', responsible_professional: 'Ruan', manual_retention_action: '' },
    { official_exit_on: '2026-08-17', manual_exit_reason: 'Mudança', responsible_professional: 'Ruan', manual_retention_action: 'Ligação' },
    { official_exit_on: '2026-09-01', manual_exit_reason: 'Preço', responsible_professional: 'Elohim', manual_retention_action: 'Proposta' }
  ]), { mesInicio: '2026-08', mesFim: '2026-09', semanaInicio: '03/08/2026', semanaFim: '06/09/2026' });
  assert.deepEqual(analysis.mensal.map((item) => [item.chave, item.valor]), [['2026-08', 2], ['2026-09', 1]]);
  assert.deepEqual(analysis.semanal.map((item) => item.valor), [1, 0, 1, 0, 1]);
  assert.deepEqual(analysis.diagnosticos.motivos, [{ chave: 'Mudança', valor: 2 }, { chave: 'Preço', valor: 1 }]);
  assert.deepEqual(analysis.diagnosticos.retencao, { comAcao: 2, semAcao: 1, coberturaPercentual: 67 });
});
