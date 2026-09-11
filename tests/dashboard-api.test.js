const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

const FILES = [
  'apps-script/00_Config.gs',
  'apps-script/04_PlanilhaRepositorio.gs',
  'apps-script/06_LogImportacoes.gs',
  'apps-script/09_DashboardMetricas.gs',
  'apps-script/10_DashboardPaginas.gs',
  'apps-script/11_DashboardRepositorio.gs',
  'apps-script/15_DashboardFluxo.gs',
  'apps-script/18_DashboardPerfisAlunos.gs',
  'apps-script/13_DashboardConfiguracao.gs',
  'apps-script/12_DashboardApi.gs'
];

function criarAba(valores) {
  const chamadas = [];
  let leiturasDataRange = 0;
  return {
    chamadas,
    leiturasDataRange: () => leiturasDataRange,
    getLastRow: () => valores.length,
    getRange(linha, coluna, quantidadeLinhas, quantidadeColunas) {
      chamadas.push([linha, coluna, quantidadeLinhas, quantidadeColunas]);
      return {
        getValues: () => valores
          .slice(linha - 1, linha - 1 + quantidadeLinhas)
          .map(item => item.slice(coluna - 1, coluna - 1 + quantidadeColunas)),
        getDisplayValues: () => valores
          .slice(linha - 1, linha - 1 + quantidadeLinhas)
          .map(item => item.slice(coluna - 1, coluna - 1 + quantidadeColunas).map(valor => String(valor)))
      };
    },
    getDataRange() {
      leiturasDataRange += 1;
      return {
        getDisplayValues: () => valores.map(item => item.map(valor => String(valor)))
      };
    }
  };
}

function criarCache() {
  const valores = new Map();
  return {
    valores,
    get: chave => valores.get(chave) || null,
    put: (chave, valor) => valores.set(chave, valor)
  };
}

function carregarComPlanilha(planilha, cache, extras = {}) {
  let aberturas = 0;
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const fluxo = {
    FLUXO_LEADS: criarAba([Array.from(config.cabecalhos.fluxoLeads)]),
    FLUXO_CHURNS: criarAba([Array.from(config.cabecalhos.fluxoChurns)])
  };
  const permanencia = {
    BASE_PERMANENCIA: criarAba([Array.from(config.cabecalhos.basePermanencia)]),
    HISTORICO_PERMANENCIA: criarAba([Array.from(config.cabecalhos.historicoPermanencia)])
  };
  const gas = loadGas(FILES, {
    SpreadsheetApp: {
      openById() {
        aberturas += 1;
        return {
          getSheetByName: nome => planilha.getSheetByName(nome) || fluxo[nome] || permanencia[nome] || null
        };
      }
    },
    CacheService: { getScriptCache: () => cache },
    ...extras
  });
  return { gas, aberturas: () => aberturas, fluxo, permanencia };
}

test('bootstrap inclui o payload manual de Fluxo e o contato necessário ao perfil', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const abas = {
    BASE_ALUNOS: criarAba([Array.from(config.cabecalhos.alunos), ['1', 'ALUNO TESTE', '85900000001', 'Ativo', '', '', '', 'exec-1']]),
    CONTRATOS: criarAba([Array.from(config.cabecalhos.contratos)]),
    IMPORTACOES: criarAba([Array.from(config.cabecalhos.importacoes)]),
    CONFIG_DASHBOARD: criarAba([Array.from(config.cabecalhos.configDashboard)]),
    CONFIG_ALERTAS: criarAba([Array.from(config.cabecalhos.configAlertas)]),
    GESTAO_PAGAMENTOS: criarAba([Array.from(config.cabecalhos.gestaoPagamentos)])
  };
  const { gas } = carregarComPlanilha(
    { getSheetByName: nome => abas[nome] || null },
    criarCache(),
    { PropertiesService: { getDocumentProperties: () => ({ getProperty: () => null }) } }
  );

  const resultado = gas.obterBootstrapDashboard();

  assert.deepEqual(JSON.parse(JSON.stringify(resultado.fluxo)), { leads: [], churns: [] });
  assert.equal(resultado.alunos[0].contato, '85900000001');
  assert.deepEqual(JSON.parse(JSON.stringify(resultado.perfisAlunos)), []);
});

test('bootstrap expõe permanência sem valores históricos ou contato', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const abas = {
    BASE_ALUNOS: criarAba([Array.from(config.cabecalhos.alunos)]),
    CONTRATOS: criarAba([Array.from(config.cabecalhos.contratos)]),
    IMPORTACOES: criarAba([Array.from(config.cabecalhos.importacoes)]),
    CONFIG_DASHBOARD: criarAba([Array.from(config.cabecalhos.configDashboard)]),
    CONFIG_ALERTAS: criarAba([Array.from(config.cabecalhos.configAlertas)]),
    GESTAO_PAGAMENTOS: criarAba([Array.from(config.cabecalhos.gestaoPagamentos)]),
    BASE_PERMANENCIA: criarAba([
      Array.from(config.cabecalhos.basePermanencia),
      ['1', 'ALUNO TESTE', new Date(2024, 0, 10, 12), 'Ativo', 31, 3, '2026-08-07', '2026-08-21', true, 'exec-1']
    ]),
    HISTORICO_PERMANENCIA: criarAba([
      Array.from(config.cabecalhos.historicoPermanencia),
      ['evento-1', '1', '2026-08-21', 'ALTERACAO_STATUS', 'status_permanencia', 'Cancelado', 'Ativo', 'exec-1', new Date()]
    ])
  };
  const { gas } = carregarComPlanilha(
    { getSheetByName: nome => abas[nome] || null },
    criarCache(),
    { PropertiesService: { getDocumentProperties: () => ({ getProperty: () => null }) } }
  );

  const resultado = gas.obterBootstrapDashboard();

  assert.deepEqual(Object.keys(resultado.permanencia[0]).sort(), [
    'aluno', 'clienteDesde', 'continuidadeMeses', 'id', 'presenteUltimoLote',
    'quantidadeContratos', 'status'
  ]);
  assert.deepEqual(Object.keys(resultado.eventosPermanencia[0]).sort(), [
    'dataReferencia', 'id', 'tipo'
  ]);
  assert.equal('valorAnterior' in resultado.eventosPermanencia[0], false);
  assert.equal('contato' in resultado.permanencia[0], false);
});

test('cache de bootstrap sem permanência é considerado inválido', () => {
  const gas = loadGas(FILES);
  const respostaAntiga = {
    versao: 'v1', atualizadoEm: '', filtrosPadrao: {}, configuracao: {},
    alunos: [], contratos: [], perfisAlunos: [], catalogoPerfisAlunos: [],
    fluxo: { leads: [], churns: [] }
  };
  assert.equal(gas.respostaBootstrapDashboardValida_(respostaAntiga, 'v1'), false);
  respostaAntiga.permanencia = [];
  respostaAntiga.eventosPermanencia = [];
  assert.equal(gas.respostaBootstrapDashboardValida_(respostaAntiga, 'v1'), true);
});

test('versão do dashboard anuncia suporte ao salvamento de perfil de aluno', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const abas = {
    IMPORTACOES: criarAba([Array.from(config.cabecalhos.importacoes)])
  };
  const { gas } = carregarComPlanilha(
    { getSheetByName: nome => abas[nome] || null },
    criarCache(),
    { PropertiesService: { getDocumentProperties: () => ({ getProperty: () => null }) } }
  );

  assert.deepEqual(JSON.parse(JSON.stringify(gas.obterVersaoDashboard().capacidades)), { perfilAluno: true });
});

test('obterAnaliseChurnsDashboard devolve séries de todos os churns manuais', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const abas = {
    FLUXO_CHURNS: criarAba([
      Array.from(config.cabecalhos.fluxoChurns),
      ['churn-1', '1', 'ALUNO TESTE A', '', '05/01/2026', 'Elohim', 'Wallyson', 'Horário', '', '', '', ''],
      ['churn-2', '2', 'ALUNO TESTE B', '', '20/01/2026', 'Xico', 'Iranildo', '', '', 'Ligação', '', ''],
      ['churn-3', '3', 'ALUNO TESTE C', '', '21/01/2026', '', '', 'Preço', '', '', '', '']
    ])
  };
  const { gas } = carregarComPlanilha(
    { getSheetByName: nome => abas[nome] || null },
    criarCache(),
    { PropertiesService: { getDocumentProperties: () => ({ getProperty: () => null }) } }
  );

  const resultado = gas.obterAnaliseChurnsDashboard({
    mesInicio: '2026-01', mesFim: '2026-01', semanaInicio: '05/01/2026', semanaFim: '25/01/2026'
  });

  assert.deepEqual(JSON.parse(JSON.stringify(resultado.mensal.map(item => item.valor))), [3]);
  assert.deepEqual(JSON.parse(JSON.stringify(resultado.semanal.map(item => item.valor))), [1, 0, 2]);
  assert.deepEqual(JSON.parse(JSON.stringify(resultado.diagnosticos.retencao)), {
    comAcao: 1, semAcao: 2, coberturaPercentual: 33.3
  });
});

test('análise de Churn lê somente Churns e reutiliza o cache do mesmo filtro', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const abas = {
    FLUXO_CHURNS: criarAba([
      Array.from(config.cabecalhos.fluxoChurns),
      ['churn-cache', '1', 'ALUNO TESTE', '', '05/01/2026', '', '', '', '', '', '', '']
    ])
  };
  const { gas, fluxo } = carregarComPlanilha(
    { getSheetByName: nome => abas[nome] || null },
    criarCache(),
    { PropertiesService: { getDocumentProperties: () => ({ getProperty: () => null }) } }
  );
  const filtros = { mesInicio: '2026-01', mesFim: '2026-01', semanaInicio: '05/01/2026', semanaFim: '11/01/2026' };

  gas.obterAnaliseChurnsDashboard(filtros);
  const leiturasChurnAntes = fluxo.FLUXO_CHURNS.chamadas.length;
  gas.obterAnaliseChurnsDashboard(filtros);

  assert.equal(fluxo.FLUXO_LEADS.chamadas.length, 0);
  assert.equal(fluxo.FLUXO_CHURNS.chamadas.length, leiturasChurnAntes);
});

test('versão do dashboard muda quando uma linha manual é incluída em Churn', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const linhasChurn = [Array.from(config.cabecalhos.fluxoChurns)];
  const abas = {
    FLUXO_CHURNS: criarAba(linhasChurn),
    IMPORTACOES: criarAba([Array.from(config.cabecalhos.importacoes)])
  };
  const { gas } = carregarComPlanilha(
    { getSheetByName: nome => abas[nome] || null },
    criarCache(),
    { PropertiesService: { getDocumentProperties: () => ({ getProperty: () => null }) } }
  );

  const antes = gas.obterVersaoDashboard().versao;
  linhasChurn.push(['churn-manual-1', '1', 'ALUNO TESTE', '', '05/01/2026', '', '', '', '', '', '', '']);
  const depois = gas.obterVersaoDashboard().versao;

  assert.notEqual(depois, antes);
});

test('lerTabelaDashboard_ mapeia cabeçalhos exatos e limita a faixa lida', () => {
  const cabecalhos = ['id', 'aluno'];
  const aba = criarAba([
    ['id', 'aluno', 'coluna fora do contrato'],
    ['1', 'ALUNO TESTE', 'não deve ser lida'],
    ['', '', 'também não deve tornar a linha válida']
  ]);
  const { gas } = carregarComPlanilha({ getSheetByName: () => aba }, criarCache());

  const resultado = gas.lerTabelaDashboard_('BASE_ALUNOS', cabecalhos);

  assert.deepEqual(JSON.parse(JSON.stringify(resultado)), [{ id: '1', aluno: 'ALUNO TESTE' }]);
  assert.deepEqual(aba.chamadas, [[1, 1, 3, 2]]);
});

test('lerTabelaDashboard_ rejeita cabeçalho com texto ou posição diferente', () => {
  const aba = criarAba([['aluno', 'id'], ['ALUNO TESTE', '1']]);
  const { gas } = carregarComPlanilha({ getSheetByName: () => aba }, criarCache());

  assert.throws(
    () => gas.lerTabelaDashboard_('BASE_ALUNOS', ['id', 'aluno']),
    /^Error: Estrutura de dados incompatível\.$/
  );
});

test('lerTabelaDashboard_ valida o cabeçalho mesmo quando não há linhas de dados', () => {
  const aba = criarAba([['id', 'nome divergente']]);
  const { gas } = carregarComPlanilha({ getSheetByName: () => aba }, criarCache());

  assert.throws(
    () => gas.lerTabelaDashboard_('BASE_ALUNOS', ['id', 'aluno']),
    /^Error: Estrutura de dados incompatível\.$/
  );
});

test('obterUltimaImportacaoDashboard_ valida aba só com cabeçalho e retorna vazio', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const aba = criarAba([Array.from(config.cabecalhos.importacoes)]);
  const { gas } = carregarComPlanilha({ getSheetByName: () => aba }, criarCache());

  const resultado = gas.obterUltimaImportacaoDashboard_({ getSheetByName: () => aba });

  assert.equal(resultado, null);
  assert.deepEqual(aba.chamadas, [[1, 1, 1, config.cabecalhos.importacoes.length]]);
  assert.equal(aba.leiturasDataRange(), 0);
});

test('obterUltimaImportacaoDashboard_ rejeita cabeçalhos reordenados', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const cabecalhos = Array.from(config.cabecalhos.importacoes);
  [cabecalhos[0], cabecalhos[1]] = [cabecalhos[1], cabecalhos[0]];
  const aba = criarAba([cabecalhos]);
  const { gas } = carregarComPlanilha({ getSheetByName: () => aba }, criarCache());

  assert.throws(
    () => gas.obterUltimaImportacaoDashboard_({ getSheetByName: () => aba }),
    /^Error: Estrutura de dados incompatível\.$/
  );
  assert.equal(aba.leiturasDataRange(), 0);
});

test('obterUltimaImportacaoDashboard_ encontra a última SUCESSO em leitura reversa limitada', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const cabecalhos = Array.from(config.cabecalhos.importacoes);
  const linha = (id, status) => [id, 'inicio', `fim-${id}`, 'vencimentos', 'arquivo.html', 'drive', '2026-07-11', 'r1', '1', '1', '0', status, 'mensagem'];
  const valores = [cabecalhos, linha('antiga', 'SUCESSO')];
  for (let indice = 0; indice < 202; indice += 1) valores.push(linha(`falha-${indice}`, 'ERRO'));
  valores.splice(150, 0, linha('mais-recente', 'SUCESSO'));
  const aba = criarAba(valores);
  const { gas } = carregarComPlanilha({ getSheetByName: () => aba }, criarCache());

  const resultado = gas.obterUltimaImportacaoDashboard_({ getSheetByName: () => aba });

  assert.equal(resultado.execucaoId, 'mais-recente');
  assert.equal(resultado.concluidaEm, 'fim-mais-recente');
  assert.equal(resultado.linha, 151);
  assert.equal(aba.leiturasDataRange(), 0);
  assert.ok(aba.chamadas.slice(1).every(chamada => chamada[2] <= 200));
});

test('obterDadosPaginaDashboard despacha a página e reutiliza resposta JSON do cache', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const abas = {
    BASE_ALUNOS: criarAba([
      Array.from(config.cabecalhos.alunos),
      ['1', 'ALUNO TESTE', '8500000000', 'Ativo', '', '', '', 'exec-1']
    ]),
    CONTRATOS: criarAba([
      Array.from(config.cabecalhos.contratos),
      ['c1', '1', '2X - POLO - PERSONAL', '2X', 100, '', new Date(2026, 6, 10, 12), 'Finalizado', 'POLO', 'MUSCULAÇÃO', 'exec-1']
    ]),
    IMPORTACOES: criarAba([
      Array.from(config.cabecalhos.importacoes),
      ['exec-1', '11/07/2026 08:00', '11/07/2026 08:05', 'vencimentos', 'arquivo.html', 'drive-1', '2026-07-11', 'r1', '1', '1', '0', 'SUCESSO', 'OK']
    ])
  };
  const cache = criarCache();
  const { gas, aberturas } = carregarComPlanilha({ getSheetByName: nome => abas[nome] || null }, cache);

  const result = gas.obterDadosPaginaDashboard('vencimentos', {});
  const repetido = gas.obterDadosPaginaDashboard('vencimentos', {});

  assert.equal(result.ok, true);
  assert.equal(result.pagina, 'vencimentos');
  assert.equal(result.dados.kpis.vencidos, 1);
  assert.equal(aberturas(), 1);
  assert.deepEqual(JSON.parse(JSON.stringify(repetido)), JSON.parse(JSON.stringify(result)));
  const serializado = Array.from(cache.valores.values())[0];
  assert.equal(JSON.parse(serializado).dados.lista[0].vencimento, '10/07/2026');
  assert.equal(serializado.includes('2026-07-10T'), false);
  assert.throws(() => gas.obterDadosPaginaDashboard('inexistente', {}), /Página inválida/);
  assert.throws(() => gas.obterDadosPaginaDashboard('toString', {}), /^Error: Página inválida\.$/);
});

test('obterDadosPaginaDashboard aplica filtros sem reduzir as opções disponíveis', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const abas = {
    BASE_ALUNOS: criarAba([
      Array.from(config.cabecalhos.alunos),
      ['1', 'ALUNO ATIVO A', '8500000001', 'Ativo', '', '', '', 'exec-1'],
      ['2', 'ALUNO INATIVO A', '8500000002', 'Inativo', '', '', '', 'exec-1'],
      ['3', 'ALUNO ATIVO B', '8500000003', 'Ativo', '', '', '', 'exec-1']
    ]),
    CONTRATOS: criarAba([
      Array.from(config.cabecalhos.contratos),
      ['c1', '1', '', '2X', 100, '', '', 'Ativo', 'POLO A', 'MUSCULAÇÃO', 'exec-1'],
      ['c2', '2', '', '2X', 200, '', '', 'Ativo', 'POLO A', 'MUSCULAÇÃO', 'exec-1'],
      ['c3', '3', '', '3X', 300, '', '', 'Ativo', 'POLO B', 'CORRIDA', 'exec-1']
    ]),
    IMPORTACOES: criarAba([Array.from(config.cabecalhos.importacoes)])
  };
  const { gas } = carregarComPlanilha({ getSheetByName: nome => abas[nome] || null }, criarCache());

  const resultado = gas.obterDadosPaginaDashboard('planos', {
    busca: 'ALUNO ATIVO A', polo: 'POLO A', statusAluno: 'Ativo', frequencia: '2X',
    modalidade: 'MUSCULAÇÃO', statusContrato: 'Ativo'
  });

  assert.deepEqual(JSON.parse(JSON.stringify(resultado.dados.filtros)), {
    polos: ['POLO A', 'POLO B'], statusAlunos: ['Ativo', 'Inativo'],
    frequencias: ['2X', '3X'], modalidades: ['CORRIDA', 'MUSCULAÇÃO'], statusContratos: ['Ativo']
  });
  assert.deepEqual(JSON.parse(JSON.stringify({
    alunos: resultado.dados.kpis.alunos, contratos: resultado.dados.kpis.contratos,
    valor: resultado.dados.kpis.valor, ticketMedio: resultado.dados.kpis.ticketMedio
  })), { alunos: 1, contratos: 1, valor: 100, ticketMedio: 100 });
  assert.deepEqual(resultado.dados.lista.map(item => item.aluno), ['ALUNO ATIVO A']);
});

test('última tentativa com erro posterior ao sucesso gera aviso genérico sem mensagem bruta', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const linha = (id, fim, tipo, status, mensagem) => [
    id, '11/07/2026 08:00', fim, tipo, 'arquivo.html', 'drive-id', '11/07/2026',
    'r1', '1', '1', '0', status, mensagem
  ];
  const abas = {
    BASE_ALUNOS: criarAba([Array.from(config.cabecalhos.alunos)]),
    CONTRATOS: criarAba([Array.from(config.cabecalhos.contratos)]),
    IMPORTACOES: criarAba([
      Array.from(config.cabecalhos.importacoes),
      linha('exec-ok', '11/07/2026 08:05', 'vencimentos', 'SUCESSO', 'OK'),
      linha('exec-ok', '11/07/2026 08:05', 'fichas', 'SUCESSO', 'OK'),
      linha('exec-ok', '11/07/2026 08:05', 'avaliacao_fisica', 'SUCESSO', 'OK'),
      linha('exec-erro', '12/07/2026 09:15', 'vencimentos', 'ERRO', 'ALUNA SEGREDO 85999999999'),
      linha('exec-erro', '12/07/2026 09:15', 'fichas', 'ERRO', 'ALUNA SEGREDO 85999999999'),
      linha('exec-erro', '12/07/2026 09:15', 'avaliacao_fisica', 'ERRO', 'ALUNA SEGREDO 85999999999')
    ])
  };
  const { gas, aberturas } = carregarComPlanilha({ getSheetByName: nome => abas[nome] || null }, criarCache());

  const resultado = gas.obterDadosPaginaDashboard('planos', {});

  assert.equal(resultado.atualizadoEm, '11/07/2026 08:05');
  assert.match(resultado.avisoImportacao, /12\/07\/2026/);
  assert.match(resultado.avisoImportacao, /última base válida/i);
  assert.equal(resultado.avisoImportacao.includes('ALUNA SEGREDO'), false);
  assert.equal(resultado.avisoImportacao.includes('85999999999'), false);
  assert.equal(aberturas(), 1);
});

test('histórico apenas com erros não anuncia uma base válida inexistente', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const abas = {
    BASE_ALUNOS: criarAba([Array.from(config.cabecalhos.alunos)]),
    CONTRATOS: criarAba([Array.from(config.cabecalhos.contratos)]),
    IMPORTACOES: criarAba([
      Array.from(config.cabecalhos.importacoes),
      ['exec-erro', '', '12/07/2026 09:15', 'vencimentos', '', '', '12/07/2026', 'r1', '', '', '', 'ERRO', 'falha']
    ])
  };
  const { gas } = carregarComPlanilha({ getSheetByName: nome => abas[nome] || null }, criarCache());

  const resultado = gas.obterDadosPaginaDashboard('planos', {});

  assert.equal(resultado.atualizadoEm, '');
  assert.equal(resultado.avisoImportacao, '');
});

test('data inválida com PII não aparece na resposta nem nos logs', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const pii = 'ALUNA SEGREDO 85999999999';
  const logs = [];
  const abas = {
    BASE_ALUNOS: criarAba([Array.from(config.cabecalhos.alunos)]),
    CONTRATOS: criarAba([Array.from(config.cabecalhos.contratos)]),
    IMPORTACOES: criarAba([
      Array.from(config.cabecalhos.importacoes),
      ['exec-ok', '', '11/07/2026 08:05', 'vencimentos', '', '', '11/07/2026', 'r1', '', '', '', 'SUCESSO', 'OK'],
      ['exec-erro', '', pii, 'vencimentos', '', '', pii, 'r2', '', '', '', 'ERRO', pii]
    ])
  };
  const { gas } = carregarComPlanilha(
    { getSheetByName: nome => abas[nome] || null },
    criarCache(),
    { console: { error: (...argumentos) => logs.push(argumentos) } }
  );

  const resultado = gas.obterDadosPaginaDashboard('planos', {});

  assert.equal(resultado.avisoImportacao, 'A última tentativa de atualização falhou. Exibindo a última base válida.');
  assert.equal(JSON.stringify(resultado).includes(pii), false);
  assert.equal(JSON.stringify(logs).includes(pii), false);
});

test('dataAvisoImportacaoDashboard_ aceita somente formatos conhecidos e válidos', () => {
  const gas = loadGas(FILES);

  assert.equal(gas.dataAvisoImportacaoDashboard_(new Date(2026, 6, 12, 9, 15)), '12/07/2026');
  assert.equal(gas.dataAvisoImportacaoDashboard_('12/07/2026'), '12/07/2026');
  assert.equal(gas.dataAvisoImportacaoDashboard_('12/07/2026 09:15'), '12/07/2026');
  assert.equal(gas.dataAvisoImportacaoDashboard_('2026-07-12'), '12/07/2026');
  assert.equal(gas.dataAvisoImportacaoDashboard_('2026-07-12T09:15:00Z'), '12/07/2026');
  assert.equal(gas.dataAvisoImportacaoDashboard_('31/02/2026'), '');
  assert.equal(gas.dataAvisoImportacaoDashboard_('ALUNA SEGREDO 85999999999'), '');
});

test('sucesso mais recente não gera aviso de importação', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const abas = {
    BASE_ALUNOS: criarAba([Array.from(config.cabecalhos.alunos)]),
    CONTRATOS: criarAba([Array.from(config.cabecalhos.contratos)]),
    IMPORTACOES: criarAba([
      Array.from(config.cabecalhos.importacoes),
      ['exec-erro', '', '11/07/2026 08:05', 'vencimentos', '', '', '11/07/2026', 'r1', '', '', '', 'ERRO', 'segredo'],
      ['exec-ok', '', '12/07/2026 09:15', 'avaliacao_fisica', '', '', '12/07/2026', 'r2', '', '', '', 'SUCESSO', 'OK']
    ])
  };
  const { gas } = carregarComPlanilha({ getSheetByName: nome => abas[nome] || null }, criarCache());

  const resultado = gas.obterDadosPaginaDashboard('planos', {});

  assert.equal(resultado.avisoImportacao, '');
});

test('obterDadosPaginaDashboard ignora cache JSON válido fora do contrato e recalcula', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const formatosInvalidos = [
    'null',
    '{}',
    JSON.stringify({ ok: true, pagina: 'vencimentos', dados: {} }),
    JSON.stringify({ ok: true, pagina: 'vencimentos', atualizadoEm: '', avisoImportacao: '', dados: {} }),
    JSON.stringify({ ok: true, pagina: 'planos', atualizadoEm: '', avisoImportacao: '', dados: {} })
  ];

  formatosInvalidos.forEach((conteudo, indice) => {
    const abas = {
      BASE_ALUNOS: criarAba([Array.from(config.cabecalhos.alunos)]),
      CONTRATOS: criarAba([Array.from(config.cabecalhos.contratos)]),
      IMPORTACOES: criarAba([Array.from(config.cabecalhos.importacoes)])
    };
    const cache = criarCache();
    const { gas, aberturas } = carregarComPlanilha({ getSheetByName: nome => abas[nome] || null }, cache);
    cache.valores.set(gas.chaveCacheDashboard_('vencimentos', { caso: indice }), conteudo);

    const resultado = gas.obterDadosPaginaDashboard('vencimentos', { caso: indice });

    assert.equal(resultado.ok, true);
    assert.equal(resultado.pagina, 'vencimentos');
    assert.deepEqual(JSON.parse(JSON.stringify(resultado.dados.kpis)), { vencidos: 0, ate7: 0, ate30: 0, valorAte30: 0 });
    assert.equal(aberturas(), 1);
  });
});

test('chaveCacheDashboard_ mantém filtros grandes dentro do limite do Apps Script', () => {
  const gas = loadGas(FILES);
  const chaveA = gas.chaveCacheDashboard_('vencimentos', { busca: 'A'.repeat(500) });
  const chaveB = gas.chaveCacheDashboard_('vencimentos', { busca: 'B'.repeat(500) });

  assert.ok(chaveA.length <= 250);
  assert.notEqual(chaveA, chaveB);
});

test('obterDadosPaginaDashboard oculta erro interno e não registra PII', () => {
  const logs = [];
  const cache = criarCache();
  const broken = loadGas(FILES, {
    SpreadsheetApp: {
      openById() {
        const erro = new Error('linha 2: ALUNA SEGREDO contato 85999999999');
        erro.name = 'ALUNA SEGREDO 85999999999';
        throw erro;
      }
    },
    CacheService: { getScriptCache: () => cache },
    console: { error: (...argumentos) => logs.push(argumentos) }
  });

  assert.throws(
    () => broken.obterDadosPaginaDashboard('vencimentos', {}),
    /^Error: Não foi possível carregar o dashboard\.$/
  );
  const textoLog = JSON.stringify(logs);
  assert.equal(textoLog.includes('ALUNA SEGREDO'), false);
  assert.equal(textoLog.includes('85999999999'), false);
  assert.equal(textoLog.includes('linha 2'), false);
});

test('obterDadosPaginaDashboard trata JSON inválido do cache como miss', () => {
  const logs = [];
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const abas = {
    BASE_ALUNOS: criarAba([Array.from(config.cabecalhos.alunos)]),
    CONTRATOS: criarAba([Array.from(config.cabecalhos.contratos)]),
    IMPORTACOES: criarAba([Array.from(config.cabecalhos.importacoes)])
  };
  const cache = { get: () => '{ALUNA SEGREDO 85999999999', put: () => {} };
  const { gas, aberturas } = carregarComPlanilha(
    { getSheetByName: nome => abas[nome] || null }, cache,
    { console: { error: (...argumentos) => logs.push(argumentos) } }
  );

  const resultado = gas.obterDadosPaginaDashboard('vencimentos', {});
  assert.equal(resultado.ok, true);
  assert.equal(aberturas(), 1);
  assert.equal(JSON.stringify(logs).includes('ALUNA SEGREDO'), false);
  assert.equal(JSON.stringify(logs).includes('85999999999'), false);
});

test('normaliza filtros, paginação e inclui tudo na chave de cache', () => {
  const gas = loadGas(FILES);
  const normalizados = gas.normalizarFiltrosDashboard_({
    busca: '  Maria  ', polo: ' POLO A ', periodoDias: '90', paginaLista: '3', limite: '999',
    frequencia: ' 2X ', modalidade: ' MUSCULAÇÃO ', statusContrato: ' Ativo ', situacao: ' ate7 ',
    desconhecido: 'ignorar'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(normalizados)), {
    busca: 'Maria', polo: 'POLO A', periodoDias: '90', paginaLista: 3, limite: 100,
    frequencia: '2X', modalidade: 'MUSCULAÇÃO', statusContrato: 'Ativo', situacao: 'ate7'
  });
  assert.notEqual(
    gas.chaveCacheDashboard_('planos', normalizados),
    gas.chaveCacheDashboard_('planos', { ...normalizados, paginaLista: 4 })
  );
});

test('período selecionado fora da whitelist produz população vazia', () => {
  const gas = loadGas(FILES);
  const filtros = gas.normalizarFiltrosDashboard_({ periodoDias: '365' });
  assert.equal(filtros.periodoDias, '__INVALIDO__');
  const filtrada = gas.filtrarBaseDashboard_(
    [{ id: '1', aluno: 'TESTE', status: 'Ativo' }],
    [{ _chave_contrato: 'c1', id: '1', vencimento: new Date(2026, 6, 20) }],
    filtros, new Date(2026, 6, 11), 'planos'
  );
  assert.deepEqual(filtrada.alunos, []);
  assert.deepEqual(filtrada.contratos, []);
});

test('API pagina lista mantendo totais globais e opções originais completas', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const alunosRows = [Array.from(config.cabecalhos.alunos)];
  const contratosRows = [Array.from(config.cabecalhos.contratos)];
  for (let i = 1; i <= 3; i += 1) {
    alunosRows.push([String(i), `ALUNO ${i}`, `850000000${i}`, 'Ativo', '', '', '', 'exec']);
    contratosRows.push([`c${i}`, String(i), '', `${i}X`, i * 100, new Date(2026, 5, i), new Date(2026, 7, i), 'Ativo', `POLO ${i}`, `MOD ${i}`, 'exec']);
  }
  const abas = {
    BASE_ALUNOS: criarAba(alunosRows), CONTRATOS: criarAba(contratosRows),
    IMPORTACOES: criarAba([Array.from(config.cabecalhos.importacoes)])
  };
  const { gas } = carregarComPlanilha({ getSheetByName: nome => abas[nome] || null }, criarCache());
  const resultado = gas.obterDadosPaginaDashboard('planos', { paginaLista: 2, limite: 1 });
  assert.equal(resultado.dados.lista.length, 1);
  assert.equal(resultado.dados.kpis.contratos, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(resultado.dados.paginacao)), { pagina: 2, limite: 1, totalItens: 3, totalPaginas: 3 });
  assert.deepEqual(JSON.parse(JSON.stringify(resultado.dados.filtros.polos)), ['POLO 1', 'POLO 2', 'POLO 3']);
  assert.equal(resultado.dados.filtros.frequencias.length, 3);
  assert.equal(resultado.dados.filtros.modalidades.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(resultado.dados.filtros.statusContratos)), ['Ativo']);
});

test('obterDadosPaginaDashboard devolve dados calculados quando a gravação do cache falha', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const abas = {
    BASE_ALUNOS: criarAba([Array.from(config.cabecalhos.alunos)]),
    CONTRATOS: criarAba([Array.from(config.cabecalhos.contratos)]),
    IMPORTACOES: criarAba([Array.from(config.cabecalhos.importacoes)])
  };
  const cache = {
    get: () => null,
    put() { throw new Error('cache contém ALUNA SEGREDO 85999999999'); }
  };
  const { gas } = carregarComPlanilha({ getSheetByName: nome => abas[nome] || null }, cache);

  const resultado = gas.obterDadosPaginaDashboard('planos', {});

  assert.equal(resultado.ok, true);
  assert.equal(resultado.pagina, 'planos');
});

test('bootstrap inclui perfis, catálogo e contato necessário ao detalhamento', () => {
  const config = loadGas(['apps-script/00_Config.gs']).CONFIG;
  const abas = {
    BASE_ALUNOS: criarAba([
      Array.from(config.cabecalhos.alunos),
      ['1', 'ALUNA TESTE', '85999999999', 'Ativo', '', new Date(2026, 6, 1), '', 'exec-1']
    ]),
    CONTRATOS: criarAba([
      Array.from(config.cabecalhos.contratos),
      ['c1', '1', '2X - WELLNESS - PERSONAL', '2X', 433, '', new Date(2026, 6, 20), 'Ativo', 'Wellness', 'PERSONAL', 'exec-1']
    ]),
    IMPORTACOES: criarAba([
      Array.from(config.cabecalhos.importacoes),
      ['exec-1', '', '27/07/2026 19:34', 'vencimentos', '', '', '2026-07-27', 'r1', '', '', '', 'SUCESSO', 'OK']
    ]),
    CONFIG_DASHBOARD: criarAba([
      Array.from(config.cabecalhos.configDashboard),
      ['filtros', 'globais', true, 0, '{"status":"Ativo","polo":"Wellness"}', 'Filtros padrão', '']
    ]),
    CONFIG_ALERTAS: criarAba([
      Array.from(config.cabecalhos.configAlertas),
      ['alertas', 'prescricoes', true, 10, '{"laranja":90,"vermelho":180,"roxo":270}', 'Prescrições', ''],
      ['alertas', 'avaliacoes', true, 20, '{"laranja":90,"vermelho":120,"roxo":180,"critico":270}', 'Avaliações', '']
    ]),
    GESTAO_PAGAMENTOS: criarAba([
      Array.from(config.cabecalhos.gestaoPagamentos),
      ['1', 'ALUNA TESTE', 'Bom pagador', 'Observação interna', '27/07/2026 19:30']
    ]),
    PERFIS_ALUNOS: criarAba([
      Array.from(config.cabecalhos.perfisAlunos),
      ['1', 'ALUNA TESTE', 'Elohim', '["Elohim"]', 'Bom pagador', 'Observação interna', '["idoso","saude"]', '["risco_de_churn"]', 'Prefere manhã', '27/07/2026 19:30']
    ]),
    CONFIG_PERFIS_ALUNOS: criarAba([
      Array.from(config.cabecalhos.configPerfisAlunos),
      ['etiqueta', 'publico', 'idoso', 'Idoso', true, 10],
      ['etiqueta', 'publico', 'saude', 'Saúde', true, 20],
      ['etiqueta', 'comercial', 'risco_de_churn', 'Risco de Churn', true, 10]
    ])
  };
  const values = new Map([['tecnofit.dashboard.versao', '7']]);
  const { gas } = carregarComPlanilha(
    { getSheetByName: nome => abas[nome] || null },
    criarCache(),
    { PropertiesService: { getDocumentProperties: () => ({ getProperty: key => values.get(key) || null }) } }
  );

  const resposta = gas.obterBootstrapDashboard();

  assert.match(
    resposta.versao,
    /^importacao:exec-1\|config:7\|fluxo:FLUXO_LEADS:1:[a-z0-9]+\|FLUXO_CHURNS:1:[a-z0-9]+$/
  );
  assert.equal(resposta.atualizadoEm, '27/07/2026 19:34');
  assert.deepEqual(JSON.parse(JSON.stringify(resposta.filtrosPadrao)), {
    status: '__matriculados__', polo: 'Wellness'
  });
  assert.equal(resposta.alunos[0].contato, '85999999999');
  assert.equal(resposta.perfisAlunos[0].id, '1');
  assert.deepEqual(JSON.parse(JSON.stringify(resposta.perfisAlunos[0].ultimosProfessores)), ['Elohim']);
  assert.deepEqual(JSON.parse(JSON.stringify(resposta.perfisAlunos[0].etiquetasPublico)), ['idoso', 'saude']);
  assert.equal(resposta.catalogoPerfisAlunos.some(item => item.chave === 'risco_de_churn'), true);
  assert.equal(resposta.configuracao.perfisPagamento[0].perfilPagamento, 'Bom pagador');
});

test('bootstrap resolve Wellness para o nome real do polo sem descartar contratos', () => {
  const gas = loadGas(FILES);
  assert.equal(
    gas.resolverPoloPadraoDashboard_('Wellness', [
      { polo: 'XSTEAM WELLNESS CLUB' }, { polo: 'GREENLIFE' }
    ]),
    'XSTEAM WELLNESS CLUB'
  );
  assert.equal(gas.resolverPoloPadraoDashboard_('Polo inexistente', [{ polo: 'GREENLIFE' }]), '');
});
