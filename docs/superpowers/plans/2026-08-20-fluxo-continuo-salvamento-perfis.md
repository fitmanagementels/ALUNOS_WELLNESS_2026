# Fluxo contínuo de salvamento de perfis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Salvar um perfil sem bloquear o usuário, mantendo a lista de alunos aberta quando ela já estava aberta.

**Architecture:** O modal envia a alteração para a fila local e fecha no mesmo evento. A Home mantém um estado de expansão somente da sessão; a alteração otimista atualiza o cartão e preserva esse estado enquanto a API grava em segundo plano.

**Tech Stack:** JavaScript modular do PWA, Node.js test runner.

## Global Constraints

- A Home inicia com a lista recolhida em um novo carregamento.
- Uma lista aberta pelo usuário não pode recolher após salvar um perfil.
- Falhas remotas continuam revertendo a alteração e exibindo a tentativa novamente no rodapé.

---

### Task 1: Fechar o modal sem aguardar a rede e preservar a expansão

**Files:**
- Modify: `pwa/js/student-profiles.js`
- Modify: `pwa/js/dashboard.js`
- Test: `tests/student-profiles.test.js`
- Test: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: `options.onSave(patch)` para enfileirar a alteração.
- Produces: `options.expanded` para inicializar a seção e `options.onSave` sem espera de confirmação remota.

- [x] **Step 1: Write the failing tests**

```js
assert.match(client, /Promise\.resolve\(options\.onSave\(patch\)\)\.catch/);
assert.match(client, /setProfilesExpanded\(toggle, content, options\.expanded === true\)/);
assert.match(client, /onExpandedChange/);
```

- [x] **Step 2: Run test to verify it fails**

Run: `node tests/student-profiles.test.js && node tests/dashboard-html.test.js`

Expected: FAIL because o modal ainda aguarda `Promise.resolve(options.onSave(patch))` e a seção inicia sempre recolhida.

- [x] **Step 3: Write minimal implementation**

```js
Promise.resolve(options.onSave(patch)).catch(function () {});
dialog.close();
```

```js
setProfilesExpanded(toggle, content, options.expanded === true);
```

```js
onExpandedChange: function (expanded) { state.profilesExpanded = expanded; }
```

- [x] **Step 4: Run test to verify it passes**

Run: `node tests/student-profiles.test.js && node tests/dashboard-html.test.js && npm test`

Expected: all tests pass.

- [x] **Step 5: Commit**

```bash
git add pwa/js/student-profiles.js pwa/js/dashboard.js tests/student-profiles.test.js tests/dashboard-html.test.js docs/superpowers/plans/2026-08-20-fluxo-continuo-salvamento-perfis.md
git commit -m "fix: manter perfis abertos ao salvar"
```
