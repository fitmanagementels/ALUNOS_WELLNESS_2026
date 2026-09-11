# Confiabilidade de Salvamento dos Perfis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confirmar o salvamento de perfis no servidor e impedir a publicação de frontend incompatível com o Apps Script.

**Architecture:** A fila de mutações passa a resolver ou rejeitar uma Promise por patch; o modal aguarda esse resultado. O Apps Script anuncia `capacidades.perfilAluno`, e os workflows passam a falhar sem credenciais e a validar essa capacidade antes do Pages.

**Tech Stack:** JavaScript ES5, Google Apps Script, GitHub Actions, Node.js `node:test`.

## Global Constraints

- Nunca expor detalhes internos, segredos ou dados de alunos em mensagens públicas.
- Verificações de deploy são somente de leitura.
- Workflow sem configuração de Apps Script deve falhar, nunca registrar sucesso silencioso.

---

### Task 1: Aguardar a confirmação do servidor no modal

**Files:**

- Modify: `pwa/js/dashboard.js:594-600`
- Modify: `pwa/js/student-profiles.js:404-435`
- Test: `tests/dashboard-html.test.js`
- Test: `tests/student-profiles.test.js`

**Interfaces:**

- Consumes: `enqueue(patch)`.
- Produces: `Promise` resolvida após `salvarMutacoesDashboard` com sucesso.

- [ ] **Step 1: Write failing tests**

```js
assert.match(client, /return new Promise\(function \(resolve, reject\)/);
assert.match(client, /entry\.resolve\(response\)/);
assert.match(client, /entry\.reject\(error\)/);
assert.match(profileClient, /Promise\.resolve\(options\.onSave\(patch\)\)/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/dashboard-html.test.js && node tests/student-profiles.test.js`

Expected: FAIL because the queue does not return a Promise and the dialog closes immediately.

- [ ] **Step 3: Write minimal implementation**

```js
function enqueue(patch) {
  return new Promise(function (resolve, reject) {
    var entry = { patch: patch, rollback: aplicarMutacaoOtimista(patch), resolve: resolve, reject: reject };
    state.mutationQueue.push(entry);
    flushQueue();
  });
}
```

On success the batch resolves every entry; on failure it reverts and rejects every entry. The modal closes only in `.then` and re-enables the submit button in `.catch`.

- [ ] **Step 4: Run focused tests**

Run: `node tests/dashboard-html.test.js && node tests/student-profiles.test.js`

Expected: PASS.

### Task 2: Declare the backend capability

**Files:**

- Modify: `apps-script/12_DashboardApi.gs:309-320`
- Test: `tests/dashboard-api.test.js`

- [ ] **Step 1: Write failing test**

```js
assert.deepEqual(gas.obterVersaoDashboard().capacidades, { perfilAluno: true });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/dashboard-api.test.js`

Expected: FAIL because `capacidades` is absent.

- [ ] **Step 3: Write minimal implementation**

```js
return { versao: versao, atualizadoEm: atualizadoEm, capacidades: { perfilAluno: true } };
```

- [ ] **Step 4: Run focused test**

Run: `node tests/dashboard-api.test.js`

Expected: PASS.

### Task 3: Block incomplete deployments

**Files:**

- Modify: `.github/workflows/deploy-apps-script.yml`
- Modify: `.github/workflows/deploy-pages.yml`
- Test: `tests/deploy-config.test.js`

- [ ] **Step 1: Write failing tests**

```js
assert.doesNotMatch(appsScriptWorkflow, /ready=false/);
assert.match(pagesWorkflow, /capacidades\.perfilAluno !== true/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/deploy-config.test.js`

Expected: FAIL because the Apps Script workflow skips and Pages does not validate the API capability.

- [ ] **Step 3: Write minimal implementation**

The Apps Script workflow exits 1 if required secrets are absent. The Pages workflow sends a read-only `versao` request to the public Worker before uploading the artifact and exits 1 unless `data.capacidades.perfilAluno === true`.

- [ ] **Step 4: Run focused test**

Run: `node tests/deploy-config.test.js`

Expected: PASS.

### Task 4: Refresh installed PWA and verify all changes

**Files:**

- Modify: `pwa/sw.js:1`
- Modify: `tests/pwa-shell.test.js:18`

- [ ] **Step 1: Write failing test**

```js
assert.match(worker, /xsteam-static-v8/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/pwa-shell.test.js`

Expected: FAIL because the worker has cache `xsteam-static-v7`.

- [ ] **Step 3: Write minimal implementation**

```js
var CACHE_NAME = 'xsteam-static-v8';
```

- [ ] **Step 4: Run verification and commit**

Run: `npm test && git diff --check`

Expected: PASS with no whitespace errors.

```bash
git add apps-script/12_DashboardApi.gs pwa/js/dashboard.js pwa/js/student-profiles.js pwa/sw.js tests .github/workflows docs/superpowers
git commit -m "fix: make profile saves reliable"
```
