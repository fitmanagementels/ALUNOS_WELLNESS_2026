# Análise temporal de churns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir análises mensais, semanais e diagnósticos de churns Wellness Club, com detalhe por período em pop-up.

**Architecture:** `15_DashboardFluxo.gs` calcula séries temporais, rankings e filtros de detalhe sobre o payload já limitado ao Wellness Club; `12_DashboardApi.gs` expõe esse resumo sem alterar planilha. `DashboardClient.html` mantém filtros efêmeros da subaba Churns, solicita a análise, cria gráficos Chart.js e abre o diálogo existente a partir de cartões, barras e pontos. `DashboardStyles.html` só recebe classes estruturais mínimas para os controles analíticos; o polimento da lista fica fora do escopo.

**Tech Stack:** Google Apps Script V8, HTML/DOM nativo, Chart.js 4.4.7 e Node.js test runner.

## Global Constraints

- Usar apenas `FLUXO_CHURNS` e `data_saida` para análise temporal, limitado a `XSTEAM WELLNESS CLUB`.
- Não usar `inicio_plano`, `inicio_corrente`, ficha ou avaliação como proxy de entrada do aluno.
- MoM inicia em todo o histórico e filtra por intervalo de meses.
- WoW inicia nas últimas 26 semanas, usa linha com pontos clicáveis e filtra por intervalo de datas.
- Semanas e meses sem churn no intervalo devem aparecer como zero.
- Pop-ups usam criação de DOM; conteúdo vindo da planilha nunca é inserido como HTML.

---

### Task 1: Séries e diagnósticos de churn no backend

**Files:**
- Modify: `apps-script/15_DashboardFluxo.gs`
- Modify: `apps-script/12_DashboardApi.gs`
- Test: `tests/dashboard-fluxo.test.js`
- Test: `tests/dashboard-api.test.js`

**Interfaces:**
- Consumes: objetos seguros `{ dataSaida, motivoSaida, contratoXSem, acaoRetencao }`.
- Produces: `serieMensalChurnFluxo_(churns, inicioMes, fimMes)`, `serieSemanalChurnFluxo_(churns, inicio, fim)`, `diagnosticosChurnFluxo_(churns)` e `obterAnaliseChurnsDashboard(filtros)`.

- [ ] **Step 1: Write the failing tests**

```js
test('serieSemanalChurnFluxo_ limita a 26 semanas e preenche semanas vazias', () => {
  const serie = gas.serieSemanalChurnFluxo_(churns, new Date(2026, 0, 5), new Date(2026, 1, 1));
  assert.deepEqual(json(serie.map((x) => x.valor)), [1, 0, 1, 0, 0]);
});

test('diagnosticosChurnFluxo_ separa ausência de frequência e cobertura de retenção', () => {
  const d = gas.diagnosticosChurnFluxo_(churns);
  assert.equal(d.retencao.comAcao, 1);
  assert.equal(d.retencao.semAcao, 2);
  assert.equal(d.frequencias.find((x) => x.chave === 'Não informado').valor, 1);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node tests/dashboard-fluxo.test.js`
Expected: failure because the three analytic helpers are undefined.

- [ ] **Step 3: Implement the helpers**

```js
function inicioSemanaChurnFluxo_(valor) {
  var data = inicioDiaDashboard_(valor);
  if (!data) return null;
  var deslocamento = (data.getDay() + 6) % 7;
  data.setDate(data.getDate() - deslocamento);
  return data;
}

function diagnosticosChurnFluxo_(churns) {
  var motivos = agruparChurnFluxo_(churns, function (churn) { return churn.motivoSaida; }, false);
  var frequencias = agruparChurnFluxo_(churns, function (churn) { return churn.contratoXSem || 'Não informado'; }, true);
  var comAcao = churns.filter(function (churn) { return Boolean(textoFluxo_(churn.acaoRetencao, 3000)); }).length;
  return { motivos: motivos, frequencias: frequencias, retencao: { comAcao: comAcao, semAcao: churns.length - comAcao } };
}

function analiseChurnFluxo_(churns, filtros) {
  return {
    mensal: serieMensalChurnFluxo_(churns, filtros.mesInicio, filtros.mesFim),
    semanal: serieSemanalChurnFluxo_(churns, filtros.semanaInicio, filtros.semanaFim),
    diagnosticos: diagnosticosChurnFluxo_(churns)
  };
}

function agruparChurnFluxo_(churns, seletor, incluirVazio) {
  var grupos = Object.create(null);
  churns.forEach(function (churn) {
    var chave = textoFluxo_(seletor(churn), 200);
    if (!chave && !incluirVazio) return;
    chave = chave || 'Não informado';
    grupos[chave] = (grupos[chave] || 0) + 1;
  });
  return Object.keys(grupos).map(function (chave) { return { chave: chave, valor: grupos[chave] }; })
    .sort(function (a, b) { return b.valor - a.valor || a.chave.localeCompare(b.chave, 'pt-BR'); });
}

function obterAnaliseChurnsDashboard(filtros) {
  var planilha = obterPlanilhaMestre_();
  return analiseChurnFluxo_(lerFluxoDashboardDaPlanilha_(planilha).churns, filtros || {});
}
```

Meses e semanas serão gerados em sequência entre as pontas do filtro, com `valor: 0` antes de somar os registros válidos. A série mensal inclui `variacaoAbsoluta` e `variacaoPercentual` usando o mês anterior disponível na série completa.

- [ ] **Step 4: Run the focused test and confirm pass**

Run: `node tests/dashboard-fluxo.test.js`
Expected: all subtests pass.

- [ ] **Step 5: Commit**

```bash
git add apps-script/12_DashboardApi.gs apps-script/15_DashboardFluxo.gs tests/dashboard-api.test.js tests/dashboard-fluxo.test.js
git commit -m "feat: add churn temporal analytics"
```

### Task 2: Estado analítico, gráficos e pop-up de detalhes

**Files:**
- Modify: `apps-script/DashboardClient.html`
- Modify: `apps-script/DashboardStyles.html`
- Test: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: `obterAnaliseChurnsDashboard({ mesInicio, mesFim, semanaInicio, semanaFim })` retornando `{ mensal, semanal, diagnosticos }`, e registros Churn já carregados no bootstrap.
- Produces: `renderChurnAnalytics(items)`, `abrirListaChurnsFluxo(titulo, itens)` e eventos de clique de cartão, barra e ponto Chart.js.

- [ ] **Step 1: Write the failing structural tests**

```js
test('Fluxo Churns possui controles MoM, WoW e detalhe clicável', () => {
  assert.match(client, /churnMonthStart/);
  assert.match(client, /churnWeekStart/);
  assert.match(client, /abrirListaChurnsFluxo/);
  assert.match(client, /getElementsAtEventForMode/);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node tests/dashboard-html.test.js`
Expected: failure because the analytics controls and list-dialog function do not exist.

- [ ] **Step 3: Implement the client behavior**

```js
function abrirListaChurnsFluxo(titulo, itens) {
  var dialog = document.getElementById('detailDialog');
  var target = document.getElementById('detailContent');
  clear(target);
  document.getElementById('detailTitle').textContent = titulo;
  itens.forEach(function (item) { target.appendChild(linhaDetalheChurnFluxo(item)); });
  dialog.showModal();
}

function renderChurnAnalytics(items) {
  var filtros = state.churnAnalyticsFilters;
  return call('obterAnaliseChurnsDashboard', filtros).then(function (analise) {
    renderGraficoMensalChurnFluxo(analise.mensal, items);
    renderGraficoSemanalChurnFluxo(analise.semanal, items);
    renderDiagnosticosChurnFluxo(analise.diagnosticos);
  });
}
```

O cartão `Saídas registradas` ganha `button` ou evento de teclado e abre todos os `items`; a lista não é acrescentada à página principal. O WoW inicia de `hoje - 25 semanas` até o fim da semana atual. O clique Chart.js resolve o índice por `getElementsAtEventForMode(event, 'nearest', { intersect: true }, true)`.

- [ ] **Step 4: Add minimal analytical layout rules**

```css
.flow-analytics-controls { display: flex; gap: 12px; flex-wrap: wrap; }
.flow-chart { min-height: 300px; }
.kpi-button { cursor: pointer; text-align: left; }
```

As regras preservam responsividade e não redesenham a estética da lista.

- [ ] **Step 5: Run focused tests and confirm pass**

Run: `node tests/dashboard-html.test.js`
Expected: all subtests pass.

- [ ] **Step 6: Commit**

```bash
git add apps-script/DashboardClient.html apps-script/DashboardStyles.html tests/dashboard-html.test.js
git commit -m "feat: add interactive churn charts"
```

### Task 3: Verificação integrada e instruções de publicação

**Files:**
- Modify: `apps-script/INSTRUCOES_INSTALACAO.md`
- Test: `tests/dashboard-fluxo.test.js`
- Test: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: todos os helpers e controles das Tasks 1–2.
- Produces: instrução de cópia, implantação e roteiro de conferência do Fluxo > Churns.

- [ ] **Step 1: Document the update**

Acrescentar à seção Fluxo que a atualização requer copiar `15_DashboardFluxo.gs`, `DashboardClient.html` e `DashboardStyles.html`, publicar nova versão e conferir: cartão abre pop-up, barra mensal filtra mês, ponto semanal filtra semana e o padrão semanal contém 26 semanas.

- [ ] **Step 2: Run complete verification**

Run: `node -e "const fs=require('fs'); for (const f of ['apps-script/15_DashboardFluxo.gs']) new Function(fs.readFileSync(f,'utf8')); const s=fs.readFileSync('apps-script/DashboardClient.html','utf8').replace(/^<script>\s*/,'').replace(/\s*<\\/script>\s*$/,''); new Function(s);" && npm test && git diff --check`
Expected: exit code 0, all tests pass and no whitespace errors.

- [ ] **Step 3: Commit**

```bash
git add apps-script/INSTRUCOES_INSTALACAO.md
git commit -m "docs: describe churn analytics deployment"
```
