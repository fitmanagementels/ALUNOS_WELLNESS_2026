const test = require('node:test');
const assert = require('node:assert/strict');
const permanence = require('../pwa/js/permanencia.js');

const now = new Date(2026, 7, 20, 12);

test('calcula meses completos e rótulo sem arredondar para cima', () => {
  assert.equal(permanence.monthsCompleted('20/08/2026', now), 0);
  assert.equal(permanence.monthsCompleted('21/07/2026', now), 0);
  assert.equal(permanence.monthsCompleted('20/07/2026', now), 1);
  assert.equal(permanence.relationshipLabel(28), '2 anos e 4 meses');
});

test('classifica os cinco limites exatos', () => {
  assert.deepEqual([3, 4, 6, 7, 12, 13, 24, 25].map(permanence.relationshipBand), [
    'Até 3 meses', '4–6 meses', '4–6 meses', '7–12 meses',
    '7–12 meses', '13–24 meses', '13–24 meses', '25 meses ou mais'
  ]);
});

test('considera ativo, bloqueado e licença como matriculados', () => {
  assert.equal(permanence.isEnrolled('Ativo'), true);
  assert.equal(permanence.isEnrolled('Bloqueado'), true);
  assert.equal(permanence.isEnrolled('Em Licença'), true);
  assert.equal(permanence.isEnrolled('Cancelado'), false);
});

test('monta cobertura, mediana e retenção sem calcular valor monetário', () => {
  const result = permanence.buildAnalysis({
    permanence: [
      { id: '1', aluno: 'A', clienteDesde: '20/08/2024', status: 'Ativo', quantidadeContratos: 2 },
      { id: '2', aluno: 'B', clienteDesde: '20/08/2024', status: 'Cancelado', quantidadeContratos: 1 }
    ],
    currentStudents: [{ id: '1' }, { id: '2' }],
    contracts: [{ id: '1', contrato: '3X', valor: 900 }],
    events: []
  }, now);
  assert.equal(result.kpis.coveragePercent, 100);
  assert.equal(result.cohorts[0].observedRetentionPercent, 50);
  assert.equal('ltv' in result.kpis, false);
  assert.equal('revenue' in result.cohorts[0], false);
  assert.deepEqual(result.rows[0].packages, [{ name: '3X', value: 900 }]);
});

test('resume somente os eventos do lote mais recente e deduplica pacotes', () => {
  const result = permanence.buildAnalysis({
    permanence: [{ id: '1', aluno: 'A', clienteDesde: '20/08/2024', status: 'Ativo' }],
    currentStudents: [{ id: '1' }],
    contracts: [
      { chave: 'c1', id: '1', contrato: '3X', valor: 900 },
      { chave: 'c1', id: '1', contrato: '3X', valor: 900 }
    ],
    events: [
      { id: '1', dataReferencia: '07/08/2026', tipo: 'CARGA_INICIAL' },
      { id: '1', dataReferencia: '21/08/2026', tipo: 'NOVO_ALUNO' },
      { id: '2', dataReferencia: '21/08/2026', tipo: 'AUSENTE_NO_LOTE' },
      { id: '3', dataReferencia: '21/08/2026', tipo: 'ALTERACAO_STATUS' }
    ]
  }, now);
  assert.equal(result.kpis.newInLastBatch, 1);
  assert.equal(result.kpis.absentInLastBatch, 1);
  assert.equal(result.kpis.statusChangesInLastBatch, 1);
  assert.equal(result.rows[0].packages.length, 1);
});

test('preserva linhas históricas para abrir coortes de clientes fora do recorte atual', () => {
  const result = permanence.buildAnalysis({
    permanence: [
      { id: '1', aluno: 'ATUAL', clienteDesde: '10/01/2024', status: 'Ativo' },
      { id: '2', aluno: 'HISTORICO', clienteDesde: '10/01/2024', status: 'Cancelado' }
    ],
    currentStudents: [{ id: '1' }],
    contracts: [{ id: '1', contrato: '2X', valor: 500 }],
    events: []
  }, now);

  assert.deepEqual(result.rows.map(item => item.id), ['1']);
  assert.deepEqual(result.historicalRows.map(item => item.id).sort(), ['1', '2']);
  assert.equal(result.historicalRows.find(item => item.id === '2').packages.length, 0);
});
