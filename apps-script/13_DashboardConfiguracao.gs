var DASHBOARD_CONFIGURACAO_PADRAO = Object.freeze({
  dashboard: Object.freeze([
    Object.freeze(['filtros', 'globais', true, 0, '{"status":"__matriculados__","polo":"XSTEAM WELLNESS CLUB"}', 'Filtros padrão', '']),
    Object.freeze(['home_card', 'fila_prescricoes', true, 1, '', 'Fichas / prescrições', '[]']),
    Object.freeze(['home_card', 'fila_avaliacoes', true, 2, '', 'Avaliações', '[]']),
    Object.freeze(['home_card', 'agenda_financeira', true, 3, '', 'Agenda financeira', '[]'])
  ]),
  alertas: Object.freeze([
    Object.freeze(['alertas', 'prescricoes', true, 10, '{"laranja":90,"vermelho":180,"roxo":270}', 'Prescrições', '']),
    Object.freeze(['alertas', 'avaliacoes', true, 20, '{"laranja":90,"vermelho":120,"roxo":180,"critico":270}', 'Avaliações', ''])
  ]),
  perfisPagamento: Object.freeze([
    'Sem histórico',
    'Bom pagador',
    'Pagamento eventual fora do prazo',
    'Pagamento frequentemente fora do prazo',
    'Cobrança recorrente necessária',
    'Em acompanhamento'
  ])
});

function garantirAbaConfiguracaoDashboard_(planilha, nomeAba, cabecalhos, linhasPadrao) {
  var aba = planilha.getSheetByName(nomeAba) || planilha.insertSheet(nomeAba);
  if (aba.getMaxColumns() < cabecalhos.length) {
    aba.insertColumnsAfter(aba.getMaxColumns(), cabecalhos.length - aba.getMaxColumns());
  }
  aba.getRange(1, 1, 1, cabecalhos.length)
    .setValues([cabecalhos])
    .setFontWeight('bold')
    .setBackground('#14324A')
    .setFontColor('#FFFFFF');
  aba.setFrozenRows(1);

  if (linhasPadrao.length && aba.getLastRow() < 2) {
    aba.getRange(2, 1, linhasPadrao.length, cabecalhos.length).setValues(linhasPadrao);
  }
  var protecoes = aba.getProtections(SpreadsheetApp.ProtectionType.RANGE).filter(function (protecao) {
    return protecao.getDescription() === 'TecnoFit - cabeçalho';
  });
  if (!protecoes.length) {
    aba.getRange(1, 1, 1, cabecalhos.length)
      .protect()
      .setDescription('TecnoFit - cabeçalho')
      .setWarningOnly(true);
  }
  return aba;
}

function garantirConfiguracoesDashboardNaPlanilha_(planilha) {
  garantirAbaConfiguracaoDashboard_(
    planilha,
    CONFIG.abas.configDashboard,
    CONFIG.cabecalhos.configDashboard,
    DASHBOARD_CONFIGURACAO_PADRAO.dashboard
  );
  garantirAbaConfiguracaoDashboard_(
    planilha,
    CONFIG.abas.configAlertas,
    CONFIG.cabecalhos.configAlertas,
    DASHBOARD_CONFIGURACAO_PADRAO.alertas
  );
  garantirAbaConfiguracaoDashboard_(
    planilha,
    CONFIG.abas.gestaoPagamentos,
    CONFIG.cabecalhos.gestaoPagamentos,
    []
  );
  garantirPerfisAlunosNaPlanilha_(planilha);
  SpreadsheetApp.flush();
}

function garantirConfiguracoesDashboard_() {
  garantirConfiguracoesDashboardNaPlanilha_(obterPlanilhaMestre_());
}

function obterVersaoDashboard_() {
  var propriedades = PropertiesService.getDocumentProperties();
  return Number(propriedades.getProperty(CONFIG.dashboard.propriedadeVersao) || 0);
}

function incrementarVersaoDashboard_() {
  var propriedades = PropertiesService.getDocumentProperties();
  var proximaVersao = obterVersaoDashboard_() + 1;
  propriedades.setProperty(CONFIG.dashboard.propriedadeVersao, String(proximaVersao));
  return proximaVersao;
}

function obterVersaoChurnDashboard_() {
  var propriedades = PropertiesService.getDocumentProperties();
  return Number(propriedades.getProperty(CONFIG.dashboard.propriedadeVersaoChurn) || 0);
}

function incrementarVersaoChurnDashboard_() {
  var propriedades = PropertiesService.getDocumentProperties();
  var proximaVersao = obterVersaoChurnDashboard_() + 1;
  propriedades.setProperty(CONFIG.dashboard.propriedadeVersaoChurn, String(proximaVersao));
  return proximaVersao;
}
