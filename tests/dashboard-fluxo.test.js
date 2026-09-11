const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas([
  'apps-script/00_Config.gs',
  'apps-script/09_DashboardMetricas.gs',
  'apps-script/15_DashboardFluxo.gs'
]);

const leads = [
  { id: 'lead-1', nome: 'LEAD TESTE A', primeiroContato: '01/07/2026', entradaComoCliente: '05/07/2026', status: 'Convertido' },
  { id: 'lead-2', nome: 'LEAD TESTE B', primeiroContato: '11/07/2026', entradaComoCliente: '', status: 'Em contato' },
  { id: 'lead-3', nome: 'LEAD TESTE C', primeiroContato: '20/06/2026', entradaComoCliente: '10/07/2026', status: 'Novo' }
];

const churns = [
  { id: 'churn-1', dataSaida: '02/07/2026', motivoSaida: 'Mudança de cidade', acaoRetencao: 'Ligação realizada' },
  { id: 'churn-2', dataSaida: '19/07/2026', motivoSaida: '', acaoRetencao: '' },
  { id: 'churn-3', dataSaida: '20/06/2026', motivoSaida: 'Horário', acaoRetencao: '' }
];

function json(value) { return JSON.parse(JSON.stringify(value)); }

test('resumoLeadsFluxo_ calcula entradas, conversão e funil manual', () => {
  const resumo = gas.resumoLeadsFluxo_(leads, new Date(2026, 6, 1), new Date(2026, 6, 31));

  assert.deepEqual(json(resumo.kpis), {
    novosLeads: 2,
    entradasComoCliente: 2,
    conversaoPeriodo: 100,
    emAcao: 2
  });
  assert.equal(resumo.funil.Convertido, 1);
  assert.equal(resumo.inconsistenciasEntrada.length, 1);
});

test('resumoChurnsFluxo_ calcula saídas e completude dos relatos', () => {
  const resumo = gas.resumoChurnsFluxo_(churns, new Date(2026, 6, 1), new Date(2026, 6, 31));

  assert.deepEqual(json(resumo.kpis), { saidas: 2, comMotivo: 1, comAcaoRetencao: 1 });
  assert.deepEqual(json(resumo.serieTemporal), [{ chave: '2026-07', label: 'Jul/2026', valor: 2 }]);
});

test('schema de Churn usa profissionais e não filtra mais registros por polo', () => {
  assert.deepEqual(Array.from(gas.CONFIG.cabecalhos.fluxoChurns), [
    'churn_id', 'aluno_id', 'nome', 'telefone', 'data_saida',
    'profissional_responsavel', 'ultimo_personal', 'motivo_saida',
    'sinais_contexto', 'acao_retencao', 'criado_em', 'atualizado_em'
  ]);

  const churns = [
    { nome: 'ALUNO A', polo: 'XSTEAM WELLNESS CLUB' },
    { nome: 'ALUNO B', polo: 'OUTRO POLO' }
  ];
  assert.deepEqual(json(gas.filtrarChurnsFluxoParaDashboard_(churns)), churns);
});

test('serieMensalChurnFluxo_ preenche meses vazios e calcula a variação mensal', () => {
  const serie = gas.serieMensalChurnFluxo_([
    { dataSaida: '10/01/2026' },
    { dataSaida: '05/03/2026' }
  ], '2026-01', '2026-03');

  assert.deepEqual(json(serie), [
    { chave: '2026-01', label: 'Jan/2026', valor: 1, variacaoAbsoluta: null, variacaoPercentual: null },
    { chave: '2026-02', label: 'Fev/2026', valor: 0, variacaoAbsoluta: -1, variacaoPercentual: -100 },
    { chave: '2026-03', label: 'Mar/2026', valor: 1, variacaoAbsoluta: 1, variacaoPercentual: null }
  ]);
});

test('serieSemanalChurnFluxo_ preenche semanas vazias entre os limites', () => {
  const serie = gas.serieSemanalChurnFluxo_([
    { dataSaida: '05/01/2026' },
    { dataSaida: '22/01/2026' }
  ], '05/01/2026', '02/02/2026');

  assert.deepEqual(json(serie.map((item) => ({ chave: item.chave, valor: item.valor }))), [
    { chave: '2026-01-05', valor: 1 },
    { chave: '2026-01-12', valor: 0 },
    { chave: '2026-01-19', valor: 1 },
    { chave: '2026-01-26', valor: 0 },
    { chave: '2026-02-02', valor: 0 }
  ]);
});

test('diagnosticosChurnFluxo_ agrupa responsável não informado e cobertura de retenção', () => {
  const diagnosticos = gas.diagnosticosChurnFluxo_([
    { motivoSaida: 'Horário', profissionalResponsavel: 'Elohim', acaoRetencao: 'Ligação' },
    { motivoSaida: 'Horário', profissionalResponsavel: '', acaoRetencao: '' },
    { motivoSaida: '', profissionalResponsavel: 'Xico', acaoRetencao: '' }
  ]);

  assert.deepEqual(json(diagnosticos.motivos), [{ chave: 'Horário', valor: 2 }]);
  assert.deepEqual(json(diagnosticos.responsaveis), [
    { chave: 'Elohim', valor: 1 }, { chave: 'Não informado', valor: 1 }, { chave: 'Xico', valor: 1 }
  ]);
  assert.deepEqual(json(diagnosticos.retencao), { comAcao: 1, semAcao: 2, coberturaPercentual: 33.3 });
});
