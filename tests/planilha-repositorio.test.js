const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

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
      .map(linha => linha.slice(this.column - 1, this.column - 1 + this.columns));
  }
  setValues(values) {
    this.sheet.calls.push(['setValues', this.row, this.column, values]);
    return this;
  }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  setNumberFormat(format) {
    this.sheet.calls.push(['format', this.row, this.column, this.rows, this.columns, format]);
    return this;
  }
  createFilter() { this.sheet.calls.push(['filter']); return this; }
  protect() {
    return { setDescription() { return this; }, setWarningOnly() { return this; } };
  }
}

class SheetMock {
  constructor(name, values = [[]]) {
    this.name = name;
    this.values = values;
    this.calls = [];
  }
  getName() { return this.name; }
  getLastRow() { return this.values.length; }
  getDataRange() { return { getValues: () => this.values.map(row => row.slice()) }; }
  getRange(row, column, rows = 1, columns = 1) { return new RangeMock(this, row, column, rows, columns); }
  clearContents() { this.calls.push(['clear']); return this; }
  setFrozenRows(rows) { this.calls.push(['freeze', rows]); return this; }
  getFilter() { return null; }
  hideColumns(column) { this.calls.push(['hide', column]); }
  getMaxColumns() { return 26; }
  getProtections() { return []; }
}

function createSpreadsheet() {
  const names = [
    'BASE_ALUNOS', 'CONTRATOS', 'VISAO_MESTRE', 'BASE_PERMANENCIA',
    'HISTORICO_PERMANENCIA', 'IMPORTACOES'
  ];
  const sheets = Object.fromEntries(names.map(name => [name, new SheetMock(name, [[`old-${name}`]])]));
  return {
    sheets,
    getSheetByName: name => sheets[name] || null,
    insertSheet: name => (sheets[name] = new SheetMock(name)),
  };
}

function load(spreadsheet) {
  return loadGas([
    'apps-script/00_Config.gs',
    'apps-script/03_Permanencia.gs',
    'apps-script/04_PlanilhaRepositorio.gs'
  ], {
    SpreadsheetApp: {
      openById: () => spreadsheet,
      flush: () => {},
      ProtectionType: { RANGE: 'RANGE' }
    }
  });
}

test('valida todas as larguras antes de limpar as abas', () => {
  const spreadsheet = createSpreadsheet();
  const gas = load(spreadsheet);
  assert.throws(() => gas.substituirAbasGerenciadas({
    alunos: [['curta']], contratos: [], visaoMestre: [],
    basePermanencia: [], historicoPermanencia: []
  }), /largura inválida/);
  assert.equal(spreadsheet.sheets.BASE_ALUNOS.calls.some(call => call[0] === 'clear'), false);
});

test('substitui as cinco abas e oculta a chave técnica', () => {
  const spreadsheet = createSpreadsheet();
  const gas = load(spreadsheet);
  gas.substituirAbasGerenciadas({
    alunos: [['1', 'A', '', 'Ativo', '', '', '', 'exec']],
    contratos: [['key', '1', '2X - P - PERSONAL', '2X', 10, '', '', 'Ativo', 'P', 'MUSCULAÇÃO', 'exec']],
    visaoMestre: [['1', 'A', '', 'Ativo', '2X', 10, '', '', '', 'P', '', '', 'key']],
    basePermanencia: [],
    historicoPermanencia: []
  });
  assert.equal(spreadsheet.sheets.BASE_ALUNOS.calls.some(call => call[0] === 'clear'), true);
  assert.deepEqual(spreadsheet.sheets.VISAO_MESTRE.calls.find(call => call[0] === 'hide'), ['hide', 13]);
});

test('substitui e restaura as cinco abas gerenciadas', () => {
  const spreadsheet = createSpreadsheet();
  const gas = load(spreadsheet);
  const backup = gas.criarBackupAbasGerenciadas();
  gas.substituirAbasGerenciadas({
    alunos: [['1', 'A', '', 'Ativo', new Date(2024, 0, 1), '', '', 'exec']],
    contratos: [],
    visaoMestre: [],
    basePermanencia: [{
      id: '1', aluno: 'A', cliente_desde: new Date(2024, 0, 1), status_permanencia: 'Ativo',
      continuidade_meses_origem: 30, quantidade_contratos_origem: 3,
      primeira_observacao_em: '2026-08-07', ultima_observacao_em: '2026-08-07',
      presente_ultimo_lote: true, importacao_id: 'exec'
    }],
    historicoPermanencia: [{
      evento_id: 'e1', id: '1', data_referencia: '2026-08-07', tipo_evento: 'CARGA_INICIAL',
      campo: '', valor_anterior: '', valor_novo: '', importacao_id: 'exec', registrado_em: new Date()
    }]
  });
  assert.ok(spreadsheet.sheets.BASE_PERMANENCIA.calls.some(call => call[0] === 'clear'));
  assert.ok(spreadsheet.sheets.HISTORICO_PERMANENCIA.calls.some(call => call[0] === 'clear'));
  gas.restaurarBackupAbasGerenciadas(backup);
  assert.equal(spreadsheet.sheets.BASE_PERMANENCIA.calls.at(-1)[0], 'setValues');
});

test('backup e restauração preservam os valores anteriores', () => {
  const spreadsheet = createSpreadsheet();
  const gas = load(spreadsheet);
  const backup = gas.criarBackupAbasGerenciadas();
  gas.restaurarBackupAbasGerenciadas(backup);
  const restoreCall = spreadsheet.sheets.CONTRATOS.calls.find(call => call[0] === 'setValues');
  assert.equal(restoreCall[3][0][0], 'old-CONTRATOS');
});

test('garantirEstruturaPlanilha cria as abas de Fluxo sem limpar registros manuais', () => {
  const spreadsheet = createSpreadsheet();
  const manual = spreadsheet.insertSheet('FLUXO_LEADS');
  manual.values = [['registro manual']];
  const gas = load(spreadsheet);

  gas.garantirEstruturaPlanilha();

  assert.equal(manual.calls.some(call => call[0] === 'clear'), false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(manual.calls.find(call => call[0] === 'setValues')[3][0])),
    Array.from(gas.CONFIG.cabecalhos.fluxoLeads)
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(spreadsheet.sheets.FLUXO_CHURNS.calls.find(call => call[0] === 'setValues')[3][0])),
    Array.from(gas.CONFIG.cabecalhos.fluxoChurns)
  );
});
