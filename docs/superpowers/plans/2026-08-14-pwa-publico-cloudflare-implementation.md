# PWA público via Cloudflare Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover o login Google do PWA e conectar GitHub Pages à planilha mestre por um Cloudflare Worker público e um Web App Apps Script protegido por chave interna.

**Architecture:** O navegador chama uma API pública no Worker, que aceita apenas ações explicitamente permitidas e faz a ponte com o `doPost` do Apps Script. O Apps Script executa como proprietário, valida uma chave compartilhada recebida somente do Worker e reaproveita `executarApiDashboard()` para preservar regras existentes de dados e mutações.

**Tech Stack:** HTML/CSS/JavaScript estático, GitHub Pages e Actions, Cloudflare Workers (ES Modules), Google Apps Script V8, Google Sheets, Node.js 20 `node:test`.

## Global Constraints

- O acesso de usuários será público por URL, sem identidade, função ou permissão individual.
- A planilha mestre permanece a única fonte de dados; Worker não armazena dados pessoais.
- Não incluir chaves, telefones, IDs de aluno, payloads ou planilhas em logs, arquivos do PWA ou Git.
- O frontend não pode carregar Google Identity Services nem chamar `script.googleapis.com`.
- O Worker aceita somente `bootstrap`, `versao`, `salvarMutacoes` e `analiseChurn`.
- O Web App Apps Script executa como o proprietário e requer `APPS_SCRIPT_SHARED_SECRET` em todas as chamadas de API.
- Manter cache local, atualizações otimistas e fila local de mutações do PWA.
- Preservar arquivos não rastreados do usuário: `.vscode/`, `cancelados-geral-tratado.xls` e `docs/FEEDBACKS_E_STATUS_COMERCIAL.md`.
- Executar `npm test` antes de cada commit e antes da entrega.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `apps-script/17_DashboardPublicWebApi.gs` | Adaptador HTTP público do Apps Script: decodifica JSON, valida a chave e chama a API existente. |
| `apps-script/08_Main.gs` | Mantém o `doGet` informativo e delega `doPost` ao adaptador público. |
| `worker/src/index.js` | API pública com CORS, validação de contrato, limite básico em memória e proxy para Apps Script. |
| `worker/wrangler.jsonc` | Metadados de publicação do Worker, sem segredos. |
| `worker/package.json` | Scripts locais de teste e publicação. |
| `pwa/js/config.js` | Lê somente `workerUrl` da configuração pública. |
| `pwa/js/api.js` | Transporte sem OAuth para o endpoint Worker. |
| `pwa/js/app.js` | Inicializa o dashboard diretamente, mantendo o carregamento existente. |
| `pwa/index.html` | Remove tela e SDK de login Google. |
| `pwa/runtime-config.js.example` | Exemplo sem OAuth, contendo somente URL pública do Worker. |
| `scripts/gerar-runtime-config.js` | Gera `runtime-config.js` a partir de `PUBLIC_WORKER_URL`. |
| `.github/workflows/deploy-pages.yml` | Publica Pages usando somente `PUBLIC_WORKER_URL`. |
| `.github/workflows/deploy-worker.yml` | Publica Worker quando sua pasta mudar, usando GitHub Secrets. |
| `tests/dashboard-public-web-api.test.js` | Contrato e segurança do adaptador `doPost`. |
| `tests/worker-api.test.js` | CORS, ações permitidas, falhas e proxy do Worker. |
| `tests/pwa-shell.test.js` | Ausência de OAuth/login e inicialização direta do PWA. |
| `tests/deploy-config.test.js` | Configuração pública e workflows de publicação. |
| `docs/operacao/CONFIGURACAO_PWA_PUBLICO.md` | Única configuração administrativa necessária, reversão e operação. |

## Task 1: Criar o adaptador HTTP seguro no Apps Script

**Files:**
- Create: `apps-script/17_DashboardPublicWebApi.gs`
- Modify: `apps-script/08_Main.gs:70-72`
- Test: `tests/dashboard-public-web-api.test.js`

**Interfaces:**
- Consumes: `executarApiDashboard(request)` de `apps-script/16_DashboardExecutionApi.gs`.
- Produces: `responderApiPublicaDashboard_(e)` e `respostaJsonDashboardPublica_(status)`.
- Runtime input: `e.postData.contents` JSON com `{ "sharedSecret", "action", "payload" }`.

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

function setup(additions = {}) {
  return loadGas([
    'apps-script/00_Config.gs',
    'apps-script/16_DashboardExecutionApi.gs',
    'apps-script/17_DashboardPublicWebApi.gs'
  ], {
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'chave-teste' }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: content => ({ content, setMimeType() { return this; } })
    },
    console: { error() {} },
    obterBootstrapDashboard: () => ({ versao: 'v1' }),
    ...additions
  });
}

test('adaptador público encaminha somente pedido autenticado para a API interna', () => {
  const gas = setup();
  const output = gas.responderApiPublicaDashboard_({
    postData: { contents: JSON.stringify({ sharedSecret: 'chave-teste', action: 'bootstrap', payload: {} }) }
  });
  assert.deepEqual(JSON.parse(output.content), { ok: true, data: { versao: 'v1' }, meta: { versao: 'v1' } });
});

test('adaptador público oculta chave inválida e JSON malformado', () => {
  const gas = setup();
  const semChave = gas.responderApiPublicaDashboard_({ postData: { contents: '{}' } });
  const invalido = gas.responderApiPublicaDashboard_({ postData: { contents: '{' } });
  assert.equal(JSON.parse(semChave.content).error.code, 'UNAUTHORIZED');
  assert.equal(JSON.parse(invalido.content).error.code, 'VALIDATION_ERROR');
  assert.doesNotMatch(semChave.content, /chave-teste/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/dashboard-public-web-api.test.js`

Expected: FAIL because `apps-script/17_DashboardPublicWebApi.gs` does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
function segredoCompartilhadoDashboard_() {
  return String(PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SHARED_SECRET') || '');
}

function respostaJsonDashboardPublica_(corpo) {
  return ContentService.createTextOutput(JSON.stringify(corpo))
    .setMimeType(ContentService.MimeType.JSON);
}

function responderApiPublicaDashboard_(evento) {
  var envelope;
  try {
    envelope = JSON.parse(String(evento && evento.postData && evento.postData.contents || ''));
  } catch (erro) {
    return respostaJsonDashboardPublica_({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' } });
  }
  if (!envelope || String(envelope.sharedSecret || '') !== segredoCompartilhadoDashboard_()) {
    return respostaJsonDashboardPublica_({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Não autorizado.' } });
  }
  return respostaJsonDashboardPublica_(executarApiDashboard({
    action: String(envelope.action || ''),
    payload: envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {}
  }));
}
```

Change the main entrypoint to:

```js
function doPost(e) {
  return responderApiPublicaDashboard_(e);
}
```

Keep `doGet()` as the existing non-data informational HTML response, so an accidental browser visit never returns dashboard data.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/dashboard-public-web-api.test.js tests/dashboard-execution-api.test.js`

Expected: PASS, including the existing action allow-list test.

- [ ] **Step 5: Commit**

```bash
git add apps-script/08_Main.gs apps-script/17_DashboardPublicWebApi.gs tests/dashboard-public-web-api.test.js
git commit -m "feat: add protected public Apps Script endpoint"
```

## Task 2: Implementar o Worker público sem persistência de dados

**Files:**
- Create: `worker/src/index.js`
- Create: `worker/wrangler.jsonc`
- Create: `worker/package.json`
- Test: `tests/worker-api.test.js`

**Interfaces:**
- Consumes: `env.APPS_SCRIPT_WEBAPP_URL`, `env.APPS_SCRIPT_SHARED_SECRET` e corpo `{ action, payload }`.
- Produces: `export default { fetch(request, env) }` e a mesma resposta pública padronizada da API de dashboard.

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const worker = require('../worker/src/index.js');

const env = {
  APPS_SCRIPT_WEBAPP_URL: 'https://script.google.com/macros/s/test/exec',
  APPS_SCRIPT_SHARED_SECRET: 'segredo-interno'
};

test('worker responde CORS e encaminha ação aceita sem expor o segredo', async () => {
  let upstreamBody = '';
  const response = await worker.fetch(new Request('https://api.example/api', {
    method: 'POST',
    headers: { origin: 'https://fitmanagementels.github.io', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'bootstrap', payload: {} })
  }), env, {
    fetch: async (_url, init) => {
      upstreamBody = init.body;
      return new Response(JSON.stringify({ ok: true, data: { versao: 'v1' }, meta: { versao: 'v1' } }));
    }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://fitmanagementels.github.io');
  assert.equal(JSON.parse(upstreamBody).sharedSecret, 'segredo-interno');
  assert.doesNotMatch(await response.text(), /segredo-interno/);
});

test('worker rejeita origem, método e ações fora do contrato', async () => {
  const origem = await worker.fetch(new Request('https://api.example/api', { method: 'POST', headers: { origin: 'https://example.com' }, body: '{}' }), env);
  const metodo = await worker.fetch(new Request('https://api.example/api', { method: 'GET' }), env);
  const acao = await worker.fetch(new Request('https://api.example/api', { method: 'POST', headers: { origin: 'https://fitmanagementels.github.io' }, body: JSON.stringify({ action: 'importar' }) }), env);
  assert.equal(origem.status, 403);
  assert.equal(metodo.status, 405);
  assert.equal(acao.status, 400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/worker-api.test.js`

Expected: FAIL because `worker/src/index.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

```js
const ALLOWED_ORIGIN = 'https://fitmanagementels.github.io';
const ACTIONS = new Set(['bootstrap', 'versao', 'salvarMutacoes', 'analiseChurn']);
const hits = new Map();

function json(body, status = 200, origin = '') {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (origin === ALLOWED_ORIGIN) headers['access-control-allow-origin'] = ALLOWED_ORIGIN;
  return new Response(JSON.stringify(body), { status, headers });
}

function allowed(origin) { return origin === ALLOWED_ORIGIN; }

export default {
  async fetch(request, env, runtime = { fetch }) {
    const origin = request.headers.get('origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': ALLOWED_ORIGIN,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400'
    }});
    if (!allowed(origin)) return json({ ok: false, error: { code: 'FORBIDDEN', message: 'Origem não permitida.' } }, 403);
    if (request.method !== 'POST') return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, 405, origin);
    let requestBody;
    try { requestBody = await request.json(); } catch (_) { return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pedido inválido.' } }, 400, origin); }
    if (!ACTIONS.has(String(requestBody && requestBody.action || ''))) return json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Ação inválida.' } }, 400, origin);
    const upstream = await runtime.fetch(env.APPS_SCRIPT_WEBAPP_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ sharedSecret: env.APPS_SCRIPT_SHARED_SECRET, action: requestBody.action, payload: requestBody.payload || {} })
    });
    let result;
    try { result = await upstream.json(); } catch (_) { result = { ok: false, error: { code: 'UPSTREAM_ERROR', message: 'Serviço indisponível.' } }; }
    return json(result, upstream.ok ? 200 : 502, origin);
  }
};
```

Use ES Module syntax in the Worker and adapt the test loader to `await import()` if Node reports `Unexpected token 'export'`. Add `"type": "module"` to `worker/package.json`; then make the test ESM with `await import('../worker/src/index.js')`.

Create `worker/wrangler.jsonc` without secrets:

```json
{
  "name": "xsteam-dashboard-api",
  "main": "src/index.js",
  "compatibility_date": "2026-08-14"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/worker-api.test.js`

Expected: PASS. Extend the test with an upstream 500 response and assert `502` plus no secret in the returned body.

- [ ] **Step 5: Commit**

```bash
git add worker tests/worker-api.test.js
git commit -m "feat: add public dashboard API worker"
```

## Task 3: Remover OAuth do cliente e inicializar o PWA diretamente

**Files:**
- Modify: `pwa/index.html`
- Modify: `pwa/js/config.js`
- Modify: `pwa/js/api.js`
- Modify: `pwa/js/app.js`
- Modify: `pwa/runtime-config.js.example`
- Test: `tests/pwa-shell.test.js`

**Interfaces:**
- Consumes: `window.XSTEAM_RUNTIME_CONFIG.workerUrl`.
- Produces: `window.XsteamApi.call(action, payload)` sem `login`, `logout` ou token.

- [ ] **Step 1: Write the failing test**

```js
test('shell PWA inicia sem login Google e usa configuração de Worker', () => {
  const html = fs.readFileSync('pwa/index.html', 'utf8');
  const api = fs.readFileSync('pwa/js/api.js', 'utf8');
  const config = fs.readFileSync('pwa/runtime-config.js.example', 'utf8');
  assert.doesNotMatch(html, /accounts\.google\.com\/gsi\/client/);
  assert.doesNotMatch(html, /loginButton|authScreen/);
  assert.match(api, /XsteamConfig\.workerUrl/);
  assert.doesNotMatch(api, /requestAccessToken|script\.googleapis\.com/);
  assert.match(config, /workerUrl/);
  assert.doesNotMatch(config, /oauthClientId|client_secret|password/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/pwa-shell.test.js`

Expected: FAIL because the shell still contains the Google SDK and login screen.

- [ ] **Step 3: Write minimal implementation**

Replace the config normalization with:

```js
(function () {
  var value = window.XSTEAM_RUNTIME_CONFIG || {};
  window.XsteamConfig = Object.freeze({ workerUrl: String(value.workerUrl || '').replace(/\/$/, '') });
}());
```

Implement the HTTP client as:

```js
(function () {
  function error(message, code) { var value = new Error(message); value.code = code || 'API_ERROR'; return value; }
  async function call(action, payload) {
    if (!window.XsteamConfig || !XsteamConfig.workerUrl) throw error('O PWA ainda não foi configurado.', 'CONFIG_ERROR');
    var response = await fetch(XsteamConfig.workerUrl + '/api', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: action, payload: payload || {} })
    });
    var body; try { body = await response.json(); } catch (_) { body = {}; }
    if (!response.ok || body.ok !== true) throw error(body.error && body.error.message || 'Não foi possível comunicar com o dashboard.', body.error && body.error.code);
    return body.data;
  }
  window.XsteamApi = { call: call };
}());
```

Remove `authScreen`, the Google Identity `<script>` and all login listeners. On `DOMContentLoaded`, reveal `#app`, reveal `#loading-screen`, then append `./js/dashboard.js` and call `window.iniciarDashboardPwa()`. Keep the service-worker registration unchanged.

Use this public example only:

```js
window.XSTEAM_RUNTIME_CONFIG = { workerUrl: 'SUBSTITUIDO_NO_DEPLOY' };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/pwa-shell.test.js`

Expected: PASS, including manifest and service-worker checks.

- [ ] **Step 5: Commit**

```bash
git add pwa/index.html pwa/js/config.js pwa/js/api.js pwa/js/app.js pwa/runtime-config.js.example tests/pwa-shell.test.js
git commit -m "feat: start PWA without Google login"
```

## Task 4: Adaptar a publicação para configuração pública do Worker

**Files:**
- Modify: `scripts/gerar-runtime-config.js`
- Modify: `.github/workflows/deploy-pages.yml`
- Create: `.github/workflows/deploy-worker.yml`
- Modify: `tests/deploy-config.test.js`

**Interfaces:**
- Consumes: GitHub Variable `PUBLIC_WORKER_URL`.
- Consumes: GitHub Secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `APPS_SCRIPT_WEBAPP_URL`, `APPS_SCRIPT_SHARED_SECRET`.
- Produces: `pwa/runtime-config.js` com `{ workerUrl }` e Worker publicado automaticamente.

- [ ] **Step 1: Write the failing test**

```js
test('gerador publica somente a URL pública do Worker', () => {
  assert.throws(() => gerarRuntimeConfig({}), /PUBLIC_WORKER_URL/);
  const output = gerarRuntimeConfig({ PUBLIC_WORKER_URL: 'https://xsteam.example.workers.dev/' });
  assert.match(output, /"workerUrl": "https:\/\/xsteam\.example\.workers\.dev"/);
  assert.doesNotMatch(output, /oauthClientId|client_secret|secret/i);
});

test('workflows publicam Pages e Worker sem OAuth público', () => {
  const pages = fs.readFileSync('.github/workflows/deploy-pages.yml', 'utf8');
  const worker = fs.readFileSync('.github/workflows/deploy-worker.yml', 'utf8');
  assert.match(pages, /PUBLIC_WORKER_URL/);
  assert.doesNotMatch(pages, /PUBLIC_OAUTH_CLIENT_ID|PUBLIC_OAUTH_SCOPES/);
  assert.match(worker, /cloudflare\/wrangler-action@v3/);
  assert.match(worker, /APPS_SCRIPT_SHARED_SECRET/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/deploy-config.test.js`

Expected: FAIL because OAuth variables are still required.

- [ ] **Step 3: Write minimal implementation**

Generate only the safe public value:

```js
function gerarRuntimeConfig(env = process.env) {
  for (const name of Object.keys(env)) if (/secret|password|refresh_token/i.test(name)) throw new Error(`Variável não permitida na configuração pública: ${name}`);
  return 'window.XSTEAM_RUNTIME_CONFIG = ' + JSON.stringify({
    workerUrl: required('PUBLIC_WORKER_URL', env).replace(/\/$/, '')
  }, null, 2) + ';\n';
}
```

In `deploy-pages.yml`, replace the job condition and runtime environment with:

```yaml
if: ${{ vars.PUBLIC_WORKER_URL != '' }}
env:
  PUBLIC_WORKER_URL: ${{ vars.PUBLIC_WORKER_URL }}
```

Create this Worker workflow:

```yaml
name: Deploy Worker
on:
  push:
    branches: [main]
    paths: [worker/**, .github/workflows/deploy-worker.yml]
  workflow_dispatch:
permissions:
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: worker
          command: deploy
          secrets: |
            APPS_SCRIPT_WEBAPP_URL
            APPS_SCRIPT_SHARED_SECRET
        env:
          APPS_SCRIPT_WEBAPP_URL: ${{ secrets.APPS_SCRIPT_WEBAPP_URL }}
          APPS_SCRIPT_SHARED_SECRET: ${{ secrets.APPS_SCRIPT_SHARED_SECRET }}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/deploy-config.test.js && npm test`

Expected: PASS for the configuration tests and full suite.

- [ ] **Step 5: Commit**

```bash
git add scripts/gerar-runtime-config.js .github/workflows/deploy-pages.yml .github/workflows/deploy-worker.yml tests/deploy-config.test.js
git commit -m "ci: publish PWA through public worker configuration"
```

## Task 5: Documentar e executar a única configuração administrativa

**Files:**
- Create: `docs/operacao/CONFIGURACAO_PWA_PUBLICO.md`
- Modify: `apps-script/INSTRUCOES_INSTALACAO.md`

**Interfaces:**
- Consumes: Web App URL publicado, uma chave aleatória de 32+ caracteres, conta Cloudflare e repositório GitHub.
- Produces: PWA disponível sem OAuth no Pages e Worker configurado para a planilha.

- [ ] **Step 1: Write the failing documentation acceptance checklist**

Add a checklist that is considered incomplete until all seven items below have been performed and verified:

```markdown
- [ ] Web App Apps Script executa como proprietário e aceita qualquer pessoa.
- [ ] `APPS_SCRIPT_SHARED_SECRET` existe nas Propriedades do Script.
- [ ] `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` existem como secrets do GitHub.
- [ ] `APPS_SCRIPT_WEBAPP_URL` e `APPS_SCRIPT_SHARED_SECRET` existem como secrets do GitHub.
- [ ] Worker foi publicado e sua URL foi copiada.
- [ ] `PUBLIC_WORKER_URL` existe como variável do GitHub.
- [ ] Pages foi publicado e abriu sem login Google.
```

- [ ] **Step 2: Verify the documentation is incomplete before configuration**

Run: `grep -c '\[ \]' docs/operacao/CONFIGURACAO_PWA_PUBLICO.md`

Expected: command returns at least `7`; this confirms the runbook records each administrative action instead of hiding it in code.

- [ ] **Step 3: Write the operational runbook**

Document exact human actions:

1. In Apps Script, add Script Property `APPS_SCRIPT_SHARED_SECRET` with a newly generated 32+ character value.
2. Deploy **Web app**; execute as the owner; access **Anyone**; copy the `/exec` URL.
3. Create Cloudflare API token with Workers Scripts edit permission and copy Cloudflare Account ID.
4. Add the four GitHub Secrets; never use Repository Variables for secrets.
5. Push Worker workflow; capture its `*.workers.dev` URL from the successful Actions log.
6. Add that URL as repository variable `PUBLIC_WORKER_URL` and rerun **Deploy PWA**.
7. Remove obsolete GitHub Variables `PUBLIC_OAUTH_CLIENT_ID`, `PUBLIC_OAUTH_SCOPES` and `PUBLIC_APPS_SCRIPT_DEPLOYMENT_ID` after the public PWA works.
8. Record rollback: restore the prior Pages deployment, delete/revoke Worker token, and clear the Script Property when the public endpoint must stop.

- [ ] **Step 4: Verify documentation and full suite**

Run: `npm test && git diff --check`

Expected: PASS and no whitespace errors.

- [ ] **Step 5: Commit**

```bash
git add docs/operacao/CONFIGURACAO_PWA_PUBLICO.md apps-script/INSTRUCOES_INSTALACAO.md
git commit -m "docs: document public PWA deployment"
```

## Task 6: Publicar, validar produção e remover a rota OAuth

**Files:**
- Modify only if diagnostics reveal an incompatibility: `worker/src/index.js`, `apps-script/17_DashboardPublicWebApi.gs`, `pwa/js/api.js`.
- Test: all existing tests plus manual production checks.

**Interfaces:**
- Consumes: public Pages URL, Worker URL, Web App `/exec` URL and configured secrets.
- Produces: a verified public user flow without Google OAuth.

- [ ] **Step 1: Add any missing regression test before correcting a production defect**

For example, if the Worker receives an Apps Script HTML error page instead of JSON:

```js
test('worker converts resposta não JSON do Apps Script em erro seguro', async () => {
  const response = await worker.fetch(validRequest, env, { fetch: async () => new Response('<html>erro</html>', { status: 500 }) });
  const body = await response.json();
  assert.equal(response.status, 502);
  assert.equal(body.error.code, 'UPSTREAM_ERROR');
});
```

- [ ] **Step 2: Run the failing regression test**

Run: `node --test tests/worker-api.test.js`

Expected: FAIL only if an unhandled real production case was discovered.

- [ ] **Step 3: Apply the narrowest correction**

Keep error text limited to `Serviço indisponível.` and do not serialize upstream HTML, headers, App Script URLs or secrets to the browser.

- [ ] **Step 4: Verify end to end**

Run:

```bash
npm test
curl -sS https://<worker-url>/api -X POST -H 'Origin: https://fitmanagementels.github.io' -H 'Content-Type: application/json' --data '{"action":"versao","payload":{}}'
curl -sS https://fitmanagementels.github.io/BASE_TECNOFIT_WELLNESS/
```

Expected:

- full test suite passes;
- Worker returns `ok: true` for `versao`;
- Pages HTML has no `accounts.google.com/gsi/client`, no `loginButton` and no OAuth client ID;
- opening the Pages URL loads the dashboard without a Google popup;
- create/edit a temporary test lead, observe optimistic interface update, confirm only one matching record in `FLUXO_LEADS`, then remove the temporary record through the normal editing flow.

- [ ] **Step 5: Commit and push only project changes**

```bash
git add apps-script worker pwa scripts .github tests docs
git commit -m "feat: connect public PWA through Cloudflare Worker"
git push origin main
```

Do not stage `.vscode/`, `cancelados-geral-tratado.xls` or `docs/FEEDBACKS_E_STATUS_COMERCIAL.md`.

## Plan self-review

- **Spec coverage:** Tasks 1–2 cover the Web App, shared key, CORS, allowed actions, non-persistent Worker and safe errors. Task 3 covers removal of OAuth while preserving the PWA behavior. Task 4 covers both delivery pipelines and public configuration. Task 5 covers required administrative actions, rollback and obsolete OAuth cleanup. Task 6 covers end-to-end production validation and regression tests.
- **Placeholders:** The plan contains no `TBD` or `TODO`; names, paths, commands, interfaces and error contract are explicit.
- **Type consistency:** PWA → Worker sends `{ action, payload }`; Worker → Apps Script sends `{ sharedSecret, action, payload }`; Apps Script returns `{ ok, data, meta }` or `{ ok, error }` through all boundaries.
- **Scope:** No dashboard calculations, spreadsheet schema, visual layout or user-specific permissions are changed. The plan is limited to public transport and deployment.
