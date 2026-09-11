# Link WhatsApp com Conversa Direta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o ícone de WhatsApp abrir a conversa do aluno no WhatsApp Web do desktop e no WhatsApp móvel.

**Architecture:** A função pura `whatsappUrl` continua normalizando o telefone para E.164 sem `+`. No desktop, ela retornará a rota canônica de conversa do WhatsApp Web, incluindo os parâmetros que classificam o número; no celular, manterá `wa.me`.

**Tech Stack:** JavaScript ES5 no PWA, Node.js `node:test`.

## Global Constraints

- Preservar números brasileiros com código do país `55` e rejeitar entradas inválidas.
- Manter abertura em nova aba e a detecção atual de dispositivo.
- Não enviar mensagem automática ao aluno.

---

### Task 1: Gerar rota canônica de conversa no desktop

**Files:**

- Modify: `tests/student-profiles.test.js:6-17`
- Modify: `pwa/js/student-profiles.js:11-18`

**Interfaces:**

- Consumes: `whatsappUrl(value, mobile)`.
- Produces: URL de chat com telefone E.164 sem sinais ou espaços.

- [ ] **Step 1: Write the failing test**

```js
assert.equal(
  profiles.whatsappUrl('(85) 98840-0309', false),
  'https://web.whatsapp.com/send/?phone=5585988400309&text=&type=phone_number&app_absent=0'
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/student-profiles.test.js`

Expected: FAIL porque a implementação ainda retorna `https://web.whatsapp.com/send?phone=5585988400309`.

- [ ] **Step 3: Write minimal implementation**

```js
return mobile
  ? 'https://wa.me/' + digits
  : 'https://web.whatsapp.com/send/?phone=' + digits + '&text=&type=phone_number&app_absent=0';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/student-profiles.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pwa/js/student-profiles.js tests/student-profiles.test.js docs/superpowers/plans/2026-08-20-link-whatsapp-conversa-direta.md
git commit -m "fix: open direct WhatsApp student chat"
```

### Task 2: Invalidar o cache do PWA

**Files:**

- Modify: `tests/pwa-shell.test.js:18`
- Modify: `pwa/sw.js:1`

**Interfaces:**

- Consumes: `CACHE_NAME` do service worker.
- Produces: um cache novo que inclui o JavaScript com a rota corrigida.

- [ ] **Step 1: Write the failing test**

```js
assert.match(worker, /xsteam-static-v7/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/pwa-shell.test.js`

Expected: FAIL porque o worker ainda declara `xsteam-static-v6`.

- [ ] **Step 3: Write minimal implementation**

```js
var CACHE_NAME = 'xsteam-static-v7';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/pwa-shell.test.js`

Expected: PASS.
