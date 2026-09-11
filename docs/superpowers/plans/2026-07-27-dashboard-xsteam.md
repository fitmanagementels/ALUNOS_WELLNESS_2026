# Dashboard XSTEAM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o web app XSTEAM responsivo, com análises operacionais, configurações globais persistentes, perfil de pagamento e cache local fluido.

**Architecture:** Integrar o dashboard existente de `feature/dashboard-xsteam` à `main`, preservando o backend XLSX atual. O web app recebe um bootstrap versionado, calcula filtros/detalhes no cliente e envia mutações de configuração em fila sequencial. Sheets permanece a fonte de verdade; `CacheService` é apenas otimização.

**Tech Stack:** Apps Script V8, HTML Service, `google.script.run`, Sheets, `CacheService`, `LockService`, JavaScript/CSS sem framework e `node --test`.

## Global Constraints

- Usar somente `main`; não criar outro worktree.
- Integrar o branch `feature/dashboard-xsteam` antes de evoluir o dashboard e só remover o worktree após a validação final.
- Não enviar `contato` ao navegador ou ao cache local.
- O dashboard só grava `CONFIG_DASHBOARD`, `CONFIG_ALERTAS` e `GESTAO_PAGAMENTOS`; snapshots continuam exclusivos da importação.
- Filtros padrão: `Ativo` e `Wellness`.
- Cálculos de idade usam a data atual. Não usar “atraso” para vencimentos.
- Cada tarefa segue TDD e termina com commit.

## Estrutura alvo

| Arquivo | Responsabilidade |
|---|---|
| `00_Config.gs` | nomes/cabeçalhos das abas, defaults, perfis, limites de cache |
| `04_PlanilhaRepositorio.gs` | criação idempotente das abas persistentes |
| `07_ImportacaoService.gs` | incremento da versão do dashboard após sucesso |
| `08_Main.gs` | menu, `doGet`, `abrirDashboard` |
| `09_DashboardMetricas.gs` | datas, faixas, valor por aula e ordenação |
| `10_DashboardPaginas.gs` | datasets de Home, Financeiro e Acompanhamento |
| `11_DashboardRepositorio.gs` | leitura das abas e upsert por ID |
| `12_DashboardApi.gs` | bootstrap/version/cache de leitura |
| `13_DashboardMutacoes.gs` | validação, lock e batch de escrita |
| `Dashboard*.html` | shell, estilos, componentes e cliente local |
| `tests/dashboard-*.test.js` | cobertura do domínio, API, cliente e UI |

## Interfaces públicas

```javascript
function doGet() {}
function abrirDashboard() {}
function obterBootstrapDashboard() {}
function obterVersaoDashboard() {}
function salvarMutacoesDashboard(lote) {}

// bootstrap sem contato
{
  versao: 'importacao:execucao|config:42',
  atualizadoEm: '27/07/2026 19:34',
  filtrosPadrao: { status: 'Ativo', polo: 'Wellness' },
  configuracao: { homeCards: [], alertas: {}, perfisPagamento: [] },
  alunos: [], contratos: []
}
```

### Task 1: Consolidar o dashboard já existente na `main`

**Files:** merge de `feature/dashboard-xsteam`; modificar conflitos em `apps-script/00_Config.gs`, `apps-script/08_Main.gs`; trazer `09`–`12_Dashboard*.gs`, `Dashboard*.html` e `tests/dashboard-*.test.js`.

**Produces:** um único código de dashboard em `main`, sem regressão do importador XLSX.

- [ ] **Step 1: Validar o ponto de partida**

Run: `npm test`

Expected: a suíte atual passa.

- [ ] **Step 2: Mesclar sem commit**

Run:

```bash
git merge --no-ff --no-commit feature/dashboard-xsteam
```

Preservar IDs de pasta e suporte XLSX da `main`. No menu, manter `Abrir painel` e adicionar `Abrir dashboard`; não substituir o backend de importação pela versão antiga.

- [ ] **Step 3: Rodar testes combinados e fazer commit**

Run: `npm test`

Expected: testes antigos e `dashboard-*.test.js` passam.

```bash
git add apps-script tests LEIA-ME.md
git commit -m "feat: consolidate dashboard baseline in main"
```

### Task 2: Criar configuração persistente e versão da base

**Files:** modificar `apps-script/00_Config.gs`, `apps-script/04_PlanilhaRepositorio.gs`, `apps-script/07_ImportacaoService.gs`; criar `tests/dashboard-configuracao.test.js`.

**Consumes:** `garantirEstruturaPlanilha()` e término da importação.

**Produces:** abas preservadas `CONFIG_DASHBOARD`, `CONFIG_ALERTAS`, `GESTAO_PAGAMENTOS` e `obterVersaoDashboardPersistida_()`.

- [ ] **Step 1: Escrever o teste que falha**

```javascript
test('cria defaults sem apagar dados persistentes', () => {
  garantirEstruturaPlanilha();
  assert.deepEqual(abaAlertas.getRange(1, 1, 3, 5).getValues(), [
    ['regra', 'verde_ate', 'laranja_ate', 'vermelho_ate', 'roxo_ate'],
    ['prescricoes', 90, 180, 270, ''],
    ['avaliacoes', 90, 120, 180, 270]
  ]);
  assert.equal(abaPagamentos.getRange(2, 1).getValue(), 'id-existente');
});
```

Também cobrir que sucesso incrementa versão e erro não incrementa.

- [ ] **Step 2: Confirmar falha**

Run: `node --test tests/dashboard-configuracao.test.js`

Expected: FAIL, pois as abas/versionamento não existem.

- [ ] **Step 3: Implementar o mínimo**

Adicionar cabeçalhos/defaults ao `CONFIG`, criar `garantirAbaPersistenteDashboard_()` que só semeia aba vazia e implementar:

```javascript
function incrementarVersaoDashboard_() {
  var props = PropertiesService.getDocumentProperties();
  var atual = Number(props.getProperty('dashboard_versao') || '0');
  var proxima = String(atual + 1);
  props.setProperty('dashboard_versao', proxima);
  return proxima;
}
```

Chamar somente após importação `SUCESSO` completa.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/dashboard-configuracao.test.js tests/service.test.js tests/planilha-repositorio.test.js`

Expected: PASS.

```bash
git add apps-script/00_Config.gs apps-script/04_PlanilhaRepositorio.gs apps-script/07_ImportacaoService.gs tests/dashboard-configuracao.test.js
git commit -m "feat: add persistent dashboard configuration sheets"
```

### Task 3: Implementar regras de domínio e datasets aprovados

**Files:** modificar `apps-script/09_DashboardMetricas.gs`, `apps-script/10_DashboardPaginas.gs`, `tests/dashboard-metricas.test.js`, `tests/dashboard-paginas.test.js`.

**Produces:** classificações configuráveis, Home, Planos, Vencimentos, Prescrições e Avaliações sem contato.

- [ ] **Step 1: Escrever testes de fronteiras e contratos múltiplos**

```javascript
test('prescrição troca verde por laranja após o dia 90', () => {
  assert.equal(classificarPrescricao_(dataComIdade(90), hoje, regras).situacao, 'verde');
  assert.equal(classificarPrescricao_(dataComIdade(91), hoje, regras).situacao, 'laranja');
});

test('sem avaliação é prioridade máxima sem idade', () => {
  assert.deepEqual(classificarAvaliacao_('', hoje, regras), {
    situacao: 'sem_avaliacao', dias: null, prioridade: 0
  });
});

test('valor por aula usa frequência vezes 4.33', () => {
  assert.equal(calcularValorPorAula_(433, '2X'), 50);
});
```

Cobrir 120/121, 180/181, 270/271, janela -5..+5, quatro faixas mensais, alunos versus contratos e soma de todos os contratos do ID para risco.

- [ ] **Step 2: Confirmar falha**

Run: `node --test tests/dashboard-metricas.test.js tests/dashboard-paginas.test.js`

Expected: FAIL, pois o baseline usa classificações antigas.

- [ ] **Step 3: Implementar funções puras e páginas**

Criar `classificarPrescricao_`, `classificarAvaliacao_`, `calcularValorPorAula_`, `montarHomeDashboard_`, `montarPaginaPlanos_`, `montarPaginaVencimentos_` e `montarPaginaAcompanhamento_`. Retornar `{ situacao, dias, prioridade }`; usar gravidade, depois valor mensal total, depois nome/ID. Vencimentos retornam contagens de aluno e contrato, timeline de 11 dias e faixas 1–7/8–15/16–23/24–fim.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/dashboard-metricas.test.js tests/dashboard-paginas.test.js`

Expected: PASS.

```bash
git add apps-script/09_DashboardMetricas.gs apps-script/10_DashboardPaginas.gs tests/dashboard-metricas.test.js tests/dashboard-paginas.test.js
git commit -m "feat: implement configured dashboard metrics"
```

### Task 4: Bootstrap, cache de servidor e API de leitura

**Files:** modificar `apps-script/08_Main.gs`, `apps-script/11_DashboardRepositorio.gs`, `apps-script/12_DashboardApi.gs`, `tests/dashboard-api.test.js`, `tests/main.test.js`.

**Produces:** `obterBootstrapDashboard()`, `obterVersaoDashboard()` e `abrirDashboard()`.

- [ ] **Step 1: Escrever testes do contrato de bootstrap**

```javascript
test('bootstrap omite contato e inclui versão/configuração', () => {
  var resposta = obterBootstrapDashboard();
  assert.equal(typeof resposta.versao, 'string');
  assert.deepEqual(resposta.filtrosPadrao, { status: 'Ativo', polo: 'Wellness' });
  assert.equal(Object.hasOwn(resposta.alunos[0], 'contato'), false);
});
```

Cobrir cache hit/miss, versão alterada, defaults vazios e menu `Abrir dashboard`.

- [ ] **Step 2: Confirmar falha**

Run: `node --test tests/dashboard-api.test.js tests/main.test.js`

Expected: FAIL porque bootstrap/versionado não existe.

- [ ] **Step 3: Implementar leitura única e endpoints**

`lerBaseDashboard_()` lê cada aba uma vez e remove contato. `obterBootstrapDashboard()` usa `CacheService` como cache opcional de bootstrap/sumários, com chave baseada na versão. `obterVersaoDashboard()` devolve `{ versao, atualizadoEm }`. `onOpen()` adiciona `Abrir dashboard`; `doGet()` serve `Dashboard` e `abrirDashboard()` usa a URL de `ScriptApp.getService()`.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/dashboard-api.test.js tests/main.test.js`

Expected: PASS.

```bash
git add apps-script/08_Main.gs apps-script/11_DashboardRepositorio.gs apps-script/12_DashboardApi.gs tests/dashboard-api.test.js tests/main.test.js
git commit -m "feat: expose versioned dashboard bootstrap"
```

### Task 5: Persistir configurações e perfil de pagamento com lock

**Files:** criar `apps-script/13_DashboardMutacoes.gs`, `tests/dashboard-mutacoes.test.js`; modificar `11_DashboardRepositorio.gs`, `12_DashboardApi.gs`.

**Produces:** `salvarMutacoesDashboard(lote)` idempotente, com batch e upsert por ID.

- [ ] **Step 1: Escrever testes de alertas, upsert e duplicidade**

```javascript
test('rejeita limites não crescentes sem gravar', () => {
  assert.throws(() => salvarMutacoesDashboard({ requestId: 'r1', patches: [
    { tipo: 'configAlertas', valores: { prescricoes: [90, 80, 270] } }
  ] }), /crescentes/);
});

test('upsert por id não duplica o mesmo requestId', () => {
  salvarMutacoesDashboard(lotePerfil('r2', '2321', 'Bom pagador'));
  salvarMutacoesDashboard(lotePerfil('r2', '2321', 'Bom pagador'));
  assert.equal(linhasPagamentoPorId('2321').length, 1);
});
```

- [ ] **Step 2: Confirmar falha**

Run: `node --test tests/dashboard-mutacoes.test.js`

Expected: FAIL, pois endpoint não existe.

- [ ] **Step 3: Implementar batch seguro**

Validar cartões, perfis e limites positivos crescentes. Usar `LockService.getScriptLock()` com `try/finally`; ler/gravar cada aba uma vez com `setValues`; mapear `id → linha`; registrar `requestId` recente em `PropertiesService`; incrementar versão apenas após todo lote válido.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/dashboard-mutacoes.test.js tests/dashboard-api.test.js`

Expected: PASS.

```bash
git add apps-script/11_DashboardRepositorio.gs apps-script/12_DashboardApi.gs apps-script/13_DashboardMutacoes.gs tests/dashboard-mutacoes.test.js
git commit -m "feat: persist dashboard settings and payment profiles"
```

### Task 6: Construir shell XSTEAM responsivo e estados

**Files:** modificar `apps-script/Dashboard.html`, `DashboardStyles.html`, `DashboardComponents.html`, `tests/dashboard-html.test.js`.

**Produces:** splash, sidebar/dock, subabas, modal e estados vazios/erro.

- [ ] **Step 1: Escrever teste de estrutura**

```javascript
test('shell contém splash, quatro áreas e modal acessível', () => {
  assert.match(html, /id="loading-screen"/);
  ['home', 'financeiro', 'acompanhamento', 'configuracoes'].forEach(pagina => {
    assert.match(html, new RegExp('data-page="' + pagina + '"'));
  });
  assert.match(html, /role="dialog"/);
});
```

- [ ] **Step 2: Confirmar falha**

Run: `node --test tests/dashboard-html.test.js`

Expected: FAIL porque o shell antigo não atende à nova navegação.

- [ ] **Step 3: Implementar shell e tema**

Criar splash logo/título/barra 0→95%, sidebar desktop, dock mobile de quatro botões e subabas Financeiro/Acompanhamento. Usar preto, branco, lime, cards angulares, cores semânticas e texto operacional mínimo 13–14 px. Criar componentes reutilizáveis para loading demorado, vazio, erro e gravação pendente; mobile usa modal de tela cheia.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/dashboard-html.test.js`

Expected: PASS.

```bash
git add apps-script/Dashboard.html apps-script/DashboardStyles.html apps-script/DashboardComponents.html tests/dashboard-html.test.js
git commit -m "feat: build responsive xsteam dashboard shell"
```

### Task 7: Cliente local, detalhes e cache persistente

**Files:** modificar `apps-script/DashboardClient.html`; criar `tests/dashboard-client.test.js`.

**Produces:** páginas locais, filtros locais, modal agrupado por ID e cache sem contato.

- [ ] **Step 1: Escrever testes de cache e interações locais**

```javascript
test('cache válido renderiza antes da revalidação de versão', async () => {
  var app = criarCliente({ cache: bootstrapVersao('10'), api: apiVersao('11') });
  await app.iniciar();
  assert.equal(app.renderizouCache, true);
  assert.equal(app.solicitouBootstrapNovo, true);
});

test('filtro e detalhe não fazem nova leitura da planilha', () => {
  app.aplicarFiltros({ status: 'Ativo', polo: 'Wellness' });
  app.abrirDetalhe('prescricoes_criticas');
  assert.equal(api.chamadasLeitura, 0);
});
```

- [ ] **Step 2: Confirmar falha**

Run: `node --test tests/dashboard-client.test.js`

Expected: FAIL porque o cliente atual busca páginas individualmente.

- [ ] **Step 3: Implementar estado e renderização**

Persistir bootstrap sem contato em memória e armazenamento local versionado. Sem cache, completar barra só no bootstrap; com cache, renderizar imediatamente e chamar apenas `obterVersaoDashboard`. Filtros, busca, gráficos e subabas devem usar dados locais. `abrirDetalhe(recorte)` agrupa por ID, mostra perfil/valor e expande contratos.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/dashboard-client.test.js tests/dashboard-html.test.js`

Expected: PASS.

```bash
git add apps-script/DashboardClient.html tests/dashboard-client.test.js
git commit -m "feat: add local dashboard state and detail views"
```

### Task 8: Implementar Configurações e fila de gravação no cliente

**Files:** modificar `DashboardClient.html`, `DashboardComponents.html`, `tests/dashboard-client.test.js`, `tests/dashboard-html.test.js`.

**Produces:** edição global de Home/Alertas/Pagamentos, atualização otimista, coalescência e retry.

- [ ] **Step 1: Escrever testes da fila**

```javascript
test('agrupa patches próximos e envia o segundo lote apenas após o primeiro', async () => {
  fila.enfileirar({ tipo: 'configDashboard', valores: { ordem: 2 } });
  fila.enfileirar({ tipo: 'configDashboard', valores: { ordem: 3 } });
  await fila.esvaziar();
  assert.deepEqual(api.lotes[0].patches[0].valores, { ordem: 3 });
});
```

Cobrir falha pendente/retry, busca por nome/ID, observação opcional e dropdown dos seis perfis.

- [ ] **Step 2: Confirmar falha**

Run: `node --test tests/dashboard-client.test.js tests/dashboard-html.test.js`

Expected: FAIL porque não há fila nem formulário.

- [ ] **Step 3: Implementar fila e tela**

Criar `MutationQueue` com debounce de 500 ms para Home/Alertas, chaves `perfil:<id>`, requestId UUID e envio sequencial a `salvarMutacoesDashboard`. Atualizar UI otimisticamente; em erro manter pendência e botão “Tentar novamente”. Criar seções Home, Alertas e Pagamentos sem alterar dados do lote.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/dashboard-client.test.js tests/dashboard-html.test.js`

Expected: PASS.

```bash
git add apps-script/DashboardClient.html apps-script/DashboardComponents.html tests/dashboard-client.test.js tests/dashboard-html.test.js
git commit -m "feat: add dashboard configuration and save queue"
```

### Task 9: Regressão, instalação e unificação final

**Files:** modificar `apps-script/INSTRUCOES_INSTALACAO.md`, `LEIA-ME.md`, `CONTEXTO_DO_PROJETO.md`, `CONTEXTO_DO_PROJETO.html`, `apps-script/appsscript.json`; testar toda a suíte.

**Produces:** instalação repetível, validação completa e uma árvore oficial.

- [ ] **Step 1: Adicionar teste de preservação pós-importação**

```javascript
test('importação preserva abas persistentes e muda a versão', () => {
  var antes = obterVersaoDashboardPersistida_();
  executarImportacaoBackend_();
  assert.equal(gestaoPagamentos.getRange(2, 1).getValue(), '2321');
  assert.notEqual(obterVersaoDashboardPersistida_(), antes);
});
```

- [ ] **Step 2: Atualizar instruções**

Documentar criação/cópia dos arquivos, autorização, deployment `Implantar > Nova implantação > App da Web`, restrição à conta autorizada, atualização de deployment e abertura pelo menu TecnoFit.

- [ ] **Step 3: Rodar verificações completas**

Run:

```bash
npm test
git diff --check
```

Expected: PASS e sem erro de whitespace.

- [ ] **Step 4: Validar manualmente**

Conferir desktop/mobile, filtros, subabas, detalhes, perfil, Home configurável, prazos, cache na segunda abertura, nova importação, duas gravações rápidas e estados de erro/vazio.

- [ ] **Step 5: Consolidar árvore e commitar**

Depois de comparar `git diff main...feature/dashboard-xsteam`, remover o worktree somente se não houver conteúdo exclusivo:

```bash
git worktree remove .worktrees/dashboard-xsteam
git branch -d feature/dashboard-xsteam
```

```bash
git add apps-script LEIA-ME.md CONTEXTO_DO_PROJETO.md CONTEXTO_DO_PROJETO.html tests
git commit -m "docs: document xsteam dashboard deployment"
```
