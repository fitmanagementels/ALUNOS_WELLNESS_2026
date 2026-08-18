# Perfis de Alunos na Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar à Home do PWA uma grade filtrável de perfis de alunos, com detalhe e configuração persistente em abas manuais da planilha.

**Architecture:** Manter Apps Script V8 e o PWA ES5 sem bundler. Dados manuais ficam em `PERFIS_ALUNOS`, catálogos em `CONFIG_PERFIS_ALUNOS` e chegam pelo bootstrap; a interface nova fica isolada em um módulo UMD e uma folha de estilos próprios. A integração com os arquivos compartilhados será pequena e ocorrerá somente depois da atualização concorrente da Home.

**Tech Stack:** Google Apps Script V8, Google Sheets, JavaScript ES5 sem framework, HTML/CSS responsivo, Node.js 20 `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-18-perfis-alunos-home-design.md`

## Global Constraints

- Repositório de execução: `/home/elohimlima/Downloads/VSCODE|ANTIGRAVITY/BASE_TECNOFIT`.
- Incorporar primeiro o trabalho concorrente da Home; não editar em paralelo `dashboard.js` ou `dashboard.css`.
- Não alterar as abas geradas pela importação TecnoFit.
- Não apagar nem sobrescrever `GESTAO_PAGAMENTOS` durante a migração.
- Um perfil manual é identificado somente pelo ID do aluno.
- Etiquetas são arrays JSON e pertencem estritamente aos grupos `publico` ou `comercial`.
- Um aluno possui no máximo um professor responsável.
- Agenda fica apenas visualmente desabilitada como `Em breve`.
- Não adicionar dependências nem usar `innerHTML`.
- Preservar o estilo XSTEAM, alvos de 44 px, foco visível e ausência de rolagem horizontal.

---

### Task 1: Reconciliar o trabalho concorrente antes de tocar a Home

**Files:**
- Inspect: `pwa/js/dashboard.js`
- Inspect: `pwa/css/dashboard.css`
- Inspect: `pwa/index.html`
- Inspect: `apps-script/13_DashboardConfiguracao.gs`
- Inspect: `apps-script/14_DashboardMutacoes.gs`

**Interfaces:**
- Consumes: versão da Home já incorporada pelo outro agente.
- Produces: baseline limpo e os pontos atuais de integração registrados na execução do plano.

- [ ] **Step 1: Confirmar branch, worktree e alterações existentes**

Run:

```bash
cd '/home/elohimlima/Downloads/VSCODE|ANTIGRAVITY/BASE_TECNOFIT'
git status --short
git log --oneline -8
git diff -- pwa/js/dashboard.js pwa/css/dashboard.css pwa/index.html apps-script/13_DashboardConfiguracao.gs apps-script/14_DashboardMutacoes.gs
```

Expected: o trabalho da outra Home está commitado ou seu diff está claramente identificado. Se houver edição não commitada nesses cinco arquivos, parar esta execução e incorporar/commitá-la antes da Task 2.

- [ ] **Step 2: Localizar os pontos de encaixe atuais**

Run:

```bash
grep -nE 'function (renderHome|renderSettings|applyBootstrap|aplicarMutacaoOtimista|enqueue|salvarMutacoesDashboard)' pwa/js/dashboard.js apps-script/14_DashboardMutacoes.gs
grep -nE 'dashboard\.css|dashboard\.js|app\.js' pwa/index.html pwa/sw.js
```

Expected: cada função e asset possui um único ponto de definição/carregamento. Usar essas linhas atuais, não as linhas do código anterior à atualização concorrente.

---

### Task 2: Criar o schema, catálogo inicial e migração idempotente

**Files:**
- Modify: `apps-script/00_Config.gs`
- Create: `apps-script/18_DashboardPerfisAlunos.gs`
- Modify: `apps-script/13_DashboardConfiguracao.gs`
- Modify: `tests/dashboard-configuracao.test.js`

**Interfaces:**
- Consumes: `garantirAbaConfiguracaoDashboard_(planilha, nome, cabecalhos, linhas)` e a aba legada `GESTAO_PAGAMENTOS`.
- Produces: `CATALOGO_PERFIS_ALUNOS_PADRAO`, `garantirPerfisAlunosNaPlanilha_(planilha)` e as abas `PERFIS_ALUNOS`/`CONFIG_PERFIS_ALUNOS`.

- [ ] **Step 1: Escrever o teste falhando de schema, catálogo e migração**

Em `tests/dashboard-configuracao.test.js`, fazer `RangeMock` conservar os valores escritos sem remover o array `writes` usado pelos testes atuais:

```js
getValues() {
  return this.sheet.values.slice(this.row - 1, this.row - 1 + this.rows)
    .map(row => row.slice(this.column - 1, this.column - 1 + this.columns));
}
setValues(values) {
  this.sheet.writes.push({ row: this.row, column: this.column, values });
  values.forEach((source, rowIndex) => {
    const targetIndex = this.row - 1 + rowIndex;
    const target = this.sheet.values[targetIndex] || (this.sheet.values[targetIndex] = []);
    source.forEach((value, columnIndex) => { target[this.column - 1 + columnIndex] = value; });
  });
  return this;
}
```

Trocar o construtor de `SheetMock` e `getLastRow` por:

```js
constructor(name, values = []) {
  this.name = name;
  this.values = values.map(row => row.slice());
  this.writes = [];
}
getLastRow() { return this.values.length; }
```

Adicionar este helper no teste:

```js
function setupConfigurationSheets(initial = {}) {
  const sheets = {};
  Object.entries(initial).forEach(([name, values]) => { sheets[name] = new SheetMock(name, values); });
  const spreadsheet = {
    getSheetByName: name => sheets[name] || null,
    insertSheet(name) { sheets[name] = new SheetMock(name); return sheets[name]; }
  };
  const gas = loadGas([
    'apps-script/00_Config.gs',
    'apps-script/18_DashboardPerfisAlunos.gs',
    'apps-script/13_DashboardConfiguracao.gs'
  ], { SpreadsheetApp: { ProtectionType: { RANGE: 'RANGE' }, flush() {} } });
  return { gas, spreadsheet, sheets };
}
```

Então adicionar:

```js
test('cria perfis e catálogo e migra pagamentos sem alterar o legado', () => {
  const { gas, spreadsheet, sheets } = setupConfigurationSheets({
    GESTAO_PAGAMENTOS: [
      ['id', 'aluno', 'perfil_pagamento', 'observacao', 'atualizado_em'],
      ['42', 'ALUNA TESTE', 'Bom pagador', 'Paga em dia', '17/08/2026 10:00']
    ]
  });

  gas.garantirConfiguracoesDashboardNaPlanilha_(spreadsheet);
  gas.garantirConfiguracoesDashboardNaPlanilha_(spreadsheet);

  assert.deepEqual(sheets.PERFIS_ALUNOS.values[0], [
    'id', 'aluno', 'professor_responsavel', 'perfil_pagamento',
    'observacao_pagamento', 'etiquetas_publico', 'etiquetas_comerciais',
    'observacoes_gerais', 'atualizado_em'
  ]);
  assert.deepEqual(sheets.PERFIS_ALUNOS.values[1].slice(0, 5), [
    '42', 'ALUNA TESTE', '', 'Bom pagador', 'Paga em dia'
  ]);
  assert.equal(sheets.PERFIS_ALUNOS.values.filter(row => row[0] === '42').length, 1);
  assert.equal(sheets.CONFIG_PERFIS_ALUNOS.values.some(row => row[2] === 'risco_de_churn'), true);
  assert.equal(sheets.GESTAO_PAGAMENTOS.values.length, 2);
});
```

- [ ] **Step 2: Rodar o teste e confirmar a falha**

Run: `node --test tests/dashboard-configuracao.test.js`

Expected: FAIL porque `PERFIS_ALUNOS` ainda não é criada.

- [ ] **Step 3: Declarar as abas e os cabeçalhos**

Adicionar em `CONFIG.abas`:

```js
perfisAlunos: 'PERFIS_ALUNOS',
configPerfisAlunos: 'CONFIG_PERFIS_ALUNOS',
```

Adicionar em `CONFIG.cabecalhos`:

```js
perfisAlunos: Object.freeze([
  'id', 'aluno', 'professor_responsavel', 'perfil_pagamento',
  'observacao_pagamento', 'etiquetas_publico', 'etiquetas_comerciais',
  'observacoes_gerais', 'atualizado_em'
]),
configPerfisAlunos: Object.freeze([
  'tipo', 'grupo', 'chave', 'titulo', 'ativo', 'ordem'
]),
```

- [ ] **Step 4: Implementar o catálogo e a migração no arquivo novo**

Criar `apps-script/18_DashboardPerfisAlunos.gs` com o catálogo completo:

```js
var CATALOGO_PERFIS_ALUNOS_PADRAO = Object.freeze([
  ['professor', 'matriculados', 'iranildo', 'Iranildo', true, 10],
  ['professor', 'matriculados', 'elohim', 'Elohim', true, 20],
  ['professor', 'matriculados', 'xico', 'Xico', true, 30],
  ['professor', 'matriculados', 'aquiles', 'Aquiles', true, 40],
  ['professor', 'matriculados', 'ruan', 'Ruan', true, 50],
  ['professor', 'matriculados', 'cadu', 'Cadu', true, 60],
  ['professor', 'cancelados', 'iranildo', 'Iranildo', true, 10],
  ['professor', 'cancelados', 'elohim', 'Elohim', true, 20],
  ['professor', 'cancelados', 'xico', 'Xico', true, 30],
  ['professor', 'cancelados', 'ruan', 'Ruan', true, 40],
  ['professor', 'cancelados', 'cadu', 'Cadu', true, 50],
  ['professor', 'cancelados', 'wallyson', 'Wallyson', true, 60],
  ['professor', 'cancelados', 'lucas', 'Lucas', true, 70],
  ['professor', 'cancelados', 'genuca', 'Genuca', true, 80],
  ['etiqueta', 'publico', 'idoso', 'Idoso', true, 10],
  ['etiqueta', 'publico', 'saude', 'Saúde', true, 20],
  ['etiqueta', 'publico', 'estetica', 'Estética', true, 30],
  ['etiqueta', 'publico', 'dores', 'Dores', true, 40],
  ['etiqueta', 'publico', 'corrida', 'Corrida', true, 50],
  ['etiqueta', 'comercial', 'risco_de_churn', 'Risco de Churn', true, 10],
  ['etiqueta', 'comercial', 'sem_fidelizacao', 'Sem fidelização', true, 20],
  ['etiqueta', 'comercial', 'elohim', 'Elohim', true, 30],
  ['perfil_pagamento', 'global', 'sem_historico', 'Sem histórico', true, 10],
  ['perfil_pagamento', 'global', 'bom_pagador', 'Bom pagador', true, 20],
  ['perfil_pagamento', 'global', 'eventual_fora_prazo', 'Pagamento eventual fora do prazo', true, 30],
  ['perfil_pagamento', 'global', 'frequente_fora_prazo', 'Pagamento frequentemente fora do prazo', true, 40],
  ['perfil_pagamento', 'global', 'cobranca_recorrente', 'Cobrança recorrente necessária', true, 50],
  ['perfil_pagamento', 'global', 'em_acompanhamento', 'Em acompanhamento', true, 60]
]);

function migrarGestaoPagamentosParaPerfisAlunos_(planilha, abaPerfis) {
  if (abaPerfis.getLastRow() >= 2) return;
  var legada = planilha.getSheetByName(CONFIG.abas.gestaoPagamentos);
  if (!legada || legada.getLastRow() < 2) return;
  var linhas = legada.getRange(2, 1, legada.getLastRow() - 1, CONFIG.cabecalhos.gestaoPagamentos.length).getValues();
  var migradas = linhas.filter(function (linha) { return String(linha[0] || '').trim(); }).map(function (linha) {
    return [linha[0], linha[1], '', linha[2] || 'Sem histórico', linha[3] || '', '[]', '[]', '', linha[4] || ''];
  });
  if (migradas.length) abaPerfis.getRange(2, 1, migradas.length, CONFIG.cabecalhos.perfisAlunos.length).setValues(migradas);
}

function garantirPerfisAlunosNaPlanilha_(planilha) {
  var perfis = garantirAbaConfiguracaoDashboard_(planilha, CONFIG.abas.perfisAlunos, CONFIG.cabecalhos.perfisAlunos, []);
  garantirAbaConfiguracaoDashboard_(planilha, CONFIG.abas.configPerfisAlunos, CONFIG.cabecalhos.configPerfisAlunos, CATALOGO_PERFIS_ALUNOS_PADRAO);
  migrarGestaoPagamentosParaPerfisAlunos_(planilha, perfis);
}
```

Chamar `garantirPerfisAlunosNaPlanilha_(planilha)` ao final de `garantirConfiguracoesDashboardNaPlanilha_`, antes de `SpreadsheetApp.flush()`.

- [ ] **Step 5: Rodar o teste**

Run: `node --test tests/dashboard-configuracao.test.js`

Expected: PASS, com uma única linha migrada após duas inicializações.

- [ ] **Step 6: Commit**

```bash
git add apps-script/00_Config.gs apps-script/13_DashboardConfiguracao.gs apps-script/18_DashboardPerfisAlunos.gs tests/dashboard-configuracao.test.js
git commit -m "feat: add student profile sheets and migration"
```

---

### Task 3: Ler perfis e catálogos no bootstrap

**Files:**
- Modify: `apps-script/11_DashboardRepositorio.gs`
- Modify: `apps-script/12_DashboardApi.gs`
- Modify: `apps-script/18_DashboardPerfisAlunos.gs`
- Modify: `tests/dashboard-api.test.js`

**Interfaces:**
- Consumes: tabelas `PERFIS_ALUNOS`, `CONFIG_PERFIS_ALUNOS` e `jsonDashboardSeguro_`.
- Produces: `lerPerfisAlunosDashboard_(planilha)`, `lerCatalogoPerfisAlunosDashboard_(planilha)` e propriedades bootstrap `perfisAlunos`/`catalogoPerfisAlunos`.

- [ ] **Step 1: Escrever o teste falhando do payload**

Atualizar o fixture do teste de bootstrap com as duas abas e substituir a expectativa que proíbe contato por:

```js
assert.equal(resposta.alunos[0].contato, '85999999999');
assert.equal(resposta.perfisAlunos[0].id, '1');
assert.deepEqual(resposta.perfisAlunos[0].etiquetasPublico, ['idoso', 'saude']);
assert.equal(resposta.catalogoPerfisAlunos.some(item => item.chave === 'risco_de_churn'), true);
assert.equal(JSON.stringify(resposta).includes('Observação interna'), true);
```

No teste estrutural do cliente, remover apenas `assert.doesNotMatch(client, /\.contato\b/)`; manter as proteções contra `innerHTML` e `google.script.run`.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test tests/dashboard-api.test.js tests/dashboard-html.test.js`

Expected: FAIL porque o bootstrap não contém as novas propriedades e ainda omite `contato`.

- [ ] **Step 3: Implementar os leitores normalizados**

Adicionar em `18_DashboardPerfisAlunos.gs`:

```js
function listaJsonPerfilAluno_(valor) {
  var lista = jsonDashboardSeguro_(valor, []);
  return Array.isArray(lista) ? lista.map(function (item) { return String(item || '').trim(); }).filter(Boolean) : [];
}

function lerPerfisAlunosDashboard_(planilha) {
  return lerTabelaDashboardDaPlanilha_(planilha, CONFIG.abas.perfisAlunos, CONFIG.cabecalhos.perfisAlunos).map(function (linha) {
    return {
      id: String(linha.id || ''), aluno: String(linha.aluno || ''),
      professorResponsavel: String(linha.professor_responsavel || ''),
      perfilPagamento: String(linha.perfil_pagamento || 'Sem histórico'),
      observacaoPagamento: String(linha.observacao_pagamento || ''),
      etiquetasPublico: listaJsonPerfilAluno_(linha.etiquetas_publico),
      etiquetasComerciais: listaJsonPerfilAluno_(linha.etiquetas_comerciais),
      observacoesGerais: String(linha.observacoes_gerais || ''),
      atualizadoEm: String(linha.atualizado_em || '')
    };
  });
}

function lerCatalogoPerfisAlunosDashboard_(planilha) {
  return lerTabelaDashboardDaPlanilha_(planilha, CONFIG.abas.configPerfisAlunos, CONFIG.cabecalhos.configPerfisAlunos).map(function (linha) {
    return { tipo: String(linha.tipo || ''), grupo: String(linha.grupo || ''), chave: String(linha.chave || ''), titulo: String(linha.titulo || ''), ativo: linha.ativo === true || String(linha.ativo).toLowerCase() === 'true', ordem: Number(linha.ordem) || 0 };
  }).sort(function (a, b) { return a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, 'pt-BR'); });
}
```

- [ ] **Step 4: Integrar ao bootstrap e ao validador de cache**

Em `alunoSeguroParaDashboard_`, incluir:

```js
contato: String(aluno.contato || ''),
```

Em `montarBootstrapDashboard_`, incluir:

```js
perfisAlunos: lerPerfisAlunosDashboard_(base.planilha),
catalogoPerfisAlunos: lerCatalogoPerfisAlunosDashboard_(base.planilha),
```

Em `respostaBootstrapDashboardValida_`, exigir:

```js
Array.isArray(resposta.perfisAlunos) && Array.isArray(resposta.catalogoPerfisAlunos)
```

- [ ] **Step 5: Rodar os testes**

Run: `node --test tests/dashboard-api.test.js tests/dashboard-html.test.js`

Expected: PASS. Nenhum teste ou log inclui o valor do contato em mensagens de erro.

- [ ] **Step 6: Commit**

```bash
git add apps-script/11_DashboardRepositorio.gs apps-script/12_DashboardApi.gs apps-script/18_DashboardPerfisAlunos.gs tests/dashboard-api.test.js tests/dashboard-html.test.js
git commit -m "feat: expose student profiles in dashboard bootstrap"
```

---

### Task 4: Salvar o perfil completo com validação e compatibilidade

**Files:**
- Modify: `apps-script/14_DashboardMutacoes.gs`
- Modify: `apps-script/18_DashboardPerfisAlunos.gs`
- Modify: `tests/dashboard-mutacoes.test.js`

**Interfaces:**
- Consumes: patch `{ tipo: 'perfilAluno', valores: PerfilAlunoInput }`, catálogo e status do aluno.
- Produces: `atualizarLinhasPerfilAlunoMutacao_(linhas, valores, catalogo, alunos)` e upsert em `PERFIS_ALUNOS`.

- [ ] **Step 1: Escrever testes falhando para upsert e rejeições**

Adicionar ao objeto `sheets` do `setup()` existente:

```js
PERFIS_ALUNOS: new SheetMock([Array.from(config.cabecalhos.perfisAlunos)]),
CONFIG_PERFIS_ALUNOS: new SheetMock([
  Array.from(config.cabecalhos.configPerfisAlunos),
  ['perfil_pagamento', 'global', 'sem_historico', 'Sem histórico', true, 10],
  ['perfil_pagamento', 'global', 'bom_pagador', 'Bom pagador', true, 20],
  ['etiqueta', 'publico', 'idoso', 'Idoso', true, 10],
  ['etiqueta', 'publico', 'saude', 'Saúde', true, 20],
  ['etiqueta', 'comercial', 'risco_de_churn', 'Risco de Churn', true, 10]
]),
BASE_ALUNOS: new SheetMock([
  Array.from(config.cabecalhos.alunos),
  ['42', 'ALUNA TESTE', '85999999999', 'Ativo', '', '', '', 'exec-1']
]),
```

Adicionar `apps-script/11_DashboardRepositorio.gs` e `apps-script/18_DashboardPerfisAlunos.gs` à lista passada para `loadGas`. Então incluir:

```js
test('salva perfil completo por ID e preserva um professor histórico', () => {
  const { gas, sheets } = setup();
  sheets.PERFIS_ALUNOS.values.push(['42', 'ALUNA TESTE', 'Professor antigo', 'Sem histórico', '', '[]', '[]', '', '']);
  gas.salvarMutacoesDashboard({ requestId: 'perfil-aluno-42', patches: [{ tipo: 'perfilAluno', valores: {
    id: '42', aluno: 'ALUNA TESTE', professorResponsavel: 'Professor antigo',
    perfilPagamento: 'Bom pagador', observacaoPagamento: 'Paga em dia',
    etiquetasPublico: ['idoso', 'saude'], etiquetasComerciais: ['risco_de_churn'],
    observacoesGerais: 'Prefere treinar cedo.'
  } }] });
  const linha = sheets.PERFIS_ALUNOS.values.find(row => row[0] === '42');
  assert.equal(linha[2], 'Professor antigo');
  assert.equal(linha[3], 'Bom pagador');
  assert.equal(linha[5], '["idoso","saude"]');
  assert.equal(linha[6], '["risco_de_churn"]');
});

test('rejeita etiqueta fora do grupo sem gravar', () => {
  const { gas, sheets } = setup();
  assert.throws(() => gas.salvarMutacoesDashboard({ requestId: 'perfil-invalido', patches: [{ tipo: 'perfilAluno', valores: {
    id: '42', aluno: 'ALUNA TESTE', perfilPagamento: 'Bom pagador',
    etiquetasPublico: ['risco_de_churn'], etiquetasComerciais: []
  } }] }), /Etiqueta de Público inválida/);
  assert.equal(sheets.PERFIS_ALUNOS.values.length, 1);
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test tests/dashboard-mutacoes.test.js`

Expected: FAIL com `Tipo de alteração inválido.`.

- [ ] **Step 3: Implementar normalização e validação no módulo**

Adicionar em `18_DashboardPerfisAlunos.gs`:

```js
function chavesAtivasCatalogoPerfil_(catalogo, tipo, grupo) {
  return catalogo.filter(function (item) { return item.ativo && item.tipo === tipo && item.grupo === grupo; }).map(function (item) { return item.chave; });
}

function grupoProfessorPerfilAluno_(status) {
  var normalizado = String(status || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return normalizado.indexOf('cancel') !== -1 ? 'cancelados' : 'matriculados';
}

function validarListaCatalogoPerfil_(recebida, permitidas, rotulo) {
  if (!Array.isArray(recebida)) throw new Error(rotulo + ' inválida.');
  var vistas = Object.create(null);
  return recebida.map(function (item) { return textoMutacaoDashboard_(item, 80); }).filter(function (item) {
    if (!item || vistas[item]) return false;
    if (permitidas.indexOf(item) === -1) throw new Error(rotulo + ' inválida.');
    vistas[item] = true;
    return true;
  });
}

function titulosAtivosCatalogoPerfil_(catalogo, tipo, grupo) {
  return catalogo.filter(function (item) {
    return item.ativo && item.tipo === tipo && item.grupo === grupo;
  }).map(function (item) { return item.titulo; });
}

function atualizarLinhasPerfilAlunoMutacao_(linhas, valores, catalogo, alunos) {
  valores = valores || {};
  var id = textoMutacaoDashboard_(valores.id, 100);
  var aluno = textoMutacaoDashboard_(valores.aluno, 200);
  var indice = linhas.findIndex(function (linha) { return String(linha[0]) === id; });
  var anterior = indice === -1 ? null : linhas[indice];
  var alunoBase = alunos.filter(function (item) { return String(item.id) === id; })[0];
  if (!id || !aluno || !alunoBase) throw new Error('Aluno inválido.');

  var professor = textoMutacaoDashboard_(valores.professorResponsavel, 120);
  var grupoProfessor = grupoProfessorPerfilAluno_(alunoBase.status);
  var professores = titulosAtivosCatalogoPerfil_(catalogo, 'professor', grupoProfessor);
  var professorHistorico = anterior ? String(anterior[2] || '') : '';
  if (professor && professores.indexOf(professor) === -1 && professor !== professorHistorico) {
    throw new Error('Professor responsável inválido.');
  }

  var perfilPagamento = textoMutacaoDashboard_(valores.perfilPagamento || 'Sem histórico', 100);
  if (titulosAtivosCatalogoPerfil_(catalogo, 'perfil_pagamento', 'global').indexOf(perfilPagamento) === -1) {
    throw new Error('Perfil de pagamento inválido.');
  }
  var etiquetasPublico = validarListaCatalogoPerfil_(
    valores.etiquetasPublico || [], chavesAtivasCatalogoPerfil_(catalogo, 'etiqueta', 'publico'), 'Etiqueta de Público'
  );
  var etiquetasComerciais = validarListaCatalogoPerfil_(
    valores.etiquetasComerciais || [], chavesAtivasCatalogoPerfil_(catalogo, 'etiqueta', 'comercial'), 'Etiqueta Comercial'
  );
  var nova = [
    id, aluno, professor, perfilPagamento,
    textoMutacaoDashboard_(valores.observacaoPagamento, 1000),
    JSON.stringify(etiquetasPublico), JSON.stringify(etiquetasComerciais),
    textoMutacaoDashboard_(valores.observacoesGerais, 3000),
    Utilities.formatDate(new Date(), CONFIG.fusoHorario, 'dd/MM/yyyy HH:mm')
  ];
  if (indice === -1) return linhas.concat([nova]);
  var atualizadas = linhas.map(function (linha) { return linha.slice(); });
  atualizadas[indice] = nova;
  return atualizadas.filter(function (linha, linhaIndice) {
    return String(linha[0]) !== id || linhaIndice === indice;
  });
}
```

- [ ] **Step 4: Integrar a mutação sem remover a compatibilidade antiga**

Em `salvarMutacoesDashboard`:

```js
var precisaPerfilAluno = patches.some(function (patch) { return patch && patch.tipo === 'perfilAluno'; });
var abaPerfisAlunos = precisaPerfilAluno ? planilha.getSheetByName(CONFIG.abas.perfisAlunos) : null;
var linhasPerfisAlunos = precisaPerfilAluno ? lerTabelaMutacoesDashboard_(planilha, CONFIG.abas.perfisAlunos, CONFIG.cabecalhos.perfisAlunos) : [];
var catalogoPerfisAlunos = precisaPerfilAluno ? lerCatalogoPerfisAlunosDashboard_(planilha) : [];
var alunosPerfil = precisaPerfilAluno ? lerTabelaDashboardDaPlanilha_(planilha, CONFIG.abas.alunos, CONFIG.cabecalhos.alunos) : [];
```

No loop de patches, encaminhar `perfilAluno` para `atualizarLinhasPerfilAlunoMutacao_`; ao final, gravar `PERFIS_ALUNOS` quando alterada. Manter o bloco `perfilPagamento` atual sem uso pela nova UI.

O encaminhamento e a gravação são:

```js
var alterouPerfilAluno = false;

// Dentro de patches.forEach, antes do ramo final de tipo inválido:
} else if (patch.tipo === 'perfilAluno') {
  linhasPerfisAlunos = atualizarLinhasPerfilAlunoMutacao_(
    linhasPerfisAlunos, patch.valores || {}, catalogoPerfisAlunos, alunosPerfil
  );
  alterouPerfilAluno = true;

// Junto às demais gravações, antes de SpreadsheetApp.flush():
if (alterouPerfilAluno) {
  escreverTabelaMutacoesDashboard_(abaPerfisAlunos, CONFIG.cabecalhos.perfisAlunos, linhasPerfisAlunos);
}
```

- [ ] **Step 5: Rodar os testes de mutação**

Run: `node --test tests/dashboard-mutacoes.test.js`

Expected: PASS para upsert, histórico, etiqueta inválida, idempotência e mutação legada.

- [ ] **Step 6: Commit**

```bash
git add apps-script/14_DashboardMutacoes.gs apps-script/18_DashboardPerfisAlunos.gs tests/dashboard-mutacoes.test.js
git commit -m "feat: persist complete student profiles"
```

---

### Task 5: Fixar o recorte inicial Matriculados + Wellness

**Files:**
- Modify: `apps-script/11_DashboardRepositorio.gs`
- Modify: `apps-script/13_DashboardConfiguracao.gs`
- Modify: `pwa/js/dashboard.js`
- Modify: `tests/dashboard-api.test.js`
- Modify: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: filtros persistidos atuais e os polos do bootstrap.
- Produces: compatibilidade em `lerConfiguracaoDashboardPersistente_` e `applyBootstrap` que converte o legado `Ativo` em `__matriculados__`.

- [ ] **Step 1: Escrever os testes falhando**

Adicionar:

```js
assert.deepEqual(JSON.parse(JSON.stringify(resposta.filtrosPadrao)), {
  status: '__matriculados__', polo: 'XSTEAM WELLNESS CLUB'
});
```

E no teste estrutural:

```js
assert.match(client, /status\s*===\s*'Ativo'\s*\?\s*'__matriculados__'/);
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test tests/dashboard-api.test.js tests/dashboard-html.test.js`

Expected: FAIL com status `Ativo`.

- [ ] **Step 3: Atualizar seed, fallback e compatibilidade do cliente**

Trocar o status do seed/fallback para `__matriculados__`. Ao ler uma configuração existente:

```js
if (filtrosPadrao.status === 'Ativo') filtrosPadrao.status = '__matriculados__';
```

Em `applyBootstrap`, antes de atribuir `state.filters`:

```js
var initialStatus = data.filtrosPadrao.status === 'Ativo' ? '__matriculados__' : data.filtrosPadrao.status;
state.filters = { status: initialStatus || '__matriculados__', polo: data.filtrosPadrao.polo || 'XSTEAM WELLNESS CLUB' };
```

- [ ] **Step 4: Rodar os testes**

Run: `node --test tests/dashboard-api.test.js tests/dashboard-html.test.js`

Expected: PASS para seed novo e bootstrap legado.

- [ ] **Step 5: Commit**

```bash
git add apps-script/11_DashboardRepositorio.gs apps-script/13_DashboardConfiguracao.gs pwa/js/dashboard.js tests/dashboard-api.test.js tests/dashboard-html.test.js
git commit -m "fix: start dashboard with enrolled Wellness students"
```

---

### Task 6: Criar o módulo testável de seleção e paginação dos cartões

**Files:**
- Create: `pwa/js/student-profiles.js`
- Create: `tests/student-profiles.test.js`

**Interfaces:**
- Consumes: `{ alunos, contratos, perfisAlunos, catalogoPerfisAlunos }` já filtrados globalmente.
- Produces: `selectPrimaryContract`, `buildStudentCards`, `filterStudentCards`, `applyProfilePatch` e `rollbackProfilePatch` em `XSteamStudentProfiles`.

- [ ] **Step 1: Escrever os testes puros falhando**

Criar `tests/student-profiles.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const profiles = require('../pwa/js/student-profiles.js');

test('seleciona contrato ativo mais recente e filtra nome ou ID', () => {
  const cards = profiles.buildStudentCards({
    alunos: [{ id: '42', aluno: 'MARIA SAÚDE', status: 'Ativo' }],
    contratos: [
      { id: '42', statusContrato: 'Cancelado', vencimento: '20/09/2026', frequencia: '1X' },
      { id: '42', statusContrato: 'Ativo', vencimento: '10/09/2026', frequencia: '3X' }
    ],
    perfisAlunos: [{ id: '42', professorResponsavel: 'Elohim', etiquetasPublico: ['saude'], etiquetasComerciais: [] }],
    catalogoPerfisAlunos: [{ tipo: 'etiqueta', grupo: 'publico', chave: 'saude', titulo: 'Saúde', ativo: true, ordem: 10 }]
  });
  assert.equal(cards[0].contratoPrincipal.frequencia, '3X');
  assert.equal(profiles.filterStudentCards(cards, '42')[0].aluno, 'MARIA SAÚDE');
  assert.equal(profiles.filterStudentCards(cards, 'maria').length, 1);
});

test('aplica e reverte perfil otimista', () => {
  const bootstrap = { perfisAlunos: [{ id: '42', professorResponsavel: 'Cadu' }] };
  const rollback = profiles.applyProfilePatch(bootstrap, { id: '42', professorResponsavel: 'Elohim' });
  assert.equal(bootstrap.perfisAlunos[0].professorResponsavel, 'Elohim');
  profiles.rollbackProfilePatch(bootstrap, rollback);
  assert.equal(bootstrap.perfisAlunos[0].professorResponsavel, 'Cadu');
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test tests/student-profiles.test.js`

Expected: FAIL com módulo não encontrado.

- [ ] **Step 3: Implementar o núcleo UMD sem DOM**

Criar o módulo com estas funções e exportações:

```js
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.XSteamStudentProfiles = api;
}(typeof window !== 'undefined' ? window : this, function () {
  function normalize(value) { return String(value == null ? '' : value).trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

  function dateValue(value) {
    var text = String(value || '');
    var br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(text);
    if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]), 12).getTime();
    var parsed = Date.parse(text);
    return isNaN(parsed) ? 0 : parsed;
  }

  function selectPrimaryContract(contracts) {
    return (contracts || []).slice().sort(function (a, b) {
      var activeA = normalize(a.statusContrato) === 'ativo' ? 1 : 0;
      var activeB = normalize(b.statusContrato) === 'ativo' ? 1 : 0;
      return activeB - activeA || dateValue(b.vencimento) - dateValue(a.vencimento);
    })[0] || null;
  }

  function buildStudentCards(input) {
    var contractsById = Object.create(null), profilesById = Object.create(null), labels = Object.create(null);
    (input.contratos || []).forEach(function (contract) { (contractsById[contract.id] || (contractsById[contract.id] = [])).push(contract); });
    (input.perfisAlunos || []).forEach(function (profile) { profilesById[profile.id] = profile; });
    (input.catalogoPerfisAlunos || []).forEach(function (item) { labels[item.grupo + ':' + item.chave] = item.titulo; });
    return (input.alunos || []).map(function (student) {
      var profile = profilesById[student.id] || {
        id: student.id, aluno: student.aluno, professorResponsavel: '', perfilPagamento: 'Sem histórico',
        observacaoPagamento: '', etiquetasPublico: [], etiquetasComerciais: [], observacoesGerais: ''
      };
      var publicTags = profile.etiquetasPublico || [], commercialTags = profile.etiquetasComerciais || [];
      return {
        id: student.id, aluno: student.aluno, contato: student.contato || '', status: student.status || '',
        dataFicha: student.dataFicha || '', dataAvaliacao: student.dataAvaliacao || '',
        perfil: profile, contratos: contractsById[student.id] || [],
        contratoPrincipal: selectPrimaryContract(contractsById[student.id] || []),
        etiquetas: publicTags.map(function (key) { return labels['publico:' + key] || key; })
          .concat(commercialTags.map(function (key) { return labels['comercial:' + key] || key; }))
      };
    }).sort(function (a, b) { return a.aluno.localeCompare(b.aluno, 'pt-BR'); });
  }

  function filterStudentCards(cards, query) {
    var search = normalize(query);
    if (!search) return cards.slice();
    return cards.filter(function (card) { return normalize(card.aluno).indexOf(search) !== -1 || normalize(card.id).indexOf(search) !== -1; });
  }

  function applyProfilePatch(bootstrap, values) {
    var list = bootstrap.perfisAlunos || (bootstrap.perfisAlunos = []);
    var index = list.findIndex(function (item) { return item.id === values.id; });
    var previous = index === -1 ? null : Object.assign({}, list[index]);
    var next = Object.assign({}, previous || {}, values);
    if (index === -1) list.push(next); else list[index] = next;
    return { id: values.id, index: index, previous: previous };
  }

  function rollbackProfilePatch(bootstrap, rollback) {
    var list = bootstrap.perfisAlunos || (bootstrap.perfisAlunos = []);
    var index = list.findIndex(function (item) { return item.id === rollback.id; });
    if (rollback.previous) {
      if (index === -1) list.splice(Math.max(0, rollback.index), 0, rollback.previous);
      else list[index] = rollback.previous;
    } else if (index !== -1) list.splice(index, 1);
  }

  return {
    selectPrimaryContract: selectPrimaryContract,
    buildStudentCards: buildStudentCards,
    filterStudentCards: filterStudentCards,
    applyProfilePatch: applyProfilePatch,
    rollbackProfilePatch: rollbackProfilePatch
  };
}));
```

- [ ] **Step 4: Rodar os testes**

Run: `node --test tests/student-profiles.test.js`

Expected: PASS para contrato, busca acentuada, ID e rollback.

- [ ] **Step 5: Commit**

```bash
git add pwa/js/student-profiles.js tests/student-profiles.test.js
git commit -m "feat: add student profile client model"
```

---

### Task 7: Renderizar grade, diálogo e formulário responsivos

**Files:**
- Modify: `pwa/js/student-profiles.js`
- Create: `pwa/css/student-profiles.css`
- Modify: `pwa/index.html`
- Modify: `pwa/sw.js`
- Modify: `tests/student-profiles.test.js`
- Modify: `tests/dashboard-html.test.js`
- Modify: `tests/pwa-shell.test.js`

**Interfaces:**
- Consumes: `renderSection({ data, bootstrap, onSave })` e patch `perfilAluno`.
- Produces: seção `Perfis dos alunos`, busca/paginação de 24, diálogo com abas e callback `onSave(patch)`.

- [ ] **Step 1: Escrever testes falhando para assets e contrato de UI**

Adicionar em `tests/dashboard-html.test.js`:

```js
assert.match(html, /student-profiles\.css/);
assert.match(html, /student-profiles\.js/);
assert.match(profilesClient, /Perfis dos alunos/);
assert.match(profilesClient, /Informações/);
assert.match(profilesClient, /Configuração/);
assert.match(profilesClient, /Agenda/);
assert.match(profilesClient, /Em breve/);
assert.match(profilesClient, /Mostrar mais/);
assert.doesNotMatch(profilesClient, /innerHTML\s*=/);
```

Adicionar em `tests/pwa-shell.test.js` expectativas de `./css/student-profiles.css` e `./js/student-profiles.js` em `STATIC_ASSETS`, e de `xsteam-static-v4` como nova versão.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test tests/dashboard-html.test.js tests/pwa-shell.test.js tests/student-profiles.test.js`

Expected: FAIL por ausência dos assets e funções de renderização.

- [ ] **Step 3: Implementar a interface usando somente criação segura de DOM**

Adicionar ao módulo:

```js
function uiElement(doc, tag, className, text) {
  var element = doc.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = String(text);
  return element;
}

function renderSection(options) {
  var documentRef = options.document || document;
  var all = buildStudentCards({
    alunos: options.data.alunos || [], contratos: options.data.contratos || [],
    perfisAlunos: options.bootstrap.perfisAlunos || [],
    catalogoPerfisAlunos: options.bootstrap.catalogoPerfisAlunos || []
  });
  var visible = 24;
  var section = documentRef.createElement('section');
  section.className = 'student-profiles-section';
  var heading = uiElement(documentRef, 'div', 'student-profiles-heading');
  heading.appendChild(uiElement(documentRef, 'h2', '', 'Perfis dos alunos'));
  var search = uiElement(documentRef, 'input', 'student-profile-search');
  search.type = 'search';
  search.placeholder = 'Buscar por nome ou ID';
  search.setAttribute('aria-label', 'Buscar aluno por nome ou ID');
  heading.appendChild(search);
  section.appendChild(heading);
  var summary = uiElement(documentRef, 'p', 'student-profile-summary');
  var grid = uiElement(documentRef, 'div', 'student-profile-grid');
  var more = uiElement(documentRef, 'button', 'secondary student-profile-more', 'Mostrar mais');
  more.type = 'button';
  section.appendChild(summary);
  section.appendChild(grid);
  section.appendChild(more);

  function refresh() {
    var filtered = filterStudentCards(all, search.value);
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    filtered.slice(0, visible).forEach(function (card) {
      var button = uiElement(documentRef, 'button', 'student-profile-card');
      button.type = 'button';
      button.appendChild(uiElement(documentRef, 'strong', 'student-profile-name', card.aluno));
      button.appendChild(uiElement(documentRef, 'span', 'student-profile-id', 'ID ' + card.id));
      button.appendChild(uiElement(documentRef, 'span', 'student-profile-status', card.status || 'Sem status'));
      button.appendChild(uiElement(documentRef, 'span', 'student-profile-frequency', card.contratoPrincipal ? card.contratoPrincipal.frequencia || 'Sem frequência' : 'Sem contrato'));
      button.appendChild(uiElement(documentRef, 'span', 'student-profile-professor', card.perfil.professorResponsavel || 'Sem responsável'));
      var tags = uiElement(documentRef, 'span', 'student-profile-tags');
      card.etiquetas.slice(0, 3).forEach(function (tag) { tags.appendChild(uiElement(documentRef, 'span', 'student-profile-tag', tag)); });
      if (card.etiquetas.length > 3) tags.appendChild(uiElement(documentRef, 'span', 'student-profile-tag', '+' + (card.etiquetas.length - 3)));
      button.appendChild(tags);
      button.addEventListener('click', function () { openProfileDialog(card, options); });
      grid.appendChild(button);
    });
    summary.textContent = filtered.length + ' aluno(s) no recorte';
    more.hidden = visible >= filtered.length;
    if (!filtered.length) grid.appendChild(uiElement(documentRef, 'p', 'body-copy', 'Nenhum aluno neste recorte.'));
  }

  search.addEventListener('input', function () { visible = 24; refresh(); });
  more.addEventListener('click', function () { visible += 24; refresh(); });
  refresh();
  return section;
}
```

Implementar `openProfileDialog(card, options)` criando um `<dialog class="student-profile-dialog">` anexado ao `document.body`. O cabeçalho contém o nome, o ID e um botão `Fechar`. A lista de abas usa dois botões com `role="tab"`, `aria-controls="student-info-panel"`/`student-config-panel` e alterna `aria-selected`, `hidden` e foco sem reconstruir o formulário.

O painel `Informações` cria linhas de rótulo/valor para contato, status, contrato, frequência, valor, vencimento, polo, modalidade, data da ficha e data da avaliação. Usa `card.contratoPrincipal` para o resumo e uma lista abaixo para `card.contratos.slice(1)`. Valores ausentes exibem `Não informado`.

O painel `Configuração` usa:

```js
function activeCatalog(catalog, type, group) {
  return (catalog || []).filter(function (item) {
    return item.ativo && item.tipo === type && item.grupo === group;
  }).sort(function (a, b) { return a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, 'pt-BR'); });
}

function checkedValues(container) {
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(function (input) { return input.value; });
}

var professorGroup = normalize(card.status).indexOf('cancel') !== -1 ? 'cancelados' : 'matriculados';
var professorOptions = activeCatalog(options.bootstrap.catalogoPerfisAlunos, 'professor', professorGroup);
var paymentOptions = activeCatalog(options.bootstrap.catalogoPerfisAlunos, 'perfil_pagamento', 'global');
var publicOptions = activeCatalog(options.bootstrap.catalogoPerfisAlunos, 'etiqueta', 'publico');
var commercialOptions = activeCatalog(options.bootstrap.catalogoPerfisAlunos, 'etiqueta', 'comercial');
```

Preencher um `<select>` de professor com uma opção vazia e os títulos ativos. Se o valor histórico não estiver ativo, inserir uma opção selecionável `card.perfil.professorResponsavel + ' (histórico)'` com o valor original. Preencher o select de pagamento pelos títulos. Construir os dois grupos de etiquetas com checkbox `value=item.chave`, marcando as chaves já presentes no perfil. Criar `textarea maxlength="1000"` para observação de pagamento e `textarea maxlength="3000"` para observações gerais. A agenda é um `fieldset disabled` contendo `Agenda — Em breve`.

No submit do formulário, desabilitar o botão, trocar o texto para `Salvando…`, fechar o diálogo depois de chamar `options.onSave` e emitir exatamente:

```js
options.onSave({
  tipo: 'perfilAluno',
  valores: {
    id: card.id, aluno: card.aluno,
    professorResponsavel: professor.value,
    perfilPagamento: pagamento.value,
    observacaoPagamento: observacaoPagamento.value,
    etiquetasPublico: checkedValues(publicTags),
    etiquetasComerciais: checkedValues(commercialTags),
    observacoesGerais: observacoesGerais.value
  }
});
```

Acrescentar `renderSection: renderSection` ao objeto retornado pelo módulo. Ao fechar, remover o diálogo do DOM no evento `close`, restaurando naturalmente o foco no cartão que o abriu.

- [ ] **Step 4: Adicionar estilos próprios e assets**

`student-profiles.css` deve conter:

```css
.student-profile-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
.student-profile-card { min-height:148px; padding:16px; border:1px solid var(--line); border-radius:var(--radius-card); background:var(--surface); text-align:left; }
.student-profile-card:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
.student-profile-tags { display:flex; flex-wrap:wrap; gap:6px; }
.student-profile-dialog { width:min(760px,calc(100vw - 32px)); max-height:calc(100dvh - 32px); }
.student-profile-tab[aria-selected="true"] { color:var(--accent); border-bottom-color:var(--accent); }
.student-profile-fieldset { border:0; padding:0; margin:0; }
@media (max-width:1100px) { .student-profile-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (max-width:620px) { .student-profile-grid { grid-template-columns:1fr; } .student-profile-dialog { width:100vw; max-width:none; height:100dvh; max-height:none; margin:0; border-radius:0; } }
```

Carregar o CSS no `<head>` e `student-profiles.js` antes de `app.js`. Atualizar `CACHE_NAME` para `xsteam-static-v4` e incluir os dois assets em `STATIC_ASSETS`.

- [ ] **Step 5: Rodar os testes**

Run: `node --test tests/dashboard-html.test.js tests/pwa-shell.test.js tests/student-profiles.test.js`

Expected: PASS e nenhum uso de `innerHTML`.

- [ ] **Step 6: Commit**

```bash
git add pwa/js/student-profiles.js pwa/css/student-profiles.css pwa/index.html pwa/sw.js tests/student-profiles.test.js tests/dashboard-html.test.js tests/pwa-shell.test.js
git commit -m "feat: add responsive student profile interface"
```

---

### Task 8: Encaixar perfis na Home, na fila otimista e em Configurações

**Files:**
- Modify: `pwa/js/dashboard.js`
- Modify: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: `window.XSteamStudentProfiles.renderSection`, `applyProfilePatch`, `rollbackProfilePatch` e `enqueue`.
- Produces: seção após os blocos operacionais da Home, rollback de `perfilAluno` e Configurações sem edição individual de pagamento.

- [ ] **Step 1: Repetir a verificação de concorrência**

Run:

```bash
git status --short
git diff -- pwa/js/dashboard.js pwa/css/dashboard.css pwa/index.html
grep -nE 'function (renderHome|renderSettings|aplicarMutacaoOtimista|reverterMutacaoOtimista)' pwa/js/dashboard.js
```

Expected: nenhum diff externo desconhecido. Se houver, preservar a versão atual e aplicar somente os encaixes abaixo.

- [ ] **Step 2: Escrever o teste estrutural falhando**

Adicionar:

```js
assert.match(client, /XSteamStudentProfiles\.renderSection/);
assert.match(client, /patch\.tipo\s*===\s*'perfilAluno'/);
assert.match(client, /XSteamStudentProfiles\.applyProfilePatch/);
assert.match(client, /XSteamStudentProfiles\.rollbackProfilePatch/);
assert.doesNotMatch(client, /Salvar perfil de pagamento/);
```

- [ ] **Step 3: Rodar e confirmar a falha**

Run: `node --test tests/dashboard-html.test.js`

Expected: FAIL em `renderSection`.

- [ ] **Step 4: Adicionar o encaixe mínimo à Home**

No final da composição atual de `renderHome(data)`, sem substituir os blocos criados pelo outro agente:

```js
nodes.push(window.XSteamStudentProfiles.renderSection({
  data: data,
  bootstrap: state.bootstrap,
  onSave: enqueue
}));
```

Se `renderHome` ainda retornar um array literal, criar `var nodes` com os elementos atuais, anexar a seção e retornar `nodes`.

- [ ] **Step 5: Delegar aplicação e reversão otimistas**

No início de `aplicarMutacaoOtimista`:

```js
if (patch.tipo === 'perfilAluno') {
  var rollbackPerfil = window.XSteamStudentProfiles.applyProfilePatch(state.bootstrap, patch.valores);
  render();
  safeCacheSet(state.bootstrap);
  return { tipo: 'perfilAluno', valor: rollbackPerfil };
}
```

No início de `reverterMutacaoOtimista`:

```js
if (rollback && rollback.tipo === 'perfilAluno') {
  window.XSteamStudentProfiles.rollbackProfilePatch(state.bootstrap, rollback.valor);
  render();
  safeCacheSet(state.bootstrap);
  return;
}
```

- [ ] **Step 6: Remover somente o editor individual de pagamento**

Em `renderSettings`, excluir o bloco que escolhe um aluno e envia `tipo:'perfilPagamento'`. No mesmo local, manter uma seção `Perfis de pagamento disponíveis` que apenas lista os itens ativos de `state.bootstrap.catalogoPerfisAlunos` com `tipo === 'perfil_pagamento'` e `grupo === 'global'`. Não alterar os painéis de prazos/prioridades incorporados pelo outro agente.

- [ ] **Step 7: Rodar os testes**

Run: `node --test tests/dashboard-html.test.js tests/student-profiles.test.js`

Expected: PASS para encaixe, otimista, rollback e ausência do formulário individual.

- [ ] **Step 8: Commit**

```bash
git add pwa/js/dashboard.js tests/dashboard-html.test.js
git commit -m "feat: integrate student profiles with home"
```

---

### Task 9: Verificar ponta a ponta, responsividade e regressões

**Files:**
- Modify only if a failing assertion identifies a defect in files from Tasks 2–8.

**Interfaces:**
- Consumes: implementação completa.
- Produces: evidência de suíte verde e fluxo funcional nas quatro larguras.

- [ ] **Step 1: Rodar toda a suíte automatizada**

Run:

```bash
node --test tests/*.test.js
```

Expected: todos os testes PASS, zero falhas e zero testes cancelados.

- [ ] **Step 2: Iniciar a prévia local**

Run:

```bash
python3 -m http.server 4173 --directory pwa
```

Expected: servidor disponível em `http://127.0.0.1:4173/`. Manter a sessão aberta somente durante a verificação.

- [ ] **Step 3: Verificar o fluxo funcional**

Na prévia conectada a um bootstrap de teste ou ambiente autorizado, confirmar em 1440, 1024, 768 e 390 px:

1. abertura em `Matriculados` + `XSTEAM WELLNESS CLUB`;
2. busca por nome e ID;
3. 24 cartões iniciais e expansão por `Mostrar mais`;
4. diálogo do aluno correto e alternância das duas abas por mouse e teclado;
5. contato, contrato e datas corretos;
6. professor de matriculados e de cancelados conforme catálogo;
7. seleção múltipla de etiquetas;
8. agenda desabilitada `Em breve`;
9. salvamento, feedback `Salvo`, reabertura com dados persistidos;
10. simulação de falha, rollback e `Tentar novamente`;
11. nenhuma rolagem horizontal e foco sempre visível.

- [ ] **Step 4: Auditar o diff final e a migração**

Run:

```bash
git status --short
git diff --check
git diff --stat HEAD~8..HEAD
git log --oneline -10
```

Expected: nenhum whitespace error; somente arquivos previstos; nenhuma remoção da implementação concorrente da Home; `GESTAO_PAGAMENTOS` continua suportada e não é apagada.

- [ ] **Step 5: Commit de correções de verificação, se necessário**

Somente se a verificação exigiu ajustes:

```bash
git add apps-script pwa tests
git commit -m "fix: complete student profile verification"
```
