# Financeiro: Detalhes e filtro Matriculados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar os recortes de Financeiro clicáveis e adicionar o filtro global Matriculados sem alterar a fonte de dados do dashboard.

**Architecture:** `DashboardClient.html` já possui todos os alunos e contratos no bootstrap local. Uma regra de status agregado será aplicada em `filtered()`, e novos renderizadores de detalhe reutilizarão o modal existente para frequência, hora-aula e quartis do mapa mensal.

**Tech Stack:** Apps Script HTML Service, JavaScript ES5/V8 no navegador e `node --test`.

## Global Constraints

- Usar apenas `apps-script/DashboardClient.html` e os testes de interface; não alterar API, Sheets, cache ou fila.
- Matriculados aceita status ativo, bloqueado, licença e em licença sem depender de acentos ou capitalização.
- O valor por hora-aula é `valor ÷ (frequência semanal × 4,33)`.
- A lista de hora-aula mostra somente aluno, valor do plano e valor por hora-aula.
- Não enviar ou exibir contato.
- Usar a pasta e branch `main` existentes; não criar worktree.

---

### Task 1: Filtro agregado Matriculados

**Files:**
- Modify: `apps-script/DashboardClient.html`
- Modify: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: `state.filters.status`, `syncFilters()` e `filtered()`.
- Produces: `isEnrolledStatus(status)` e opção de status `__matriculados__` que filtra Ativo/Bloqueado/Licença/Em licença.

- [ ] **Step 1: Escrever o teste que falha**

```javascript
test('cliente oferece filtro Matriculados e normaliza os três status elegíveis', () => {
  const client = fs.readFileSync('apps-script/DashboardClient.html', 'utf8');
  assert.match(client, /__matriculados__/);
  assert.match(client, /function isEnrolledStatus\(status\)/);
  assert.match(client, /ativo.*bloqueado.*licenca/s);
});
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `node --test tests/dashboard-html.test.js`

Expected: FAIL porque o cliente ainda só compara status por igualdade literal.

- [ ] **Step 3: Implementar o filtro**

Adicionar `isEnrolledStatus(status)`, que usa `normalize('NFD')`, remove diacríticos e compara `ativo`, `bloqueado`, `licenca`, `em licenca`. Em `filtered()`, quando `state.filters.status === '__matriculados__'`, chamar essa função. Em `syncFilters()`, escrever `Matriculados` antes dos status existentes.

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `node --test tests/dashboard-html.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps-script/DashboardClient.html tests/dashboard-html.test.js
git commit -m "feat: add enrolled dashboard status filter"
```

### Task 2: Detalhar frequência e valor por hora-aula

**Files:**
- Modify: `apps-script/DashboardClient.html`
- Modify: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: `renderPlans(data)`, `barList(items, select)`, `showDetail()` e contratos filtrados.
- Produces: `valorPorAula(contrato)`, `showFinancialDetail(title, contracts)` e `showHourlyValueDetail(contracts)`.

- [ ] **Step 1: Escrever o teste que falha**

```javascript
test('planos abre detalhes por frequência e informa hora-aula média', () => {
  const client = fs.readFileSync('apps-script/DashboardClient.html', 'utf8');
  assert.match(client, /function valorPorAula\(contrato\)/);
  assert.match(client, /function showFinancialDetail\(title, contracts\)/);
  assert.match(client, /Faturamento do recorte/);
  assert.match(client, /Hora-aula média/);
  assert.match(client, /showHourlyValueDetail\(data\.contratos\)/);
  assert.match(client, /c\.frequencia === item\.label/);
});
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `node --test tests/dashboard-html.test.js`

Expected: FAIL porque frequência não possui seletor e Ticket não calcula hora-aula.

- [ ] **Step 3: Implementar detalhes financeiros**

Criar `valorPorAula(contrato)` usando a primeira frequência numérica no campo `frequencia`. Criar um cabeçalho com faturamento e quantidade em `showFinancialDetail`, seguido de alunos/contratos do recorte. Criar `showHourlyValueDetail`, que monta uma lista de três campos por contrato. Em `renderPlans`, ligar cada frequência ao conjunto correspondente e adicionar a hora-aula média ao note de Ticket.

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `node --test tests/dashboard-html.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps-script/DashboardClient.html tests/dashboard-html.test.js
git commit -m "feat: add financial plan detail dialogs"
```

### Task 3: Abrir recorte por quartil no mapa mensal

**Files:**
- Modify: `apps-script/DashboardClient.html`
- Modify: `tests/dashboard-html.test.js`
- Modify: `CONTEXTO_DO_PROJETO.md`

**Interfaces:**
- Consumes: `dueBuckets(data).month`, `parseDate()`, `detailsForContracts()`.
- Produces: `contractsForMonthQuartile(data, quartile)` e barras do mapa mensal com callback de clique.

- [ ] **Step 1: Escrever o teste que falha**

```javascript
test('mapa mensal encaminha cada quartil ao detalhe dos contratos', () => {
  const client = fs.readFileSync('apps-script/DashboardClient.html', 'utf8');
  assert.match(client, /function contractsForMonthQuartile\(contracts, quartile\)/);
  assert.match(client, /detailsForContracts\(i\.label, contractsForMonthQuartile\(data\.contratos, i\.quartile\)\)/);
});
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `node --test tests/dashboard-html.test.js`

Expected: FAIL porque `Mapa do mês` apresenta barras sem callback.

- [ ] **Step 3: Implementar o callback e atualizar o contexto**

Usar as faixas de dia 1–7, 8–15, 16–23 e 24–fim, restringidas ao mês/ano atual, para montar o recorte. Passar o callback a `barList` e acrescentar a decisão ao contexto portátil.

- [ ] **Step 4: Validar tudo**

Run:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('apps-script/DashboardClient.html','utf8').replace(/^<script>\\s*/,'').replace(/\\s*<\\/script>\\s*$/,''); new Function(s);"
npm test
```

Expected: ambos os comandos encerram com código 0.

- [ ] **Step 5: Commit**

```bash
git add apps-script/DashboardClient.html tests/dashboard-html.test.js CONTEXTO_DO_PROJETO.md
git commit -m "feat: open monthly due date quartile details"
```
