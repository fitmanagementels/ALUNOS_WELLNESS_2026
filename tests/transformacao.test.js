const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas([
  'apps-script/01_Normalizacao.gs',
  'apps-script/02_ParserHtml.gs',
  'apps-script/03_Transformacao.gs'
]);

function parseFixture(file, headers) {
  const html = fs.readFileSync(`tests/fixtures/${file}`, 'utf8');
  return gas.tabelaParaObjetos(gas.parseTabelaHtml(html), headers);
}

function build() {
  return gas.construirDadosMestre(
    parseFixture('vencimentos.html', ['codigo', 'cliente', 'status cliente', 'contrato', 'valor', 'inicio', 'vencimento', 'status contrato', 'modalidade']),
    parseFixture('fichas.html', ['codigo', 'data inicio', 'contato']),
    parseFixture('avaliacao_fisica.html', ['codigo', 'data da avaliacao']),
    {},
    'exec-001'
  );
}

test('mantém uma linha por aluno e uma por contrato', () => {
  const result = build();
  assert.equal(result.alunos.length, 2);
  assert.equal(result.contratos.length, 3);
  assert.equal(result.visaoMestre.length, 3);
  assert.equal(result.visaoMestre.filter(row => row[0] === '100').length, 2);
});

test('preenche inicio_plano e visão mestre pela permanência sem mudar a população', () => {
  const permanencia = {
    '100': { cliente_desde: new Date(2024, 0, 10, 12) }
  };
  const result = gas.construirDadosMestre(
    parseFixture('vencimentos.html', ['codigo', 'cliente', 'status cliente', 'contrato', 'valor', 'inicio', 'vencimento', 'status contrato', 'modalidade']),
    parseFixture('fichas.html', ['codigo', 'data inicio', 'contato']),
    parseFixture('avaliacao_fisica.html', ['codigo', 'data da avaliacao']),
    permanencia,
    'exec-001'
  );
  assert.equal(result.alunos.length, 2);
  assert.equal(gas.formatarDataIso(result.alunos.find(row => row[0] === '100')[4]), '2024-01-10');
  assert.equal(gas.formatarDataIso(result.visaoMestre.find(row => row[0] === '100')[6]), '2024-01-10');
});

test('seleciona status e ficha mais recentes', () => {
  const result = build();
  const aluno = result.alunos.find(row => row[0] === '100');
  assert.equal(aluno[2], 'contato mais recente');
  assert.equal(aluno[3], 'Ativo');
  assert.equal(gas.formatarDataIso(aluno[5]), '2026-06-20');
});

test('mantém ausências vazias e resume avisos', () => {
  const result = build();
  const aluno = result.alunos.find(row => row[0] === '101');
  const contrato = result.contratos.find(row => row[1] === '101');
  assert.equal(aluno[2], '');
  assert.equal(aluno[5], '');
  assert.equal(contrato[3], '');
  assert.equal(contrato[8], '');
  assert.equal(result.resumoAvisos.semFicha, 1);
  assert.equal(result.resumoAvisos.contratoSemPadrao, 1);
});

test('rejeita chave técnica duplicada', () => {
  const vencimentos = parseFixture('vencimentos.html', ['codigo', 'cliente', 'status cliente', 'contrato', 'valor', 'inicio', 'vencimento', 'status contrato', 'modalidade']);
  assert.throws(
    () => gas.construirDadosMestre([vencimentos[0], vencimentos[0]], [], [], {}, 'exec-002'),
    /Chave de contrato duplicada/
  );
});
