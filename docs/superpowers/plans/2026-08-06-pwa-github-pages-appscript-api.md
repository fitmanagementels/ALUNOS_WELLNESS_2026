# PWA XSTEAM no GitHub Pages com API Apps Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar o dashboard como PWA instalável no GitHub Pages, autenticado por contas Google autorizadas e conectado à planilha existente pelo Apps Script Execution API, com deploy automático de frontend e backend.

**Architecture:** O PWA estático fica em `pwa/`, com assets cacheados pelo service worker e dados/fila isolados por conta. Google Identity Services fornece o token OAuth usado para chamar a única entrada `executarApiDashboard` pela Execution API. O Apps Script continua responsável por Sheets, Drive, importação e validações; os workflows publicam `pwa/` e enviam `apps-script/` com `clasp`.

**Tech Stack:** HTML/CSS/JavaScript sem framework, Google Identity Services, Apps Script Execution API, IndexedDB, Service Worker, GitHub Pages, GitHub Actions, `@google/clasp`, Node 20 e `node:test`.

## Global Constraints

- Preservar planilha mestre, Drive, abas e importador semanal.
- Não versionar `client_secret`, refresh token, `.clasprc.json`, `.clasp.json`, ID token ou dado pessoal.
- O PWA chama somente a Execution API autenticada; não acessa Sheets/Drive nem web app por URL diretamente.
- Cache estático fica no Cache Storage; dados e fila ficam no IndexedDB por conta, com TTL de 24 horas e limpeza no logout/troca de conta.
- Ações admitidas: `bootstrap`, `versao`, `salvarMutacoes`, `analiseChurn`; importação não integra o contrato PWA.
- Todo código começa por teste falhando, depois implementação mínima, teste focal e `npm test`.
- Não apagar nem sobrescrever alterações não relacionadas do worktree compartilhado.

---

## Arquivos previstos

| Caminho | Finalidade |
| --- | --- |
| `apps-script/16_DashboardExecutionApi.gs` | Roteador seguro da Execution API. |
| `apps-script/00_Config.gs`, `08_Main.gs` | URL Pages e menu/backend-only. |
| `pwa/index.html`, `css/app.css`, `js/*.js` | Shell, tela, API, cache, fila e renderização. |
| `pwa/manifest.webmanifest`, `pwa/sw.js`, `assets/` | Instalação, cache estático e marca. |
| `.github/workflows/*.yml` | Deploy independente de PWA e Apps Script. |
| `scripts/gerar-runtime-config.js` | Geração de configuração pública no artefato. |
| `tests/dashboard-execution-api.test.js`, `tests/pwa-*.test.js` | Regressão de API, cache, fila, renderização e deploy. |
| `docs/operacao/CONFIGURACAO_PWA_GITHUB_PAGES.md` | Configuração única de Google Cloud/GitHub. |

### Task 1: Criar o roteador de API com allowlist

**Files:**
- Create: `apps-script/16_DashboardExecutionApi.gs`
- Modify: `apps-script/00_Config.gs`
- Test: `tests/dashboard-execution-api.test.js`

**Interfaces:**
- Consumes: `obterBootstrapDashboard`, `obterVersaoDashboard`, `salvarMutacoesDashboard`, `obterAnaliseChurnsDashboard`.
- Produces: `executarApiDashboard(request)`, com entrada `{ action, payload }` e saída `{ ok, data?, meta?, error? }`.

- [ ] **Step 1: Escrever o teste que falha**

```js
test('API aceita somente as quatro ações do PWA', () => {
  const ctx = loadGas(['apps-script/00_Config.gs', 'apps-script/12_DashboardApi.gs', 'apps-script/14_DashboardMutacoes.gs', 'apps-script/16_DashboardExecutionApi.gs']);
  ctx.obterBootstrapDashboard = () => ({ versao: 'v1' });
  assert.equal(ctx.executarApiDashboard({ action: 'bootstrap', payload: {} }).ok, true);
  assert.equal(ctx.executarApiDashboard({ action: 'executarImportacao', payload: {} }).error.code, 'VALIDATION_ERROR');
});

test('API não revela erro interno ou dado pessoal', () => {
  const ctx = loadGas(['apps-script/00_Config.gs', 'apps-script/16_DashboardExecutionApi.gs']);
  ctx.obterBootstrapDashboard = () => { throw new Error('telefone 85999999999'); };
  const resposta = ctx.executarApiDashboard({ action: 'bootstrap', payload: {} });
  assert.equal(resposta.error.code, 'INTERNAL_ERROR');
  assert.doesNotMatch(resposta.error.message, /85999999999/);
});
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node --test tests/dashboard-execution-api.test.js`
Expected: FAIL porque `executarApiDashboard` não existe.

- [ ] **Step 3: Implementar o roteador**

```js
function executarApiDashboard(request) {
  request = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
  var action = String(request.action || '');
  var payload = request.payload && typeof request.payload === 'object' && !Array.isArray(request.payload) ? request.payload : {};
  var handlers = {
    bootstrap: function () { return obterBootstrapDashboard(); },
    versao: function () { return obterVersaoDashboard(); },
    salvarMutacoes: function () { return salvarMutacoesDashboard(payload); },
    analiseChurn: function () { return obterAnaliseChurnsDashboard(payload); }
  };
  if (!Object.prototype.hasOwnProperty.call(handlers, action)) return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Ação de dashboard inválida.' } };
  try {
    var data = handlers[action]();
    return { ok: true, data: data, meta: { versao: data && data.versao ? String(data.versao) : '', updatedAt: new Date().toISOString() } };
  } catch (erro) {
    console.error('dashboard_execution_api_error', { action: action, tipo: tipoErroDashboardSeguro_(erro) });
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir esta solicitação.' } };
  }
}
```

Adicionar `propriedadeUrlPwa: 'tecnofit.dashboard.public_url'` em `CONFIG.dashboard`.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/dashboard-execution-api.test.js && npm test`
Expected: PASS.

```bash
git add apps-script/00_Config.gs apps-script/16_DashboardExecutionApi.gs tests/dashboard-execution-api.test.js
git commit -m "feat: add authenticated dashboard API router"
```

### Task 2: Tornar Apps Script somente backend

**Files:**
- Modify: `apps-script/08_Main.gs`
- Modify: `apps-script/INSTRUCOES_INSTALACAO.md`
- Test: `tests/main.test.js`

**Interfaces:**
- Consumes: Script Property `tecnofit.dashboard.public_url`.
- Produces: menu que abre GitHub Pages; `doGet` de diagnóstico sem a interface PWA.

- [ ] **Step 1: Escrever teste falhando**

```js
test('menu abre URL Pages e doGet não serve Dashboard HTML', () => {
  const ctx = loadGas(['apps-script/00_Config.gs', 'apps-script/08_Main.gs']);
  ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'https://org.github.io/xsteam/' }) };
  assert.equal(ctx.obterUrlDashboard(), 'https://org.github.io/xsteam/');
  assert.doesNotMatch(String(ctx.doGet), /createTemplateFromFile\('Dashboard'\)/);
});
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node --test tests/main.test.js`
Expected: FAIL porque a URL ainda vem de `ScriptApp.getService().getUrl()`.

- [ ] **Step 3: Implementar URL e diagnóstico**

```js
function obterUrlDashboard() {
  return String(PropertiesService.getScriptProperties().getProperty(CONFIG.dashboard.propriedadeUrlPwa) || '').trim();
}

function doGet() {
  return HtmlService.createHtmlOutput('<!doctype html><title>XSTEAM API</title><p>Backend XSTEAM ativo.</p>');
}
```

Manter `abrirDashboard` lançando erro se a Script Property estiver vazia. `Sidebar.html` permanece inalterado.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/main.test.js && npm test`
Expected: PASS.

```bash
git add apps-script/08_Main.gs apps-script/INSTRUCOES_INSTALACAO.md tests/main.test.js
git commit -m "refactor: make Apps Script dashboard backend-only"
```

### Task 3: Criar o shell PWA e o cliente da Execution API

**Files:**
- Create: `pwa/index.html`
- Create: `pwa/css/app.css`
- Create: `pwa/js/config.js`
- Create: `pwa/js/api.js`
- Create: `pwa/manifest.webmanifest`
- Create: `pwa/runtime-config.js.example`
- Test: `tests/pwa-api.test.js`

**Interfaces:**
- Consumes: `window.XSTEAM_RUNTIME_CONFIG = { oauthClientId, appsScriptId, oauthScopes }`.
- Produces: `XsteamApi.login()`, `XsteamApi.call(action, payload)`, `XsteamApi.logout()`.

- [ ] **Step 1: Escrever teste falhando**

```js
function jsonResponse(value) { return { ok: true, json: async () => value }; }
function loadPwaApi(deps) { return criarClienteApiPwa_(deps); }

test('cliente chama executarApiDashboard pela Execution API', async () => {
  const calls = [];
  const api = loadPwaApi({ fetch: async (url, options) => { calls.push({ url, options }); return jsonResponse({ response: { result: { ok: true, data: { versao: 'v1' } } } }); }, token: 'teste' });
  await api.call('bootstrap', {});
  assert.match(calls[0].url, /script\.googleapis\.com\/v1\/scripts\/script-id:run$/);
  assert.deepEqual(JSON.parse(calls[0].options.body), { function: 'executarApiDashboard', parameters: [{ action: 'bootstrap', payload: {} }], devMode: false });
});
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node --test tests/pwa-api.test.js`
Expected: FAIL porque `pwa/js/api.js` não existe.

- [ ] **Step 3: Implementar shell e chamada autenticada**

`index.html` inclui `viewport`, `theme-color`, `manifest`, `#authScreen`, `#loginButton`, `#authError`, `#app` e scripts HTTPS de Google Identity Services, Chart.js, `runtime-config.js`, `api.js` e `app.js`.

```js
async function call(action, payload) {
  var response = await fetch('https://script.googleapis.com/v1/scripts/' + config.appsScriptId + ':run', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'executarApiDashboard', parameters: [{ action: action, payload: payload || {} }], devMode: false })
  });
  var body = await response.json();
  var result = body && body.response && body.response.result;
  if (!response.ok || !result || result.ok !== true) throw new Error((result && result.error && result.error.message) || 'Não foi possível comunicar com o dashboard.');
  return result.data;
}
```

`runtime-config.js.example` contém somente Client ID, Script ID e scopes públicos; `manifest.webmanifest` usa `display: "standalone"`, `start_url: "./"`, `scope: "./"` e tema `#0a0e0d`.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/pwa-api.test.js && grep -RInE 'client_secret|refresh_token|password' pwa`
Expected: teste PASS e `grep` não retorna segredo.

```bash
git add pwa tests/pwa-api.test.js
git commit -m "feat: add authenticated PWA shell"
```

### Task 4: Migrar interface atual e preservar regras do dashboard

**Files:**
- Create: `pwa/js/app.js`
- Create: `pwa/assets/xsteam-logo.svg`
- Modify: `pwa/index.html`
- Modify: `pwa/css/app.css`
- Create: `tests/pwa-render.test.js`

**Interfaces:**
- Consumes: `XsteamApi.call` e os mesmos DTOs retornados por `obterBootstrapDashboard`.
- Produces: Home, Financeiro, Acompanhamento, Fluxo e Configurações sem `google.script.run`.

- [ ] **Step 1: Escrever teste falhando**

```js
test('PWA contém páginas e UX de Leads sem google.script.run', () => {
  const app = fs.readFileSync('pwa/js/app.js', 'utf8');
  for (const title of ['Home', 'Financeiro', 'Acompanhamento', 'Fluxo', 'Configurações']) assert.match(app, new RegExp(title));
  assert.match(app, /grupoLeadFluxo/);
  assert.match(app, /lead-list-grid/);
  assert.doesNotMatch(app, /google\.script\.run/);
});
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node --test tests/pwa-render.test.js`
Expected: FAIL porque `pwa/js/app.js` não existe.

- [ ] **Step 3: Migrar por extração controlada**

1. Transferir a estrutura de `DashboardComponents.html` para `index.html`, preservando sidebar desktop, dock móvel de cinco ícones e modal acessível.
2. Transferir tokens, media queries, layout, cards, Leads e estados de `DashboardStyles.html` para `app.css`.
3. Transferir a renderização de `DashboardClient.html` para `app.js`; substituir apenas o transporte por:

```js
var nomeDaAcao = { obterBootstrapDashboard: 'bootstrap', obterVersaoDashboard: 'versao', salvarMutacoesDashboard: 'salvarMutacoes', obterAnaliseChurnsDashboard: 'analiseChurn' };
function call(name, argument) { return XsteamApi.call(nomeDaAcao[name], argument); }
```

4. Reutilizar o SVG oficial da marca como `pwa/assets/xsteam-logo.svg`.
5. Não alterar métricas, filtros, pop-ups, classificação, status de Lead, fila otimista nem regras de Churn nesta tarefa.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/pwa-render.test.js tests/dashboard-html.test.js && npm test`
Expected: PASS.

```bash
git add pwa tests/pwa-render.test.js
git commit -m "feat: migrate dashboard interface to static PWA"
```

### Task 5: Implementar cache e fila por conta

**Files:**
- Create: `pwa/js/cache.js`
- Create: `pwa/js/queue.js`
- Modify: `pwa/js/app.js`
- Test: `tests/pwa-cache.test.js`
- Test: `tests/pwa-queue.test.js`

**Interfaces:**
- Produces `XsteamCache.get(accountId, key)`, `set(accountId, key, value)`, `clearAccount(accountId)`.
- Produces `XsteamQueue.enqueue(accountId, patch, optimistic, rollback)`, `flush(send)`, `retry()`.

- [ ] **Step 1: Escrever testes falhando**

```js
function memoriaPwa() {
  const dados = new Map();
  return { get: async key => dados.get(key) || null, set: async (key, value) => dados.set(key, value), del: async key => dados.delete(key) };
}
function createTestCache(options) { return criarCachePwa_({ store: memoriaPwa(), now: options.now }); }
function createTestQueue() { return criarFilaPwa_({ persistir: async () => {} }); }

test('cache não cruza contas e expira em 24 horas', async () => {
  const cache = await createTestCache({ now: () => 1000 });
  await cache.set('conta-a', 'bootstrap', { versao: '1' });
  assert.equal(await cache.get('conta-b', 'bootstrap'), null);
  cache.now = () => 86401001;
  assert.equal(await cache.get('conta-a', 'bootstrap'), null);
});

test('fila envia patches em ordem', async () => {
  const queue = createTestQueue();
  queue.enqueue('conta-a', { tipo: 'fluxoLead', valores: { id: '1' } }, () => {}, () => {});
  queue.enqueue('conta-a', { tipo: 'fluxoLead', valores: { id: '2' } }, () => {}, () => {});
  const enviados = [];
  await queue.flush(async patch => enviados.push(patch.valores.id));
  assert.deepEqual(enviados, ['1', '2']);
});
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node --test tests/pwa-cache.test.js tests/pwa-queue.test.js`
Expected: FAIL porque os módulos não existem.

- [ ] **Step 3: Implementar IndexedDB e integração**

Usar banco `xsteam-pwa-v1`, stores `cache` e `queue`, chave `accountId|key` e `expiresAt = Date.now() + 86400000`. Expor `criarCachePwa_({ store, now })` para os testes injetarem o store em memória; em produção, `store` usa IndexedDB. Renderizar cache primeiro e chamar bootstrap novo em seguida:

```js
var cached = await XsteamCache.get(session.accountId, 'bootstrap');
if (cached) renderBootstrap(cached, { stale: true });
var fresh = await XsteamApi.call('bootstrap', {});
await XsteamCache.set(session.accountId, 'bootstrap', fresh);
renderBootstrap(fresh, { stale: false });
```

Em logout/troca de conta, limpar cache da conta e parar render pendente da sessão anterior. Em `UNAUTHORIZED`, voltar à tela de login sem tentar enviar a fila.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/pwa-cache.test.js tests/pwa-queue.test.js && npm test`
Expected: PASS.

```bash
git add pwa/js/cache.js pwa/js/queue.js pwa/js/app.js tests/pwa-cache.test.js tests/pwa-queue.test.js
git commit -m "feat: cache dashboard data per account"
```

### Task 6: Instalação PWA e remoção dos HTMLs do Apps Script

**Files:**
- Create: `pwa/sw.js`
- Modify: `pwa/index.html`
- Delete: `apps-script/Dashboard.html`
- Delete: `apps-script/DashboardClient.html`
- Delete: `apps-script/DashboardComponents.html`
- Delete: `apps-script/DashboardStyles.html`
- Delete: `apps-script/XsteamLogo.html`
- Test: `tests/pwa-render.test.js`

**Interfaces:**
- Consumes: assets listados em `STATIC_ASSETS`.
- Produces: instalação standalone e cache sem dados de API.

- [ ] **Step 1: Escrever teste falhando**

```js
test('worker cacheia apenas assets e Apps Script não contém HTML do dashboard', () => {
  const worker = fs.readFileSync('pwa/sw.js', 'utf8');
  assert.match(worker, /addAll\(STATIC_ASSETS\)/);
  assert.doesNotMatch(worker, /script\.googleapis\.com/);
  for (const name of ['Dashboard.html', 'DashboardClient.html', 'DashboardComponents.html', 'DashboardStyles.html', 'XsteamLogo.html']) assert.equal(fs.existsSync(path.join('apps-script', name)), false);
});
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node --test tests/pwa-render.test.js`
Expected: FAIL porque worker não existe e os arquivos antigos ainda existem.

- [ ] **Step 3: Implementar worker e registrar**

```js
var CACHE_NAME = 'xsteam-static-v1';
var STATIC_ASSETS = ['./', './css/app.css', './js/config.js', './js/api.js', './js/cache.js', './js/queue.js', './js/app.js', './assets/xsteam-logo.svg', './manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});
```

Registrar o worker no `DOMContentLoaded`, remover os cinco arquivos antigos e manter `Sidebar.html`.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/pwa-render.test.js && npm test`
Expected: PASS.

```bash
git add -A apps-script pwa tests/pwa-render.test.js
git commit -m "feat: make XSTEAM dashboard installable PWA"
```

### Task 7: Criar deploy automático de Pages e Apps Script

**Files:**
- Create: `scripts/gerar-runtime-config.js`
- Create: `.github/workflows/deploy-pages.yml`
- Create: `.github/workflows/deploy-apps-script.yml`
- Modify: `.gitignore`
- Test: `tests/deploy-config.test.js`

**Interfaces:**
- Consumes Variables `PUBLIC_OAUTH_CLIENT_ID`, `PUBLIC_APPS_SCRIPT_ID`, `PUBLIC_OAUTH_SCOPES`; Secrets `CLASPRC_JSON`, `APPS_SCRIPT_ID`, `APPS_SCRIPT_API_DEPLOYMENT_ID`.
- Produces `pwa/runtime-config.js` no artefato e implantação Apps Script atualizada.

- [ ] **Step 1: Escrever teste falhando**

```js
const { gerarRuntimeConfig } = require('../scripts/gerar-runtime-config');
test('gerador só aceita configuração pública', () => {
  assert.throws(() => gerarRuntimeConfig({ PUBLIC_OAUTH_CLIENT_ID: 'id', PUBLIC_APPS_SCRIPT_ID: 'script', CLIENT_SECRET: 'segredo' }), /CLIENT_SECRET/);
  assert.match(gerarRuntimeConfig({ PUBLIC_OAUTH_CLIENT_ID: 'id', PUBLIC_APPS_SCRIPT_ID: 'script', PUBLIC_OAUTH_SCOPES: 'scope-a scope-b' }), /oauthClientId: "id"/);
});
```

- [ ] **Step 2: Executar e confirmar falha**

Run: `node --test tests/deploy-config.test.js`
Expected: FAIL porque gerador não existe.

- [ ] **Step 3: Implementar workflows**

`deploy-pages.yml`: gatilho `push` na `main` para `pwa/**`, `scripts/gerar-runtime-config.js` e o workflow; executar `npm ci`, `npm test`, gerar config, `actions/upload-pages-artifact@v3` com `path: pwa`, depois `actions/deploy-pages@v4` com permissões `pages: write` e `id-token: write`.

`deploy-apps-script.yml`: gatilho `push` na `main` para `apps-script/**` e o workflow; executar testes e depois:

```bash
npm install --global @google/clasp@2.5.0
printf '%s' "$CLASPRC_JSON" > "$HOME/.clasprc.json"
printf '{"scriptId":"%s","rootDir":"apps-script"}\n' "$APPS_SCRIPT_ID" > .clasp.json
clasp push --force
clasp deploy --deploymentId "$APPS_SCRIPT_API_DEPLOYMENT_ID" --description "GitHub ${GITHUB_SHA}"
```

Adicionar `pwa/runtime-config.js` ao `.gitignore`.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/deploy-config.test.js && npm test && git diff --check`
Expected: PASS e nenhum segredo em diff.

```bash
git add .github scripts/gerar-runtime-config.js .gitignore tests/deploy-config.test.js
git commit -m "ci: deploy PWA and Apps Script from main"
```

### Task 8: Configurar produção e validar

**Files:**
- Create: `docs/operacao/CONFIGURACAO_PWA_GITHUB_PAGES.md`
- Modify: `apps-script/INSTRUCOES_INSTALACAO.md`

**Interfaces:**
- Consumes IDs/URLs da conta proprietária, guardados fora do repositório.
- Produces PWA que responde somente para contas Google autorizadas.

- [ ] **Step 1: Documentar checklist único**

Documentar: associar Apps Script ao Cloud Project padrão; ativar Apps Script API; criar OAuth Client ID Web; registrar `https://<org>.github.io`; criar API Executable; adicionar contas como test users; configurar GitHub Pages por Actions; criar Variables/Secrets da Task 7; e definir Script Property `tecnofit.dashboard.public_url` terminada em `/`.

- [ ] **Step 2: Publicar**

Run: `git push origin main`
Expected: workflows verdes, URL HTTPS e deployment API atualizado.

- [ ] **Step 3: Validar em produção**

1. Aba anônima: pede Google e não mostra dados antes de login.
2. Conta não autorizada: acesso recusado sem dados em cache.
3. Conta autorizada: páginas Home, Financeiro, Acompanhamento, Fluxo e Configurações carregam.
4. Criar/editar Lead e Churn: alteração visual imediata, persistência após refresh e retry após falha temporária.
5. Instalar no celular: abre standalone, sem barra branca do Apps Script.
6. Importar pelo Sidebar: PWA vê nova versão da base.

- [ ] **Step 4: Regressão e commit**

Run: `npm test && git diff --check`
Expected: PASS.

```bash
git add docs/operacao/CONFIGURACAO_PWA_GITHUB_PAGES.md apps-script/INSTRUCOES_INSTALACAO.md
git commit -m "docs: add PWA production setup guide"
```

## Revisão do plano

- Cobertura: Tasks 1–2 implementam API/backend-only; 3–6 implementam PWA, UX atual, cache/fila e instalação; 7 automatiza deploy; 8 configura e testa ambiente real.
- Segurança: segredos ficam apenas em GitHub Secrets; Client ID e Script ID são a única configuração pública; Cache Storage não recebe respostas da API.
- Coerência: o contrato de quatro ações é idêntico no roteador e no transporte PWA.
- Escopo: não cria perfis, banco externo, autenticação por senha ou dashboard público.
