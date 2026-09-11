const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas([
  'apps-script/01_Normalizacao.gs',
  'apps-script/03_Permanencia.gs'
]);

function source(id, date, status = 'Ativo', contracts = '1') {
  return {
    codigo: id,
    cliente: `ALUNO ${id}`,
    'cliente desde': date,
    'status atual': status,
    'continuidade (meses)': '12',
    contratos: contracts
  };
}

function context(overrides = {}) {
  return {
    dataReferencia: '2026-08-21', revisao: '01', importacaoId: 'exec-1',
    registradoEm: new Date(2026, 7, 21, 12), cargaInicial: false,
    ...overrides
  };
}

test('carga inicial cria estado e evento por ID', () => {
  const result = gas.construirAtualizacaoPermanencia_(
    [source('100', '10/01/2024'), source('101', '15/05/2025', 'Cancelado')],
    [], [], context({ cargaInicial: true })
  );
  assert.equal(result.base.length, 2);
  assert.deepEqual(result.historico.map(item => item.tipo_evento), ['CARGA_INICIAL', 'CARGA_INICIAL']);
});

test('preserva data menor, registra correção anterior e não aceita data posterior', () => {
  const previous = [{
    id: '100', aluno: 'ALUNO 100', cliente_desde: new Date(2024, 0, 10, 12),
    status_permanencia: 'Ativo', continuidade_meses_origem: 12,
    quantidade_contratos_origem: 1, primeira_observacao_em: '2026-08-07',
    ultima_observacao_em: '2026-08-07', presente_ultimo_lote: true, importacao_id: 'old'
  }];
  const later = gas.construirAtualizacaoPermanencia_(
    [source('100', '10/03/2024')], previous, [], context()
  );
  assert.equal(gas.formatarDataIso(later.base[0].cliente_desde), '2024-01-10');
  assert.match(later.avisos.join(' | '), /data posterior preservada/);

  const earlier = gas.construirAtualizacaoPermanencia_(
    [source('100', '10/12/2023')], previous, [], context({ revisao: '02' })
  );
  assert.equal(gas.formatarDataIso(earlier.base[0].cliente_desde), '2023-12-10');
  assert.equal(earlier.historico[0].tipo_evento, 'CORRECAO_CLIENTE_DESDE');
});

test('marca ausência sem apagar e registra reaparecimento', () => {
  const first = gas.construirAtualizacaoPermanencia_(
    [source('100', '10/01/2024')], [], [], context({ cargaInicial: true })
  );
  const missing = gas.construirAtualizacaoPermanencia_(
    [], first.base, first.historico, context({ revisao: '02', permitirLoteVazioEmTeste: true })
  );
  assert.equal(missing.base[0].presente_ultimo_lote, false);
  assert.equal(missing.historico.at(-1).tipo_evento, 'AUSENTE_NO_LOTE');
  const returned = gas.construirAtualizacaoPermanencia_(
    [source('100', '10/01/2024')], missing.base, missing.historico,
    context({ revisao: '03' })
  );
  assert.equal(returned.historico.at(-1).tipo_evento, 'REAPARECIMENTO');
});

test('bloqueia duplicidade, queda superior a vinte por cento e filtro apenas de ativos', () => {
  assert.throws(
    () => gas.construirAtualizacaoPermanencia_([source('100', '10/01/2024'), source('100', '10/01/2024')], [], [], context()),
    /Código duplicado/
  );
  const previous = Array.from({ length: 10 }, (_, index) => ({
    id: String(index + 1), aluno: `ALUNO ${index + 1}`, cliente_desde: new Date(2024, 0, 1, 12),
    status_permanencia: index === 0 ? 'Cancelado' : 'Ativo', presente_ultimo_lote: true
  }));
  assert.throws(
    () => gas.construirAtualizacaoPermanencia_(previous.slice(0, 7).map(item => source(item.id, '01/01/2024')), previous, [], context()),
    /redução superior a 20%/
  );
  assert.throws(
    () => gas.construirAtualizacaoPermanencia_(previous.map(item => source(item.id, '01/01/2024', 'Ativo')), previous, [], context()),
    /somente ativos/
  );
});
