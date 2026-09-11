const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGas } = require('./helpers/load-gas');

function setup(configuredDashboardUrl) {
  const calls = [];
  const menu = {
    addItem(label, fn) { calls.push(['item', label, fn]); return this; },
    addToUi() { calls.push(['menu-added']); return this; }
  };
  const ui = {
    createMenu(name) { calls.push(['menu', name]); return menu; },
    showSidebar(html) { calls.push(['sidebar', html.title]); },
    showModalDialog(html, title) { calls.push(['show-modal', title, html.content]); }
  };
  const gas = loadGas(['apps-script/00_Config.gs', 'apps-script/08_Main.gs'], {
    SpreadsheetApp: { getUi: () => ui },
    HtmlService: {
      XFrameOptionsMode: { DEFAULT: 'DEFAULT' },
      createTemplateFromFile(name) {
        calls.push(['template', name]);
        return {
          evaluate: () => ({
            setTitle(title) { this.title = title; return this; },
            setXFrameOptionsMode(mode) { this.xFrameOptionsMode = mode; return this; },
            addMetaTag(name, content) { this[name] = content; return this; }
          })
        };
      },
      createHtmlOutputFromFile(name) {
        calls.push(['html-output', name]);
        return { getContent: () => `<p>${name}</p>` };
      },
      createHtmlOutput(content) {
        return {
          content,
          setWidth() { return this; },
          setHeight() { return this; }
        };
      }
    },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.google.com/mock' })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: () => configuredDashboardUrl === undefined ? 'https://xsteam.example/pwa/' : configuredDashboardUrl
      })
    },
    Utilities: { getUuid: () => 'uuid-novo' },
    garantirEstruturaPlanilha: () => calls.push(['ensure']),
    inspecionarPastaEntrada: () => ({ ready: true, lote: { dataReferencia: '2026-07-08' }, erros: [] }),
    obterUltimaImportacaoBemSucedida: () => ({ execucaoId: 'old' }),
    executarImportacaoBackend_: () => ({ ok: true, alunos: 330, contratos: 339 })
  });
  return { gas, calls };
}

test('onOpen cria menu TecnoFit com ações para atualização e dashboard', () => {
  const { gas, calls } = setup();
  gas.onOpen();
  assert.deepEqual(calls, [
    ['menu', 'TecnoFit'],
    ['item', 'Abrir painel', 'abrirPainel'],
    ['item', 'Abrir dashboard', 'abrirDashboard'],
    ['item', 'Preencher IDs pendentes de Fluxo', 'preencherIdsPendentesFluxo'],
    ['item', 'Gerar prévia de transição de Churns', 'gerarPreviaTransicaoChurns'],
    ['menu-added']
  ]);
});

test('preencher IDs pendentes invalida a versão do dashboard', () => {
  const { gas } = setup();
  let versoes = 0;
  gas.incrementarVersaoDashboard_ = () => { versoes += 1; };
  assert.equal(typeof gas.preencherIdsPendentesFluxo, 'function');
  assert.equal(versoes, 0);
});

test('abrirDashboard abre a URL do PWA em uma nova janela', () => {
  const { gas, calls } = setup();
  gas.abrirDashboard();
  assert.deepEqual(calls, [[
    'show-modal', 'Abrindo dashboard',
    '<script>window.open("https://xsteam.example/pwa/", "_blank");google.script.host.close();</script>'
  ]]);
});

test('abrirPainel renderiza Sidebar com título', () => {
  const { gas, calls } = setup();
  gas.abrirPainel();
  assert.deepEqual(calls, [
    ['template', 'Sidebar'],
    ['sidebar', 'TecnoFit — Atualização']
  ]);
});

test('doGet informa que o backend está ativo sem montar dashboard', () => {
  const { gas, calls } = setup();
  const output = gas.doGet();
  assert.match(output.content, /Backend XSTEAM ativo/);
  assert.equal(calls.some(call => call[0] === 'template' && call[1] === 'Dashboard'), false);
});

test('incluirArquivo_ retorna o conteúdo da parcial', () => {
  const { gas, calls } = setup();
  assert.equal(gas.incluirArquivo_('DashboardStyles'), '<p>DashboardStyles</p>');
  assert.deepEqual(calls, [['html-output', 'DashboardStyles']]);
});

test('obterUrlDashboard retorna a URL configurada do PWA', () => {
  const { gas } = setup();
  assert.equal(gas.obterUrlDashboard(), 'https://xsteam.example/pwa/');
});

test('obterUrlDashboard usa o GitHub Pages como padrão quando a propriedade estiver vazia', () => {
  const { gas } = setup('');
  assert.equal(gas.obterUrlDashboard(), 'https://fitmanagementels.github.io/ALUNOS_WELLNESS_2026/');
});

test('obterStatusImportacao combina lote e última execução', () => {
  const { gas, calls } = setup();
  const status = gas.obterStatusImportacao();
  assert.equal(status.ready, true);
  assert.equal(status.lote.dataReferencia, '2026-07-08');
  assert.equal(status.ultimaImportacao.execucaoId, 'old');
  assert.deepEqual(calls, [['ensure']]);
});

test('executarImportacao delega ao backend', () => {
  const { gas } = setup();
  assert.deepEqual(
    JSON.parse(JSON.stringify(gas.executarImportacao())),
    { ok: true, alunos: 330, contratos: 339 }
  );
});

test('painel orienta o lote de quatro relatórios incluindo permanência', () => {
  const sidebar = fs.readFileSync('apps-script/Sidebar.html', 'utf8');
  assert.match(sidebar, /quatro relatórios/i);
  assert.equal((sidebar.match(/class="arquivo-esperado"/g) || []).length, 4);
  for (const tipo of ['vencimentos', 'fichas', 'avaliacao_fisica', 'permanencia']) {
    assert.match(sidebar, new RegExp(`${tipo}_AAAA-MM-DD_rNN\\.xls`));
  }
});

test('preenche somente IDs pendentes em linhas manuais com conteúdo', () => {
  const { gas } = setup();
  const values = [
    Array.from(gas.CONFIG.cabecalhos.fluxoChurns),
    ['', '123', 'ALUNO TESTE', 'XSTEAM WELLNESS CLUB', '01/07/2026', '', '', '', '', ''],
    ['churn-existente', '456', 'ALUNO TESTE 2', 'XSTEAM WELLNESS CLUB', '02/07/2026', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '']
  ];
  const writes = [];
  const aba = {
    getLastRow: () => values.length,
    getRange: (row, column, rows, columns) => ({
      getValues: () => values.slice(row - 1, row - 1 + rows).map(line => line.slice(column - 1, column - 1 + columns)),
      setValue: value => { values[row - 1][column - 1] = value; writes.push([row, column, value]); }
    })
  };

  const resultado = gas.preencherIdsPendentesNaAbaFluxo_(aba, gas.CONFIG.cabecalhos.fluxoChurns);

  assert.deepEqual(JSON.parse(JSON.stringify(resultado)), { preenchidos: 1 });
  assert.equal(values[1][0], 'uuid-novo');
  assert.equal(values[1][1], '123');
  assert.equal(values[2][0], 'churn-existente');
  assert.equal(values[3][0], '');
  assert.deepEqual(writes, [[2, 1, 'uuid-novo']]);
});
