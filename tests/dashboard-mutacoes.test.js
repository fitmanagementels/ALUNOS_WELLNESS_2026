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
    values.forEach((row, rowIndex) => {
      const target = this.row - 1 + rowIndex;
      if (!this.sheet.values[target]) this.sheet.values[target] = [];
      row.forEach((value, columnIndex) => { this.sheet.values[target][this.column - 1 + columnIndex] = value; });
    });
    this.sheet.writes += 1;
    return this;
  }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  protect() { return { setDescription() { return this; }, setWarningOnly() { return this; } }; }
}

class SheetMock {
  constructor(values) { this.values = values.map(row => row.slice()); this.writes = 0; }
  getMaxColumns() { return 20; }
  getLastRow() { return this.values.length; }
  getRange(row, column, rows = 1, columns = 1) { return new RangeMock(this, row, column, rows, columns); }
  clearContents() { this.values = []; return this; }
  getProtections() { return []; }
  setFrozenRows() { return this; }
}

function setup(options = {}) {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const sheets = {
    CONFIG_DASHBOARD: new SheetMock([
      Array.from(config.cabecalhos.configDashboard),
      ['filtros', 'globais', true, 0, '{"status":"Ativo","polo":"Wellness"}', 'Filtros padrão', '']
    ]),
    CONFIG_ALERTAS: new SheetMock([
      Array.from(config.cabecalhos.configAlertas),
      ['alertas', 'prescricoes', true, 10, '{"laranja":90,"vermelho":180,"roxo":270}', 'Prescrições', ''],
      ['alertas', 'avaliacoes', true, 20, '{"laranja":90,"vermelho":120,"roxo":180,"critico":270}', 'Avaliações', '']
    ]),
    GESTAO_PAGAMENTOS: new SheetMock([Array.from(config.cabecalhos.gestaoPagamentos)]),
    PERFIS_ALUNOS: new SheetMock([Array.from(config.cabecalhos.perfisAlunos)]),
    CONFIG_PERFIS_ALUNOS: new SheetMock([
      Array.from(config.cabecalhos.configPerfisAlunos),
      ['professor', 'matriculados', 'aquiles', 'Aquiles', true, 10],
      ['professor', 'cancelados', 'wallyson', 'Wallyson', true, 10],
      ['perfil_pagamento', 'global', 'sem_historico', 'Sem histórico', true, 10],
      ['perfil_pagamento', 'global', 'bom_pagador', 'Bom pagador', true, 20],
      ['etiqueta', 'publico', 'idoso', 'Idoso', true, 10],
      ['etiqueta', 'publico', 'saude', 'Saúde', true, 20],
      ['etiqueta', 'comercial', 'risco_de_churn', 'Risco de Churn', true, 10]
    ]),
    BASE_ALUNOS: new SheetMock([
      Array.from(config.cabecalhos.alunos),
      ['42', 'ALUNA TESTE', '85999999999', 'Ativo', '', '', '', 'exec-1'],
      ['43', 'ALUNO CANCELADO', '85999999998', 'Cancelado', '', '', '', 'exec-1']
    ]),
    FLUXO_LEADS: new SheetMock([Array.from(config.cabecalhos.fluxoLeads)]),
    FLUXO_CHURNS: new SheetMock([Array.from(config.cabecalhos.fluxoChurns)])
  };
  if (options.withoutProfileSchema) {
    delete sheets.PERFIS_ALUNOS;
    delete sheets.CONFIG_PERFIS_ALUNOS;
  }
  const properties = new Map();
  const calls = [];
  const sheetCalls = [];
  const gas = loadGas([
    'apps-script/00_Config.gs',
    'apps-script/11_DashboardRepositorio.gs',
    'apps-script/15_DashboardFluxo.gs',
    'apps-script/18_DashboardPerfisAlunos.gs',
    'apps-script/13_DashboardConfiguracao.gs',
    'apps-script/14_DashboardMutacoes.gs'
  ], {
    SpreadsheetApp: {
      ProtectionType: { RANGE: 'RANGE' },
      openById: () => ({
        getSheetByName: name => { sheetCalls.push(name); return sheets[name] || null; },
        insertSheet: name => (sheets[name] = new SheetMock([]))
      }),
      flush() {}
    },
    LockService: { getScriptLock: () => ({ waitLock: () => calls.push('lock'), releaseLock: () => calls.push('release') }) },
    PropertiesService: { getDocumentProperties: () => ({
      getProperty: key => properties.get(key) || null,
      setProperty: (key, value) => properties.set(key, value)
    }) },
    Utilities: { formatDate: () => '27/07/2026 20:00', getUuid: () => 'uuid-teste' }
  });
  return { gas, sheets, calls, sheetCalls };
}

test('rejeita limites não crescentes sem gravar', () => {
  const { gas, sheets, calls } = setup();
  assert.throws(() => gas.salvarMutacoesDashboard({
    requestId: 'alerta-invalido',
    patches: [{ tipo: 'configAlertas', valores: { prescricoes: { laranja: 90, vermelho: 80, roxo: 270 } } }]
  }), /crescentes/);
  assert.equal(sheets.CONFIG_ALERTAS.writes, 0);
  assert.deepEqual(calls, ['lock', 'release']);
});

test('upsert de pagamento por ID é idempotente mesmo com a mesma solicitação repetida', () => {
  const { gas, sheets, calls } = setup();
  const lote = {
    requestId: 'perfil-2321-1',
    patches: [{ tipo: 'perfilPagamento', valores: {
      id: '2321', aluno: 'ALUNA TESTE', perfilPagamento: 'Bom pagador', observacao: 'Paga em dia'
    } }]
  };

  gas.salvarMutacoesDashboard(lote);
  const repetido = gas.salvarMutacoesDashboard(lote);

  assert.equal(sheets.GESTAO_PAGAMENTOS.values.filter(row => row[0] === '2321').length, 1);
  assert.equal(sheets.GESTAO_PAGAMENTOS.values[1][2], 'Bom pagador');
  assert.equal(repetido.idempotente, true);
  assert.deepEqual(calls, ['lock', 'release', 'lock', 'release']);
});

test('salva perfil completo por ID e preserva professor histórico', () => {
  const { gas, sheets } = setup();
  sheets.PERFIS_ALUNOS.values.push([
    '42', 'ALUNA TESTE', 'Professor antigo', '[]', 'Sem histórico', '', '[]', '[]', '', ''
  ]);

  gas.salvarMutacoesDashboard({
    requestId: 'perfil-aluno-42',
    patches: [{ tipo: 'perfilAluno', valores: {
      id: '42',
      aluno: 'ALUNA TESTE',
      professorResponsavel: 'Professor antigo',
      ultimosProfessores: ['Aquiles'],
      perfilPagamento: 'Bom pagador',
      observacaoPagamento: 'Paga em dia',
      etiquetasPublico: ['idoso', 'saude'],
      etiquetasComerciais: ['risco_de_churn'],
      observacoesGerais: 'Prefere treinar cedo.'
    } }]
  });

  const linha = sheets.PERFIS_ALUNOS.values.find(row => row[0] === '42');
  assert.equal(linha[2], 'Professor antigo');
  assert.equal(linha[3], '["Aquiles"]');
  assert.equal(linha[4], 'Bom pagador');
  assert.equal(linha[6], '["idoso","saude"]');
  assert.equal(linha[7], '["risco_de_churn"]');
  assert.equal(linha[8], 'Prefere treinar cedo.');
});

test('primeiro salvamento de perfil cria a estrutura persistente ausente', () => {
  const { gas, sheets } = setup({ withoutProfileSchema: true });

  gas.salvarMutacoesDashboard({
    requestId: 'perfil-primeiro-salvamento',
    patches: [{ tipo: 'perfilAluno', valores: {
      id: '42', aluno: 'ALUNA TESTE', professorResponsavel: 'Aquiles', ultimosProfessores: ['Aquiles'],
      perfilPagamento: 'Sem histórico', etiquetasPublico: ['idoso'], etiquetasComerciais: []
    } }]
  });

  assert.ok(sheets.PERFIS_ALUNOS);
  assert.ok(sheets.CONFIG_PERFIS_ALUNOS);
  assert.equal(sheets.PERFIS_ALUNOS.values[1][0], '42');
  assert.equal(sheets.PERFIS_ALUNOS.values[1][2], 'Aquiles');
  assert.equal(sheets.PERFIS_ALUNOS.values[1][3], '["Aquiles"]');
});

test('usa catálogo de cancelados e rejeita etiqueta no grupo errado sem gravar', () => {
  const { gas, sheets } = setup();
  gas.salvarMutacoesDashboard({
    requestId: 'perfil-cancelado-43',
    patches: [{ tipo: 'perfilAluno', valores: {
      id: '43', aluno: 'ALUNO CANCELADO', professorResponsavel: 'Wallyson',
      perfilPagamento: 'Sem histórico', etiquetasPublico: [], etiquetasComerciais: []
    } }]
  });
  assert.equal(sheets.PERFIS_ALUNOS.values[1][2], 'Wallyson');

  const writesBefore = sheets.PERFIS_ALUNOS.writes;
  assert.throws(() => gas.salvarMutacoesDashboard({
    requestId: 'perfil-invalido-42',
    patches: [{ tipo: 'perfilAluno', valores: {
      id: '42', aluno: 'ALUNA TESTE', professorResponsavel: 'Aquiles',
      perfilPagamento: 'Bom pagador', etiquetasPublico: ['risco_de_churn'], etiquetasComerciais: []
    } }]
  }), /Etiqueta de Público inválida/);
  assert.equal(sheets.PERFIS_ALUNOS.writes, writesBefore);
});

test('salvar cartões da Home preserva os filtros padrão já configurados', () => {
  const { gas, sheets } = setup();
  gas.salvarMutacoesDashboard({
    requestId: 'home-1',
    patches: [{ tipo: 'configDashboard', valores: { homeCards: [{
      chave: 'vencem_hoje', ativo: true, ordem: 1, titulo: 'Hoje', estados: []
    }] } }]
  });

  const filtros = sheets.CONFIG_DASHBOARD.values.find(row => row[0] === 'filtros');
  assert.equal(filtros[4], '{"status":"Ativo","polo":"Wellness"}');
});

test('aceita os três blocos operacionais da nova Home', () => {
  const { gas, sheets } = setup();
  gas.salvarMutacoesDashboard({
    requestId: 'home-operacional-1',
    patches: [{ tipo: 'configDashboard', valores: { homeCards: [
      { chave: 'fila_prescricoes', ativo: true, ordem: 1, titulo: 'Fichas', estados: [] },
      { chave: 'fila_avaliacoes', ativo: true, ordem: 2, titulo: 'Avaliações', estados: [] },
      { chave: 'agenda_financeira', ativo: true, ordem: 3, titulo: 'Agenda financeira', estados: [] }
    ] } }]
  });

  assert.deepEqual(
    sheets.CONFIG_DASHBOARD.values.filter(row => row[0] === 'home_card').map(row => row[1]),
    ['fila_prescricoes', 'fila_avaliacoes', 'agenda_financeira']
  );
});

test('salva Lead manual com status manual e preserva o registro ao repetir a solicitação', () => {
  const { gas, sheets } = setup();
  const lote = {
    requestId: 'lead-1',
    patches: [{ tipo: 'fluxoLead', valores: {
      nome: 'LEAD TESTE', telefone: '85900000000', primeiroContato: '01/07/2026',
      entradaComoCliente: '05/07/2026', status: 'Em contato', planoContratado: '2x/sem', valorPacote: 300
    } }]
  };

  gas.salvarMutacoesDashboard(lote);
  const repetido = gas.salvarMutacoesDashboard(lote);

  assert.equal(sheets.FLUXO_LEADS.values.length, 2);
  assert.equal(sheets.FLUXO_LEADS.values[1][9], 'Em contato');
  assert.equal(sheets.FLUXO_LEADS.values[1][10], '2x/sem');
  assert.equal(repetido.idempotente, true);
});

test('salvar Lead lê somente a aba de leads necessária para a mutação', () => {
  const { gas, sheetCalls } = setup();
  gas.salvarMutacoesDashboard({
    requestId: 'lead-leitura-minima',
    patches: [{ tipo: 'fluxoLead', valores: {
      id: 'lead-local', criar: true, nome: 'LEAD RÁPIDO', telefone: '85900000000',
      primeiroContato: '01/07/2026', status: 'Novo'
    } }]
  });

  assert.ok(sheetCalls.length >= 1);
  assert.ok(sheetCalls.every(name => name === 'FLUXO_LEADS'));
});

test('permite excluir Churn, mas rejeita qualquer operação de exclusão de Lead', () => {
  const { gas, sheets } = setup();
  sheets.FLUXO_CHURNS.values.push(['churn-1', '1', 'ALUNO TESTE', 'XSTEAM WELLNESS CLUB', '01/07/2026', '', '', '', '', '']);

  gas.salvarMutacoesDashboard({ requestId: 'churn-delete', patches: [{ tipo: 'excluirFluxoChurn', valores: { id: 'churn-1' } }] });
  assert.equal(sheets.FLUXO_CHURNS.values.length, 1);
  assert.throws(() => gas.salvarMutacoesDashboard({ requestId: 'lead-delete', patches: [{ tipo: 'excluirFluxoLead', valores: { id: 'lead-1' } }] }), /Tipo de alteração inválido/);
});

test('salva profissionais de Churn nas colunas corretas e rejeita opções inválidas', () => {
  const { gas, sheets } = setup();
  gas.salvarMutacoesDashboard({ requestId: 'churn-profissionais', patches: [{ tipo: 'fluxoChurn', valores: {
    alunoId: '42', nome: 'ALUNO TESTE', telefone: '85900000000', dataSaida: '02/07/2026',
    profissionalResponsavel: 'Elohim', ultimoPersonal: 'Wallyson'
  } }] });

  const linha = sheets.FLUXO_CHURNS.values[1];
  assert.equal(linha[4], '02/07/2026');
  assert.equal(linha[5], 'Elohim');
  assert.equal(linha[6], 'Wallyson');
  assert.throws(() => gas.salvarMutacoesDashboard({ requestId: 'churn-profissional-invalido', patches: [{ tipo: 'fluxoChurn', valores: {
    alunoId: '43', nome: 'ALUNO TESTE B', dataSaida: '03/07/2026', profissionalResponsavel: 'Pessoa inválida'
  } }] }), /Churn inválido/);
});
