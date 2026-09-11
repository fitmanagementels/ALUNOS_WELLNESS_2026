const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas([
  'apps-script/01_Normalizacao.gs',
  'apps-script/03_Permanencia.gs',
  'apps-script/03_Transformacao.gs',
  'apps-script/20_CargaInicialPermanencia.gs'
]);

function dependencies(overrides = {}) {
  const calls = [];
  return {
    calls,
    adquirirLock: () => ({ releaseLock: () => calls.push('release') }),
    gerarExecucaoId: () => 'initial-1',
    localizarArquivo: () => ({ id: 'drive-1', nome: 'permanencia_2026-08-07_r01.xls' }),
    lerArquivo: () => [{
      codigo: '100', cliente: 'ALUNO TESTE', 'cliente desde': '10/01/2024',
      'status atual': 'Ativo', 'continuidade (meses)': '30', contratos: '3'
    }],
    lerEstado: () => ({ base: [], historico: [] }),
    lerOperacional: () => ({
      alunos: [['100', 'ALUNO TESTE', '', 'Ativo', '', '', '', 'old']],
      contratos: [],
      visaoMestre: [['100', 'ALUNO TESTE', '', 'Ativo', '2X', 500, '', '', '', 'POLO', '', '', 'c1']]
    }),
    transformarPermanencia: gas.construirAtualizacaoPermanencia_,
    enriquecerOperacional: gas.enriquecerDadosOperacionaisComPermanencia_,
    backup: () => { calls.push('backup'); return { original: true }; },
    substituir: dados => {
      calls.push('replace');
      assert.ok(dados.basePermanencia.length >= 1);
      assert.equal(gas.formatarDataIso(dados.alunos[0][4]), '2024-01-10');
    },
    moverProcessado: () => calls.push('processed'),
    moverRejeitado: () => calls.push('rejected'),
    restaurar: () => calls.push('restore'),
    incrementarVersao: () => calls.push('version'),
    registrarSucesso: () => calls.push('log'),
    agora: () => new Date(2026, 7, 20, 12),
    ...overrides
  };
}

test('carga inicial lê um único arquivo, grava, arquiva e versiona', () => {
  const deps = dependencies();
  const result = gas.executarCargaInicialPermanenciaComDependencias_(deps);
  assert.equal(result.registros, 1);
  assert.equal(result.associadosOperacao, 1);
  assert.equal(result.somenteHistorico, 0);
  assert.deepEqual(deps.calls, ['backup', 'replace', 'processed', 'version', 'log', 'release']);
});

test('informa quantos clientes permanecem somente no histórico', () => {
  const deps = dependencies({
    lerArquivo: () => [
      {
        codigo: '100', cliente: 'ALUNO ATUAL', 'cliente desde': '10/01/2024',
        'status atual': 'Ativo', 'continuidade (meses)': '30', contratos: '3'
      },
      {
        codigo: '200', cliente: 'ALUNO HISTORICO', 'cliente desde': '10/01/2020',
        'status atual': 'Cancelado', 'continuidade (meses)': '10', contratos: '1'
      }
    ]
  });
  const result = gas.executarCargaInicialPermanenciaComDependencias_(deps);
  assert.equal(result.registros, 2);
  assert.equal(result.associadosOperacao, 1);
  assert.equal(result.somenteHistorico, 1);
});

test('recusa repetir carga quando a base já possui registros', () => {
  const deps = dependencies({ lerEstado: () => ({ base: [{ id: '100' }], historico: [] }) });
  assert.throws(
    () => gas.executarCargaInicialPermanenciaComDependencias_(deps),
    /já foi carregada/i
  );
  assert.deepEqual(deps.calls, ['release']);
});

test('recusa carga quando o arquivo inicial não está na entrada', () => {
  const deps = dependencies({ localizarArquivo: () => null });
  assert.throws(
    () => gas.executarCargaInicialPermanenciaComDependencias_(deps),
    /arquivo.*não encontrado/i
  );
  assert.deepEqual(deps.calls, ['release']);
});

test('restaura as cinco bases e rejeita o arquivo se o arquivamento falhar', () => {
  const deps = dependencies({ moverProcessado: () => { throw new Error('falha ao arquivar'); } });
  assert.throws(
    () => gas.executarCargaInicialPermanenciaComDependencias_(deps),
    /falha ao arquivar/
  );
  assert.deepEqual(deps.calls, ['backup', 'replace', 'restore', 'rejected', 'release']);
});
