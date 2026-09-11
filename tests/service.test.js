const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas(['apps-script/07_ImportacaoService.gs']);

function dependencies(overrides = {}) {
  const calls = [];
  return {
    calls,
    adquirirLock: () => ({ releaseLock: () => calls.push('release') }),
    gerarExecucaoId: () => 'exec-001',
    descobrirArquivos: () => [{ nome: 'fichas_2026-07-08_r01.xls' }],
    agruparLote: () => ({ dataReferencia: '2026-07-08', revisao: '01', arquivosPorTipo: {} }),
    iniciarLog: () => { calls.push('log-start'); return [2, 3, 4]; },
    verificarReprocessamento: () => calls.push('check'),
    lerTabelas: () => ({ vencimentos: [], fichas: [], avaliacao_fisica: [], permanencia: [], contagens: {} }),
    lerEstadoPermanencia: () => { calls.push('read-permanence-state'); return { base: [], historico: [] }; },
    transformarPermanencia: () => {
      calls.push('transform-permanence');
      return { base: [], historico: [], porId: {}, avisos: [] };
    },
    transformar: () => ({
      alunos: [['1']], contratos: [['c']], visaoMestre: [['v']],
      resumoAvisos: {}, avisos: []
    }),
    backup: () => { calls.push('backup'); return { original: true }; },
    substituir: () => calls.push('replace'),
    moverProcessados: () => calls.push('processed'),
    moverRejeitados: () => calls.push('rejected'),
    restaurar: () => calls.push('restore'),
    incrementarVersaoDashboard: () => calls.push('version'),
    finalizarLog: (_rows, result) => calls.push(`log-${result.status}`),
    agora: () => new Date(2026, 6, 10, 12),
    agoraIso: () => '2026-07-10T12:00:00-03:00',
    ...overrides
  };
}

test('executa substituição e arquivamento na ordem segura', () => {
  const deps = dependencies();
  const result = gas.executarImportacaoComDependencias_(deps);
  assert.equal(result.ok, true);
  assert.deepEqual(deps.calls, [
    'check', 'log-start', 'read-permanence-state', 'transform-permanence',
    'backup', 'replace', 'processed', 'version', 'log-SUCESSO', 'release'
  ]);
});

test('publica uma nova versão do dashboard somente depois que o lote foi arquivado', () => {
  const deps = dependencies({
    incrementarVersaoDashboard: () => deps.calls.push('version')
  });

  gas.executarImportacaoComDependencias_(deps);

  assert.deepEqual(deps.calls, [
    'check', 'log-start', 'read-permanence-state', 'transform-permanence',
    'backup', 'replace', 'processed', 'version', 'log-SUCESSO', 'release'
  ]);
});

test('restaura dados e rejeita lote quando falha após substituição', () => {
  const deps = dependencies({ moverProcessados: () => { throw new Error('falha ao mover'); } });
  assert.throws(() => gas.executarImportacaoComDependencias_(deps), /falha ao mover/);
  assert.deepEqual(deps.calls, [
    'check', 'log-start', 'read-permanence-state', 'transform-permanence',
    'backup', 'replace', 'restore', 'rejected', 'log-ERRO', 'release'
  ]);
});

test('não substitui a base quando a leitura XLSX falha', () => {
  const deps = dependencies({
    lerTabelas: () => { throw new Error('XLSX inválido: nenhuma worksheet encontrada.'); }
  });

  assert.throws(() => gas.executarImportacaoComDependencias_(deps), /XLSX inválido/);
  assert.deepEqual(deps.calls, ['check', 'log-start', 'rejected', 'log-ERRO', 'release']);
});

test('interrompe quando não consegue obter lock', () => {
  const deps = dependencies({ adquirirLock: () => { throw new Error('Já existe uma importação'); } });
  assert.throws(() => gas.executarImportacaoComDependencias_(deps), /Já existe uma importação/);
  assert.deepEqual(deps.calls, []);
});

test('libera o lock quando a geração do ID de execução falha', () => {
  const deps = dependencies({ gerarExecucaoId: () => { throw new Error('UUID indisponível'); } });
  assert.throws(() => gas.executarImportacaoComDependencias_(deps), /UUID indisponível/);
  assert.deepEqual(deps.calls, ['release']);
});

test('remove o POP reservado antes de agrupar os arquivos da importação', () => {
  let arquivosAgrupados = null;
  const deps = dependencies({
    descobrirArquivos: () => [
      { nome: 'LEIA-ME_POP_01_ENTRADA.pdf' },
      { nome: 'fichas_2026-07-08_r01.xls' },
      { nome: 'vencimentos_2026-07-08_r01.xls' },
      { nome: 'avaliacao_fisica_2026-07-08_r01.xls' },
      { nome: 'permanencia_2026-07-08_r01.xls' }
    ],
    filtrarArquivosEntrada: (arquivos) => arquivos.filter((arquivo) => arquivo.nome !== 'LEIA-ME_POP_01_ENTRADA.pdf'),
    agruparLote: (arquivos) => {
      arquivosAgrupados = arquivos;
      return { dataReferencia: '2026-07-08', revisao: '01', arquivosPorTipo: {}, arquivos: [] };
    }
  });

  gas.executarImportacaoComDependencias_(deps);

  assert.equal(arquivosAgrupados.length, 4);
});
