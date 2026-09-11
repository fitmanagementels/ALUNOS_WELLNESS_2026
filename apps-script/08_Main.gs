function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TecnoFit')
    .addItem('Abrir painel', 'abrirPainel')
    .addItem('Abrir dashboard', 'abrirDashboard')
    .addItem('Preencher IDs pendentes de Fluxo', 'preencherIdsPendentesFluxo')
    .addItem('Gerar prévia de transição de Churns', 'gerarPreviaTransicaoChurns')
    .addToUi();
}

function preencherIdsPendentesNaAbaFluxo_(aba, cabecalhos) {
  if (!aba || aba.getLastRow() < 1) throw new Error('Aba de Fluxo não encontrada.');
  var valores = aba.getRange(1, 1, aba.getLastRow(), cabecalhos.length).getValues();
  cabecalhos.forEach(function (cabecalho, indice) {
    if (String(valores[0][indice]) !== cabecalho) throw new Error('Estrutura de Fluxo incompatível.');
  });
  var preenchidos = 0;
  valores.slice(1).forEach(function (linha, indice) {
    var possuiId = String(linha[0] == null ? '' : linha[0]).trim();
    var possuiDados = linha.slice(1).some(function (valor) { return valor !== '' && valor != null; });
    if (possuiId || !possuiDados) return;
    aba.getRange(indice + 2, 1).setValue(Utilities.getUuid());
    preenchidos += 1;
  });
  return { preenchidos: preenchidos };
}

function preencherIdsPendentesFluxo() {
  garantirEstruturaPlanilha();
  var planilha = obterPlanilhaMestre_();
  var leads = preencherIdsPendentesNaAbaFluxo_(
    planilha.getSheetByName(CONFIG.abas.fluxoLeads), CONFIG.cabecalhos.fluxoLeads
  );
  var churns = preencherIdsPendentesNaAbaFluxo_(
    planilha.getSheetByName(CONFIG.abas.fluxoChurns), CONFIG.cabecalhos.fluxoChurns
  );
  SpreadsheetApp.flush();
  incrementarVersaoDashboard_();
  SpreadsheetApp.getUi().alert(
    'IDs de Fluxo preenchidos: ' + leads.preenchidos + ' Lead(s) e ' + churns.preenchidos + ' Churn(s).'
  );
  return { leads: leads.preenchidos, churns: churns.preenchidos };
}

function abrirPainel() {
  var html = HtmlService.createTemplateFromFile('Sidebar')
    .evaluate()
    .setTitle('TecnoFit — Atualização');
  SpreadsheetApp.getUi().showSidebar(html);
}

function obterStatusImportacao() {
  garantirEstruturaPlanilha();
  var inspecao = inspecionarPastaEntrada();
  return {
    ready: inspecao.ready,
    lote: inspecao.lote,
    ultimaImportacao: obterUltimaImportacaoBemSucedida(),
    erros: inspecao.erros
  };
}

function executarImportacao() {
  return executarImportacaoBackend_();
}

function incluirArquivo_(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

function doGet() {
  return HtmlService.createHtmlOutput('<!doctype html><title>XSTEAM API</title><p>Backend XSTEAM ativo.</p>');
}

function doPost(e) {
  return responderApiPublicaDashboard_(e);
}

function obterUrlDashboard() {
  var urlConfigurada = String(PropertiesService.getScriptProperties()
    .getProperty(CONFIG.dashboard.propriedadeUrlPwa) || '').trim();
  return urlConfigurada || 'https://fitmanagementels.github.io/ALUNOS_WELLNESS_2026/';
}

function abrirDashboard() {
  var url = obterUrlDashboard();
  if (!url) throw new Error('Publique o PWA antes de abrir o dashboard.');
  var html = HtmlService.createHtmlOutput(
    '<script>window.open(' + JSON.stringify(url) + ', "_blank");google.script.host.close();</script>'
  ).setWidth(10).setHeight(10);
  SpreadsheetApp.getUi().showModalDialog(html, 'Abrindo dashboard');
}
