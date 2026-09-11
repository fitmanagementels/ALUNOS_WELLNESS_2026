const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas([
  'apps-script/00_Config.gs',
  'apps-script/21_TransicaoChurns.gs'
]);

function json(value) { return JSON.parse(JSON.stringify(value)); }

const fonteOficialTeste = [
  ['', 'Código', 'Cliente', 'Contrato', 'Valor', 'Início', 'Vencimento', 'Professor', 'Modalidade'],
  ['', '42.0', 'NOME OFICIAL', '2X', 765, '01/06/2026', '30/07/2026', 'Ruan', 'Musculação']
];

class RangeMock {
  constructor(sheet, row, column, rows, columns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rows = rows;
    this.columns = columns;
  }
  getValues() {
    return this.sheet.values.slice(this.row - 1, this.row - 1 + this.rows)
      .map(line => line.slice(this.column - 1, this.column - 1 + this.columns));
  }
  setValues(values) {
    values.forEach((line, lineIndex) => {
      const target = this.row - 1 + lineIndex;
      if (!this.sheet.values[target]) this.sheet.values[target] = [];
      line.forEach((value, valueIndex) => { this.sheet.values[target][this.column - 1 + valueIndex] = value; });
    });
    return this;
  }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  createFilter() { this.sheet.filterCreated = true; return this; }
}

class SheetMock {
  constructor(values = []) { this.values = values.map(line => line.slice()); }
  getLastRow() { return this.values.length; }
  getRange(row, column, rows = 1, columns = 1) { return new RangeMock(this, row, column, rows, columns); }
  clearContents() { this.values = []; return this; }
  setFrozenRows(value) { this.frozenRows = value; return this; }
  getFilter() { return null; }
}

function criarRuntimePrevia(sourceId) {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const sheets = {
    FLUXO_CHURNS: new SheetMock([
      Array.from(config.cabecalhos.fluxoChurns),
      ['old-1', '42', 'NOME ANTIGO', '85999999999', '01/01/2026', 'Elohim', '', 'Horário', '', '', '', '']
    ])
  };
  const properties = new Map();
  if (sourceId) properties.set('tecnofit.fluxo.churns.fonte_oficial_id', sourceId);
  const gas = loadGas([
    'apps-script/00_Config.gs',
    'apps-script/11_DashboardRepositorio.gs',
    'apps-script/21_TransicaoChurns.gs'
  ], {
    SpreadsheetApp: {
      openById: () => ({
        getSheetByName: name => sheets[name] || null,
        insertSheet: name => (sheets[name] = new SheetMock())
      }),
      flush() {}
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties.get(key) || null,
      setProperty: (key, value) => properties.set(key, value)
    }) },
    DriveApp: { getFileById: id => ({ getBlob: () => ({ id }) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    parseTabelaXlsx: () => fonteOficialTeste
  });
  return { gas, sheets, properties };
}

test('consolida cada ID pelo maior vencimento oficial', () => {
  const previa = gas.construirPreviaTransicaoChurns_([
    ['', 'Código', 'Cliente', 'Contrato', 'Valor', 'Início', 'Vencimento', 'Professor', 'Modalidade'],
    ['', '42.0', 'ALUNO A', '2X', 765, '01/06/2026', '30/06/2026', 'Xico', 'Musculação'],
    ['', '42', 'ALUNO A', '3X', 1000, '01/07/2026', '30/07/2026', 'Ruan', 'Musculação']
  ], []);

  assert.equal(previa.linhas.length, 1);
  assert.equal(previa.linhas[0].grupo, 'Migrará sem dados manuais anteriores');
  assert.equal(previa.linhas[0].alunoId, '42');
  assert.equal(previa.linhas[0].planoOficial, '3X');
  assert.equal(previa.linhas[0].vencimentoOficial, '30/07/2026');
});

test('preserva somente telefone e campos manuais pelo ID', () => {
  const antiga = [[
    'old-1', '42', 'NOME ANTIGO', '85999999999', '01/01/2026',
    'Elohim', 'Xico', 'Horário', 'Mudança de rotina', 'Ligação feita', 'criado', 'atualizado'
  ]];
  const previa = gas.construirPreviaTransicaoChurns_(fonteOficialTeste, antiga);
  const linha = previa.linhas[0];

  assert.equal(linha.grupo, 'Migrará com dados manuais preservados');
  assert.equal(linha.nomeOficial, 'NOME OFICIAL');
  assert.equal(linha.nomeAnterior, 'NOME ANTIGO');
  assert.equal(linha.vencimentoOficial, '30/07/2026');
  assert.equal(linha.telefonePreservado, '85999999999');
  assert.equal(linha.profissionalResponsavel, 'Elohim');
  assert.equal(linha.ultimoPersonal, 'Xico');
  assert.equal(linha.motivoSaida, 'Horário');
  assert.equal(linha.sinaisContexto, 'Mudança de rotina');
  assert.equal(linha.acaoRetencao, 'Ligação feita');
});

test('classifica antigo sem fonte e novo sem dados manuais', () => {
  const fonteComIdNovo = [
    ['Código', 'Cliente', 'Contrato', 'Valor', 'Início', 'Vencimento', 'Professor', 'Modalidade'],
    ['77', 'NOME NOVO', '2X', 765, '01/06/2026', '30/06/2026', 'Ruan', 'Musculação']
  ];
  const churnsComIdLegado = [[
    'old-99', '99', 'NOME LEGADO', '', '01/01/2026', '', '', 'Motivo', '', '', '', ''
  ]];
  const previa = gas.construirPreviaTransicaoChurns_(fonteComIdNovo, churnsComIdLegado);

  assert.deepEqual(json(previa.resumo), {
    migraraComDadosManuais: 0,
    migraraSemDadosManuais: 1,
    antigoSemCorrespondenteOficial: 1,
    divergenciaParaRevisao: 0
  });
  assert.deepEqual(json(previa.linhas.map(linha => linha.grupo)), [
    'Migrará sem dados manuais anteriores',
    'Registro antigo sem correspondente oficial'
  ]);
});

test('não transfere automaticamente em empate oficial ou duplicidade manual', () => {
  const fonteComEmpate = [
    ['Código', 'Cliente', 'Contrato', 'Valor', 'Início', 'Vencimento', 'Professor', 'Modalidade'],
    ['42', 'NOME OFICIAL', '2X', 765, '01/06/2026', '30/07/2026', 'Ruan', 'Musculação'],
    ['42', 'NOME OFICIAL', '3X', 1000, '01/07/2026', '30/07/2026', 'Xico', 'Musculação'],
    ['43', 'OUTRO OFICIAL', '2X', 765, '01/06/2026', '30/07/2026', 'Ruan', 'Musculação']
  ];
  const churnsComDoisManuaisMesmoId = [
    ['old-1', '43', 'OUTRO ANTIGO', '', '01/01/2026', 'Elohim', '', '', '', '', '', ''],
    ['old-2', '43', 'OUTRO ANTIGO', '', '02/01/2026', '', 'Xico', '', '', '', '', '']
  ];
  const previa = gas.construirPreviaTransicaoChurns_(fonteComEmpate, churnsComDoisManuaisMesmoId);
  const divergencias = previa.linhas.filter(linha => linha.grupo === 'Divergência para revisão');

  assert.equal(divergencias.length, 2);
  assert.deepEqual(json(divergencias.map(linha => linha.detalheRevisao).sort()), [
    'Empate no maior vencimento oficial',
    'Mais de um registro manual para o ID'
  ]);
  assert.ok(divergencias.every(linha => !linha.telefonePreservado && !linha.motivoSaida));
});

test('gerarPreviaTransicaoChurns grava somente a aba de conferência', () => {
  const { gas, sheets } = criarRuntimePrevia('fonte-oficial');
  const antes = JSON.stringify(sheets.FLUXO_CHURNS.values);
  const resultado = gas.gerarPreviaTransicaoChurns();

  assert.equal(resultado.aba, 'PREVIA_TRANSICAO_CHURNS');
  assert.equal(JSON.stringify(sheets.FLUXO_CHURNS.values), antes);
  assert.equal(sheets.PREVIA_TRANSICAO_CHURNS.values[0][0], 'grupo');
  assert.equal(sheets.PREVIA_TRANSICAO_CHURNS.frozenRows, 1);
  assert.equal(sheets.PREVIA_TRANSICAO_CHURNS.filterCreated, true);
});

test('recusa gerar prévia sem fonte configurada', () => {
  const { gas } = criarRuntimePrevia('');
  assert.throws(() => gas.gerarPreviaTransicaoChurns(), /Fonte oficial de Churns não configurada/);
});
