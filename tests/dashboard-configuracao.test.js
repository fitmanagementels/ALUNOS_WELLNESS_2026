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
      .map(row => row.slice(this.column - 1, this.column - 1 + this.columns));
  }
  setValues(values) {
    this.sheet.writes.push({ row: this.row, column: this.column, values });
    values.forEach((source, rowIndex) => {
      const targetIndex = this.row - 1 + rowIndex;
      const target = this.sheet.values[targetIndex] || (this.sheet.values[targetIndex] = []);
      source.forEach((value, columnIndex) => {
        target[this.column - 1 + columnIndex] = value;
      });
    });
    return this;
  }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  protect() { return { setDescription() { return this; }, setWarningOnly() { return this; } }; }
}

class SheetMock {
  constructor(name, values = []) {
    this.name = name;
    this.values = values.map(row => row.slice());
    this.writes = [];
  }
  getMaxColumns() { return 20; }
  getLastRow() { return this.values.length; }
  getRange(row, column, rows = 1, columns = 1) { return new RangeMock(this, row, column, rows, columns); }
  getProtections() { return []; }
  setFrozenRows() { return this; }
}

test('inicializa as três tabelas persistentes sem alterar as abas do retrato importado', () => {
  const sheets = {};
  const spreadsheet = {
    getSheetByName: name => sheets[name] || null,
    insertSheet(name) {
      sheets[name] = new SheetMock(name);
      return sheets[name];
    }
  };
  const gas = loadGas([
    'apps-script/00_Config.gs',
    'apps-script/18_DashboardPerfisAlunos.gs',
    'apps-script/13_DashboardConfiguracao.gs'
  ], {
    SpreadsheetApp: { ProtectionType: { RANGE: 'RANGE' }, flush() {} }
  });

  gas.garantirConfiguracoesDashboardNaPlanilha_(spreadsheet);

  assert.deepEqual(Object.keys(sheets).sort(), [
    'CONFIG_ALERTAS', 'CONFIG_DASHBOARD', 'CONFIG_PERFIS_ALUNOS',
    'GESTAO_PAGAMENTOS', 'PERFIS_ALUNOS'
  ]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(sheets.CONFIG_ALERTAS.writes[0].values[0])),
    ['tipo', 'chave', 'ativo', 'ordem', 'valor', 'titulo', 'estados']
  );
  assert.equal(sheets.CONFIG_DASHBOARD.writes[1].values.length, 4);
  assert.equal(sheets.CONFIG_ALERTAS.writes[1].values.length, 2);
});

test('migra pagamentos para perfis uma única vez sem alterar a aba legada', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const sheets = {
    GESTAO_PAGAMENTOS: new SheetMock('GESTAO_PAGAMENTOS', [
      Array.from(config.cabecalhos.gestaoPagamentos),
      ['42', 'ALUNA TESTE', 'Bom pagador', 'Paga em dia', '17/08/2026 10:00']
    ])
  };
  const spreadsheet = {
    getSheetByName: name => sheets[name] || null,
    insertSheet(name) {
      sheets[name] = new SheetMock(name);
      return sheets[name];
    }
  };
  const gas = loadGas([
    'apps-script/00_Config.gs',
    'apps-script/18_DashboardPerfisAlunos.gs',
    'apps-script/13_DashboardConfiguracao.gs'
  ], {
    SpreadsheetApp: { ProtectionType: { RANGE: 'RANGE' }, flush() {} }
  });

  gas.garantirConfiguracoesDashboardNaPlanilha_(spreadsheet);
  gas.garantirConfiguracoesDashboardNaPlanilha_(spreadsheet);

  assert.deepEqual(sheets.PERFIS_ALUNOS.values[0], [
    'id', 'aluno', 'professor_responsavel', 'ultimos_professores', 'perfil_pagamento',
    'observacao_pagamento', 'etiquetas_publico', 'etiquetas_comerciais',
    'observacoes_gerais', 'atualizado_em'
  ]);
  assert.deepEqual(sheets.PERFIS_ALUNOS.values[1].slice(0, 6), [
    '42', 'ALUNA TESTE', '', '[]', 'Bom pagador', 'Paga em dia'
  ]);
  assert.equal(sheets.PERFIS_ALUNOS.values.filter(row => row[0] === '42').length, 1);
  assert.equal(sheets.CONFIG_PERFIS_ALUNOS.values.some(row => row[2] === 'risco_de_churn'), true);
  assert.equal(sheets.CONFIG_PERFIS_ALUNOS.values.some(row => row[2] === 'performance'), true);
  assert.equal(sheets.CONFIG_PERFIS_ALUNOS.values.some(row => row[2] === 'coach'), true);
  assert.equal(sheets.GESTAO_PAGAMENTOS.values.length, 2);
});

test('configuração padrão separa as filas operacionais e mantém o financeiro secundário', () => {
  const gas = loadGas(['apps-script/00_Config.gs', 'apps-script/13_DashboardConfiguracao.gs']);
  const cards = gas.DASHBOARD_CONFIGURACAO_PADRAO.dashboard
    .filter(row => row[0] === 'home_card')
    .map(row => row[1]);

  assert.deepEqual(
    Array.from(cards),
    ['fila_prescricoes', 'fila_avaliacoes', 'agenda_financeira']
  );
});

test('incrementa uma versão persistente para invalidar apenas dados já superados', () => {
  const values = new Map([['tecnofit.dashboard.versao', '7']]);
  const gas = loadGas([
    'apps-script/00_Config.gs',
    'apps-script/13_DashboardConfiguracao.gs'
  ], {
    PropertiesService: {
      getDocumentProperties: () => ({
        getProperty: key => values.get(key) || null,
        setProperty: (key, value) => values.set(key, value)
      })
    }
  });

  assert.equal(gas.incrementarVersaoDashboard_(), 8);
  assert.equal(values.get('tecnofit.dashboard.versao'), '8');
});

test('usa o nome exato do polo Wellness como padrão canônico', () => {
  const gas = loadGas(['apps-script/00_Config.gs', 'apps-script/13_DashboardConfiguracao.gs']);
  assert.deepEqual(
    JSON.parse(gas.DASHBOARD_CONFIGURACAO_PADRAO.dashboard[0][4]),
    { status: '__matriculados__', polo: 'XSTEAM WELLNESS CLUB' }
  );
});
