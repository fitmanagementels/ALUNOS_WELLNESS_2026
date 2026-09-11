# Ícone do PWA XSTEAM Gestão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir a marca oficial XSTEAM com o marcador de duas barras diagonais no ícone instalável do PWA Gestão.

**Architecture:** O manifesto continuará usando SVG maskable. Um novo ativo isolado em `pwa/assets/` conterá a marca oficial e o marcador; o dashboard continuará utilizando os símbolos internos existentes.

**Tech Stack:** SVG, Web App Manifest, Node.js test runner.

## Global Constraints

- Não alterar Apps Script, Worker, dados, autenticação ou telas do PWA.
- Usar somente SVG local e o manifesto existente.
- O marcador deve possuir duas barras pretas diagonais finas no canto inferior direito.

---

### Task 1: Publicar o ícone de Gestão

**Files:**
- Create: `pwa/assets/xsteam-gestao-icon.svg`
- Modify: `pwa/manifest.webmanifest`
- Modify: `tests/pwa-shell.test.js`

**Interfaces:**
- Consumes: `pwa/manifest.webmanifest` e o símbolo oficial já usado em `pwa/index.html`.
- Produces: `./assets/xsteam-gestao-icon.svg`, referenciado por `manifest.icons[0].src`.

- [ ] **Step 1: Write the failing test**

```js
assert.equal(manifest.icons[0].src, './assets/xsteam-gestao-icon.svg');
assert.match(fs.readFileSync('pwa/assets/xsteam-gestao-icon.svg', 'utf8'), /data-variant="gestao"/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/pwa-shell.test.js`

Expected: FAIL because the manifest still references `xsteam-icon.svg`.

- [ ] **Step 3: Write minimal implementation**

Create the SVG with a lime rounded rectangle, the existing official XSTEAM symbol, and two short black diagonal marker paths. Change the manifest icon source to `./assets/xsteam-gestao-icon.svg`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS with all tests green.

- [ ] **Step 5: Commit**

```bash
git add pwa/assets/xsteam-gestao-icon.svg pwa/manifest.webmanifest tests/pwa-shell.test.js
git commit -m "feat: add XSTEAM Gestão app icon"
```
