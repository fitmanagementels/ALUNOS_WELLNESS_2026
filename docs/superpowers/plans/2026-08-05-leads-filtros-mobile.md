# Filtros de Leads e dock móvel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar os indicadores de Leads filtros clicáveis e compactar a navegação móvel sem alterar dados da planilha.

**Architecture:** O cliente Apps Script concentra a classificação de Leads e o filtro local em memória. O CSS adapta a mesma estrutura para cinco colunas em desktop e 2 + 2 + 1 no celular; o dock móvel usa SVGs internos e nomes acessíveis.

**Tech Stack:** Google Apps Script HTML Service, JavaScript sem dependências, CSS responsivo e `node:test`.

## Global Constraints

- Não modificar o esquema de `FLUXO_LEADS`.
- Não expor dados de contato fora do botão de WhatsApp já autorizado.
- Manter uma coluna para Leads e uma linha para a dock em telas móveis.
- Preservar o tema escuro XSTEAM e `prefers-reduced-motion` existente.

---

### Task 1: Filtros e status de Leads

**Files:**
- Modify: `apps-script/DashboardClient.html`
- Test: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: itens de `state.bootstrap.fluxo.leads`.
- Produces: `grupoLead_`, `filtrarLeadsFluxo_` e cartões com `aria-pressed`.

- [ ] **Step 1: Write the failing test**

```js
assert.match(client, /function grupoLeadFluxo\(item\)/);
assert.match(client, /Perdidos/);
assert.match(client, /aria-pressed/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/dashboard-html.test.js`

- [ ] **Step 3: Write minimal implementation**

```js
function grupoLeadFluxo(item) {
  if (item.status === 'Perdido') return 'perdidos';
  if (item.status === 'Esfriando') return 'perdendo';
  if (item.status === 'Convertido') return 'convertidos';
  return 'em_trabalho';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/dashboard-html.test.js`

### Task 2: Grade e navegação móvel

**Files:**
- Modify: `apps-script/DashboardComponents.html`
- Modify: `apps-script/DashboardStyles.html`
- Test: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: botões de página com `data-page`.
- Produces: dock compacta com cinco ícones e grade responsiva de Leads.

- [ ] **Step 1: Write the failing test**

```js
assert.match(components, /aria-label="Configurações"/);
assert.match(css, /\.lead-list-grid/);
assert.match(css, /grid-template-columns:\s*repeat\(5/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/dashboard-html.test.js`

- [ ] **Step 3: Write minimal implementation**

```css
.lead-list-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (max-width: 720px) { .lead-list-grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/dashboard-html.test.js`

### Task 3: Verificação integrada

**Files:**
- Test: `tests/dashboard-html.test.js`

- [ ] **Step 1: Run the complete suite**

Run: `npm test`

- [ ] **Step 2: Check Apps Script syntax and whitespace**

Run: `node -e "const fs=require('fs'); for (const f of fs.readdirSync('apps-script').filter(n=>n.endsWith('.gs'))) new Function(fs.readFileSync('apps-script/'+f,'utf8'));" && git diff --check`
