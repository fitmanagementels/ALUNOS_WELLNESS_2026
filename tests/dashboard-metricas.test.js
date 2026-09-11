const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas([
  'apps-script/00_Config.gs',
  'apps-script/09_DashboardMetricas.gs'
]);

const hoje = new Date(2026, 6, 11, 12);

test('classifica vencimento nos limites de 7 e 30 dias', () => {
  assert.equal(gas.classificarVencimento_(new Date(2026, 6, 10, 12), hoje), 'vencido');
  assert.equal(gas.classificarVencimento_(new Date(2026, 6, 18, 12), hoje), 'ate7');
  assert.equal(gas.classificarVencimento_(new Date(2026, 7, 10, 12), hoje), 'ate30');
  assert.equal(gas.classificarVencimento_(new Date(2026, 7, 11, 12), hoje), 'futuro');
});

test('classifica ficha e avaliação com limite estritamente excedido', () => {
  assert.equal(gas.classificarAtualizacao_('', hoje, 30), 'ausente');
  assert.equal(gas.classificarAtualizacao_(new Date(2026, 5, 11, 12), hoje, 30), 'atualizada');
  assert.equal(gas.classificarAtualizacao_(new Date(2026, 5, 10, 12), hoje, 30), 'desatualizada');
  assert.equal(gas.classificarAtualizacao_(new Date(2026, 3, 12, 12), hoje, 90), 'atualizada');
  assert.equal(gas.classificarAtualizacao_(new Date(2026, 3, 11, 12), hoje, 90), 'desatualizada');
});

test('deduplica pelo primeiro valor não vazio da chave', () => {
  const rows = [{ id: '1', nome: 'A' }, { id: '1', nome: 'A2' }, { id: '2', nome: 'B' }];
  assert.deepEqual(Array.from(gas.unicosPor_(rows, 'id'), row => row.nome), ['A', 'B']);
});

test('deduplica _chave_contrato sem colidir com propriedades herdadas', () => {
  const rows = [
    { _chave_contrato: '__proto__', nome: 'Proto 1' },
    { _chave_contrato: '__proto__', nome: 'Proto 2' },
    { _chave_contrato: 'toString', nome: 'ToString 1' },
    { _chave_contrato: 'toString', nome: 'ToString 2' },
    { _chave_contrato: 'comum', nome: 'Comum 1' },
    { _chave_contrato: 'comum', nome: 'Comum 2' }
  ];

  assert.deepEqual(
    Array.from(gas.unicosPor_(rows, '_chave_contrato'), row => row.nome),
    ['Proto 1', 'ToString 1', 'Comum 1']
  );
});

test('prescrição muda de verde para laranja somente após o dia 90', () => {
  const regras = { laranja: 90, vermelho: 180, roxo: 270 };
  assert.deepEqual(
    JSON.parse(JSON.stringify(gas.classificarPrescricao_(new Date(2026, 3, 12, 12), hoje, regras))),
    { situacao: 'verde', dias: 90, prioridade: 4 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(gas.classificarPrescricao_(new Date(2026, 3, 11, 12), hoje, regras))),
    { situacao: 'laranja', dias: 91, prioridade: 3 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(gas.classificarPrescricao_('', hoje, regras))),
    { situacao: 'sem_ficha', dias: null, prioridade: 0 }
  );
});

test('avaliação respeita as quatro fronteiras e ausência tem prioridade máxima', () => {
  const regras = { laranja: 90, vermelho: 120, roxo: 180, critico: 270 };
  assert.equal(gas.classificarAvaliacao_(new Date(2026, 3, 12, 12), hoje, regras).situacao, 'verde');
  assert.equal(gas.classificarAvaliacao_(new Date(2026, 3, 11, 12), hoje, regras).situacao, 'laranja');
  assert.equal(gas.classificarAvaliacao_(new Date(2026, 2, 12, 12), hoje, regras).situacao, 'vermelho');
  assert.equal(gas.classificarAvaliacao_(new Date(2026, 0, 11, 12), hoje, regras).situacao, 'roxo');
  assert.equal(gas.classificarAvaliacao_(new Date(2025, 9, 13, 12), hoje, regras).situacao, 'falha_critica');
  assert.deepEqual(
    JSON.parse(JSON.stringify(gas.classificarAvaliacao_('', hoje, regras))),
    { situacao: 'sem_avaliacao', dias: null, prioridade: 0 }
  );
});

test('valor por aula usa frequência semanal vezes 4,33', () => {
  assert.equal(gas.calcularValorPorAula_(433, '2X'), 50);
  assert.equal(gas.calcularValorPorAula_(433, 'sem frequência'), 0);
});
