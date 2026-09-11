# Home e Configurações Operacionais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a Home em duas filas operacionais independentes para fichas/prescrições e avaliações, e reorganizar Configurações em áreas claras com prévia e validação.

**Architecture:** Manter a PWA sem bundler e o padrão ES5 atual. A classificação continua pura e testada no Apps Script; o cliente agrupa os estados em filas exclusivas e navega da Home para a página de Acompanhamento já filtrada. As configurações persistem nas tabelas existentes, adicionando três chaves de blocos da Home com compatibilidade para configurações antigas.

**Tech Stack:** Google Apps Script V8, JavaScript sem framework, HTML/CSS responsivo, Node.js 20 `node:test`.

## Global Constraints

- Repositório de execução: `/home/elohimlima/Downloads/VSCODE|ANTIGRAVITY/BASE_TECNOFIT`.
- Fichas/prescrições e avaliações nunca compartilham fila, contagem ou faixas.
- Cada aluno ocupa no máximo uma categoria dentro de cada processo.
- Os limites de fichas e avaliações são independentes e estritamente crescentes.
- As filas operacionais não exibem valores, contratos ou perfil de pagamento.
- Em desktop, as filas aparecem lado a lado; em telas menores, ficam empilhadas sem rolagem horizontal.
- Preservar compatibilidade com configurações antigas da planilha.
- Não adicionar dependências.

---

### Task 1: Persistir os três blocos independentes da Home

**Files:**
- Modify: `apps-script/13_DashboardConfiguracao.gs`
- Modify: `apps-script/14_DashboardMutacoes.gs`
- Modify: `tests/dashboard-configuracao.test.js`
- Modify: `tests/dashboard-mutacoes.test.js`

**Interfaces:**
- Consumes: linhas `home_card` já armazenadas em `CONFIG_DASHBOARD`.
- Produces: chaves `fila_prescricoes`, `fila_avaliacoes` e `agenda_financeira` aceitas por `normalizarCartoesHomeMutacao_(cartoes)`.

- [ ] **Step 1: Escrever testes falhando para os novos padrões e chaves**

Adicionar em `tests/dashboard-configuracao.test.js`:

```js
test('configuração padrão separa as filas operacionais e mantém o financeiro secundário', () => {
  const gas = loadGas(['apps-script/00_Config.gs', 'apps-script/13_DashboardConfiguracao.gs']);
  const cards = gas.DASHBOARD_CONFIGURACAO_PADRAO.dashboard
    .filter(row => row[0] === 'home_card')
    .map(row => row[1]);
  assert.deepEqual(Array.from(cards), ['fila_prescricoes', 'fila_avaliacoes', 'agenda_financeira']);
});
```

Adicionar em `tests/dashboard-mutacoes.test.js`:

```js
test('aceita os três blocos operacionais da nova Home', () => {
  const { gas, sheets } = setup();
  gas.salvarMutacoesDashboard({
    requestId: 'home-operacional-1',
    patches: [{ tipo: 'configDashboard', valores: { homeCards: [
      { chave: 'fila_prescricoes', ativo: true, ordem: 1, titulo: 'Fichas', estados: [] },
      { chave: 'fila_avaliacoes', ativo: true, ordem: 2, titulo: 'Avaliações', estados: [] },
      { chave: 'agenda_financeira', ativo: true, ordem: 3, titulo: 'Agenda financeira', estados: [] }
    ] } }]
  });
  assert.deepEqual(
    sheets.CONFIG_DASHBOARD.values.filter(row => row[0] === 'home_card').map(row => row[1]),
    ['fila_prescricoes', 'fila_avaliacoes', 'agenda_financeira']
  );
});
```

No teste existente `inicializa as três tabelas persistentes...`, alterar a expectativa de linhas padrão de `3` para `4`, pois `CONFIG_DASHBOARD` passa a conter filtros mais três blocos da Home.

- [ ] **Step 2: Rodar os testes e confirmar a falha**

Run: `node --test tests/dashboard-configuracao.test.js tests/dashboard-mutacoes.test.js`

Expected: FAIL porque as novas chaves ainda não existem nos padrões nem em `CARTOES_HOME_DASHBOARD`.

- [ ] **Step 3: Atualizar padrões e allowlist**

Substituir os cartões padrão em `DASHBOARD_CONFIGURACAO_PADRAO.dashboard` por:

```js
Object.freeze(['home_card', 'fila_prescricoes', true, 1, '', 'Fichas / prescrições', '[]']),
Object.freeze(['home_card', 'fila_avaliacoes', true, 2, '', 'Avaliações', '[]']),
Object.freeze(['home_card', 'agenda_financeira', true, 3, '', 'Agenda financeira', '[]'])
```

Adicionar ao início de `CARTOES_HOME_DASHBOARD` em `14_DashboardMutacoes.gs`:

```js
'fila_prescricoes', 'fila_avaliacoes', 'agenda_financeira',
```

Manter as chaves antigas na allowlist para que solicitações antigas ainda sejam válidas.

- [ ] **Step 4: Rodar os testes da configuração**

Run: `node --test tests/dashboard-configuracao.test.js tests/dashboard-mutacoes.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps-script/13_DashboardConfiguracao.gs apps-script/14_DashboardMutacoes.gs tests/dashboard-configuracao.test.js tests/dashboard-mutacoes.test.js
git commit -m "feat: separate operational home blocks"
```

---

### Task 2: Criar agrupamento exclusivo e navegação das filas no cliente

**Files:**
- Modify: `pwa/js/dashboard.js`
- Modify: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: `peopleFor(kind)` e estados produzidos por `classify(person, kind)`.
- Produces: `followDefinitions(kind)`, `groupFollowQueue(kind, people)`, `openFollowQueue(kind, stateName)` e estado `followCategory`.

- [ ] **Step 1: Escrever teste estrutural falhando**

Adicionar em `tests/dashboard-html.test.js`:

```js
test('cliente mantém filas e categorias independentes para fichas e avaliações', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(client, /function followDefinitions\(kind\)/);
  assert.match(client, /function groupFollowQueue\(kind, people\)/);
  assert.match(client, /function openFollowQueue\(kind, stateName\)/);
  assert.match(client, /followCategory/);
  assert.match(client, /sem_ficha/);
  assert.match(client, /sem_avaliacao/);
});
```

- [ ] **Step 2: Rodar o teste e confirmar a falha**

Run: `node --test tests/dashboard-html.test.js`

Expected: FAIL em `followDefinitions`.

- [ ] **Step 3: Adicionar estado e funções puras de fila**

Acrescentar `followCategory: ''` ao objeto `state` e inserir após `stateLabel`:

```js
function followDefinitions(kind) {
  return kind === 'prescricoes' ? [
    { state: 'sem_ficha', label: 'Sem ficha', note: 'Nunca registrada' },
    { state: 'roxo', label: 'Crítico', note: 'Acima do maior limite' },
    { state: 'vermelho', label: 'Muito atrasado', note: 'Intervenção necessária' },
    { state: 'laranja', label: 'Atrasado', note: 'Entrou na fila de revisão' }
  ] : [
    { state: 'sem_avaliacao', label: 'Sem avaliação', note: 'Nunca registrada' },
    { state: 'falha_critica', label: 'Falha crítica', note: 'Acima do limite crítico' },
    { state: 'roxo', label: 'Crítico', note: 'Prioridade máxima' },
    { state: 'vermelho', label: 'Muito atrasada', note: 'Intervenção necessária' },
    { state: 'laranja', label: 'Atrasada', note: 'Entrou na fila de revisão' }
  ];
}

function groupFollowQueue(kind, people) {
  return followDefinitions(kind).map(function (definition) {
    return Object.assign({}, definition, {
      people: people.filter(function (person) {
        return person.classification.state === definition.state;
      })
    });
  });
}

function openFollowQueue(kind, stateName) {
  state.page = 'acompanhamento';
  state.subpage = kind;
  state.followCategory = stateName || '';
  document.querySelectorAll('[data-page]').forEach(function (button) {
    button.classList.toggle('active', button.dataset.page === 'acompanhamento');
  });
  render();
}
```

Atualizar `peopleFor(kind)` para retornar também:

```js
status: p.status,
lastDate: kind === 'prescricoes' ? p.dataFicha : p.dataAvaliacao,
```

- [ ] **Step 4: Rodar o teste estrutural**

Run: `node --test tests/dashboard-html.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pwa/js/dashboard.js tests/dashboard-html.test.js
git commit -m "feat: add independent follow-up queues"
```

---

### Task 3: Substituir os KPIs soltos da Home por duas filas e resumo financeiro

**Files:**
- Modify: `pwa/js/dashboard.js`
- Modify: `pwa/css/dashboard.css`
- Modify: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: `groupFollowQueue(kind, people)`, `openFollowQueue(kind, stateName)` e `dueBuckets(data)`.
- Produces: `renderHomeQueue(kind, people)`, `renderFinancialHome(data)` e `renderHome(data)`.

- [ ] **Step 1: Escrever teste falhando para a nova composição**

```js
test('Home renderiza duas filas separadas e financeiro secundário', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  assert.match(client, /function renderHomeQueue\(kind, people\)/);
  assert.match(client, /function renderFinancialHome\(data\)/);
  assert.match(client, /home-operation-grid/);
  assert.doesNotMatch(client, /var missing = prescriptions[^;]+concat\(evaluations/s);
  assert.match(css, /\.home-operation-grid/);
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test tests/dashboard-html.test.js`

Expected: FAIL em `renderHomeQueue`.

- [ ] **Step 3: Implementar os dois blocos operacionais**

Inserir em `pwa/js/dashboard.js`:

```js
function renderHomeQueue(kind, people) {
  var isPrescription = kind === 'prescricoes';
  var queue = groupFollowQueue(kind, people);
  var total = queue.reduce(function (sum, group) { return sum + group.people.length; }, 0);
  var box = el('section', 'section-card home-queue home-queue-' + kind);
  var head = el('div', 'home-queue-head');
  var copy = el('div');
  copy.appendChild(el('span', 'label', isPrescription ? 'FICHAS / PRESCRIÇÕES' : 'AVALIAÇÕES'));
  copy.appendChild(el('h3', '', number(total) + ' precisam de revisão'));
  var open = el('button', isPrescription ? 'primary' : 'secondary', isPrescription ? 'Abrir fichas' : 'Abrir avaliações');
  open.type = 'button';
  open.addEventListener('click', function () { openFollowQueue(kind, ''); });
  head.appendChild(copy); head.appendChild(open); box.appendChild(head);
  queue.forEach(function (group) {
    var row = el('button', 'home-priority-row');
    row.type = 'button';
    row.dataset.priority = group.state;
    row.appendChild(el('span', 'priority-dot estado-' + group.state));
    var text = el('span'); text.appendChild(el('strong', '', group.label)); text.appendChild(el('small', '', group.note));
    row.appendChild(text); row.appendChild(el('b', '', number(group.people.length) + ' ›'));
    row.addEventListener('click', function () { openFollowQueue(kind, group.state); });
    box.appendChild(row);
  });
  return box;
}

function renderFinancialHome(data) {
  var due = dueBuckets(data), box = section('Agenda financeira'), summary = el('div', 'financial-home-summary');
  [['Últimos 5 dias', due.previous], ['Vencem hoje', due.today], ['Próximos 5 dias', due.next]].forEach(function (item) {
    var button = el('button', 'financial-home-item');
    button.type = 'button'; button.appendChild(el('span', '', item[0])); button.appendChild(el('strong', '', number(item[1].length)));
    button.addEventListener('click', function () { detailsForContracts(item[0], item[1]); });
    summary.appendChild(button);
  });
  box.classList.add('financial-home'); box.appendChild(summary); return box;
}
```

Substituir `renderHome(data)` por uma composição que cria `home-operation-grid`, anexa `renderHomeQueue('prescricoes', ...)`, `renderHomeQueue('avaliacoes', ...)` e depois `renderFinancialHome(data)`. Ler as novas chaves de `homeCards`; quando elas não existirem, ativar os três blocos para compatibilidade com planilhas antigas.

- [ ] **Step 4: Adicionar estilos da Home**

Adicionar em `pwa/css/dashboard.css`:

```css
.home-operation-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.home-queue { padding: 0; overflow: hidden; }
.home-queue-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px; background: rgba(255,255,255,.025); }
.home-queue-head h3 { margin: 4px 0 0; font-size: 19px; }
.home-priority-row { display: grid; width: 100%; grid-template-columns: 12px minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 13px 18px; border-top: 1px solid var(--line); text-align: left; }
.home-priority-row small { display: block; margin-top: 2px; color: var(--muted); }
.priority-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
.financial-home-summary { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
.financial-home-item { display: flex; justify-content: space-between; gap: 12px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; }
@media (max-width: 860px) { .home-operation-grid { grid-template-columns: 1fr; } }
@media (max-width: 520px) { .financial-home-summary { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Rodar testes**

Run: `node --test tests/dashboard-html.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add pwa/js/dashboard.js pwa/css/dashboard.css tests/dashboard-html.test.js
git commit -m "feat: redesign home around operational queues"
```

---

### Task 4: Transformar Acompanhamento em listas operacionais dedicadas

**Files:**
- Modify: `pwa/js/dashboard.js`
- Modify: `pwa/css/dashboard.css`
- Modify: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: `state.followCategory`, `followDefinitions(kind)` e `peopleFor(kind)`.
- Produces: `renderFollowFilters(kind, groups)`, `renderFollowList(kind, people)` e `showFollowDetail(kind, person)`.

- [ ] **Step 1: Escrever teste falhando para lista sem dados financeiros**

```js
test('Acompanhamento usa lista operacional própria sem informações financeiras', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(client, /function renderFollowList\(kind, people\)/);
  assert.match(client, /function showFollowDetail\(kind, person\)/);
  assert.match(client, /follow-list/);
  const detail = client.match(/function showFollowDetail[\s\S]*?\n  \}/)[0];
  assert.doesNotMatch(detail, /money\(|valorMensal|perfilPagamento|contratos/);
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test tests/dashboard-html.test.js`

Expected: FAIL em `renderFollowList`.

- [ ] **Step 3: Implementar filtros e linhas dedicadas**

Criar botões de filtro a partir de `followDefinitions(kind)`, incluindo `Todas`, com `aria-pressed`. Filtrar por igualdade exata de `classification.state`. Cada `.follow-row` deve renderizar:

```js
row.appendChild(el('strong', '', person.aluno));
row.appendChild(el('span', 'body-copy', person.id + ' · ' + (person.status || 'Status não informado')));
row.appendChild(chip(person.classification.state));
row.appendChild(el('span', '', person.classification.days == null ? 'Sem registro' : person.classification.days + ' dias'));
row.appendChild(el('span', '', person.lastDate || '—'));
```

Adicionar botão `Ver ficha` ou `Ver avaliação`, chamando `showFollowDetail(kind, person)`. O detalhe deve mostrar apenas nome, matrícula, status, categoria, dias e última data. Substituir `renderFollow(kind)` pelos filtros, total e lista.

- [ ] **Step 4: Adicionar estilos responsivos**

```css
.follow-list { display: grid; border: 1px solid var(--line); border-radius: var(--radius-card); overflow: hidden; }
.follow-row { display: grid; grid-template-columns: minmax(180px,1.4fr) minmax(140px,1fr) 90px 110px auto; gap: 14px; align-items: center; padding: 14px 16px; border-top: 1px solid var(--line); }
.follow-row:first-child { border-top: 0; }
.follow-filter-row { display: flex; flex-wrap: wrap; gap: 8px; }
@media (max-width: 720px) { .follow-row { grid-template-columns: 1fr auto; } .follow-row > * { min-width: 0; } }
```

- [ ] **Step 5: Rodar testes**

Run: `node --test tests/dashboard-html.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add pwa/js/dashboard.js pwa/css/dashboard.css tests/dashboard-html.test.js
git commit -m "feat: add dedicated prescription and evaluation lists"
```

---

### Task 5: Reorganizar Configurações por assunto com validação e prévia

**Files:**
- Modify: `pwa/js/dashboard.js`
- Modify: `pwa/css/dashboard.css`
- Modify: `tests/dashboard-html.test.js`
- Test: `tests/dashboard-mutacoes.test.js`

**Interfaces:**
- Consumes: `config.alertas`, `config.homeCards`, `peopleFor(kind)` e `enqueue(patch)`.
- Produces: `renderAlertSettings()`, `renderHomeSettings()`, `renderPaymentSettings()`, `validateAlertRules(kind, rules)`, `classify(person, kind, rulesOverride)`, `settingsSection` e `settingsDirty`.

- [ ] **Step 1: Escrever testes falhando para arquitetura e validação**

```js
test('Configurações separa prazos, Home e perfil de pagamento', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  for (const fn of ['renderAlertSettings', 'renderHomeSettings', 'renderPaymentSettings', 'validateAlertRules']) {
    assert.match(client, new RegExp(`function ${fn}\\(`));
  }
  assert.match(client, /settingsSection/);
  assert.match(client, /settingsDirty/);
  assert.match(client, /beforeunload/);
  assert.match(client, /Prévia da Home/);
  assert.match(css, /\.settings-nav/);
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test tests/dashboard-html.test.js tests/dashboard-mutacoes.test.js`

Expected: FAIL nas novas funções; os testes existentes do backend permanecem verdes.

- [ ] **Step 3: Permitir classificação com regras de prévia**

Alterar a assinatura de `classify` e a seleção de regras para:

```js
function classify(person, kind, rulesOverride) {
  var data = parseDate(kind === 'prescricoes' ? person.dataFicha : person.dataAvaliacao);
  var days = dayDiff(data, today());
  var r = rulesOverride || state.bootstrap.configuracao.alertas[kind] || {};
  // manter as mesmas comparações e estados já existentes
}
```

As chamadas existentes continuam usando dois argumentos; somente a prévia usa `draftRules`.

- [ ] **Step 4: Implementar validação e prévia dos alertas**

Adicionar:

```js
function validateAlertRules(kind, rules) {
  var fields = kind === 'avaliacoes' ? ['laranja','vermelho','roxo','critico'] : ['laranja','vermelho','roxo'];
  var previous = 0;
  for (var i = 0; i < fields.length; i += 1) {
    var value = Number(rules[fields[i]]);
    if (!Number.isInteger(value) || value <= previous) return { ok: false, message: 'Use dias inteiros, positivos e crescentes.' };
    previous = value;
  }
  return { ok: true, message: '' };
}
```

`renderAlertSettings()` deve ter abas Fichas/prescrições e Avaliações, rótulos humanos, intervalos calculados e `Prévia da Home` usando `classify(person, kind, draftRules)`. O botão salvar só chama `enqueue({ tipo:'configAlertas', valores: ... })` quando `validateAlertRules` retornar `ok`.

- [ ] **Step 5: Implementar ordem visual da Home sem campo numérico**

`renderHomeSettings()` deve mostrar apenas `fila_prescricoes`, `fila_avaliacoes` e `agenda_financeira`. Cada linha possui checkbox e botões `Subir`/`Descer`. A ordem do array determina `ordem: index + 1` no payload `configDashboard`.

- [ ] **Step 6: Isolar perfil de pagamento e navegação interna**

`renderPaymentSettings()` reaproveita a lógica existente sem compartilhar cartão ou botão com as demais áreas. `renderSettings()` cria `.settings-nav` com três botões e renderiza apenas a seção indicada por `state.settingsSection`.

- [ ] **Step 7: Controlar alterações pendentes**

Adicionar `settingsDirty: false` ao estado. Inputs, checkboxes e botões de ordem chamam:

```js
function markSettingsDirty() {
  state.settingsDirty = true;
  setSave('Alterações não salvas');
}
```

Após enfileirar um salvamento válido, definir `state.settingsDirty = false`. Antes de `activate(page)` sair de Configurações, solicitar confirmação com `window.confirm('Descartar alterações não salvas?')`; se a resposta for negativa, não trocar de página. Registrar também:

```js
window.addEventListener('beforeunload', function (event) {
  if (!state.settingsDirty) return;
  event.preventDefault();
  event.returnValue = '';
});
```

- [ ] **Step 8: Adicionar estilos**

```css
.settings-shell { display: grid; grid-template-columns: 220px minmax(0,1fr); gap: 18px; }
.settings-nav { display: grid; align-content: start; gap: 6px; }
.settings-nav button { min-height: 44px; padding: 0 13px; border-radius: 10px; text-align: left; }
.settings-nav button.active { color: #090b08; background: var(--lime); }
.settings-rule-list, .settings-home-list { display: grid; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.settings-rule-row, .settings-home-row { display: grid; grid-template-columns: minmax(160px,1.2fr) minmax(180px,1fr) auto; gap: 14px; align-items: center; padding: 13px 15px; border-top: 1px solid var(--line); }
.settings-preview { padding: 14px; border-radius: 12px; background: rgba(255,255,255,.035); }
@media (max-width: 720px) { .settings-shell { grid-template-columns: 1fr; } .settings-nav { grid-template-columns: repeat(3,minmax(0,1fr)); } .settings-rule-row, .settings-home-row { grid-template-columns: 1fr; } }
```

- [ ] **Step 9: Rodar testes**

Run: `node --test tests/dashboard-html.test.js tests/dashboard-mutacoes.test.js`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add pwa/js/dashboard.js pwa/css/dashboard.css tests/dashboard-html.test.js tests/dashboard-mutacoes.test.js
git commit -m "feat: reorganize operational settings"
```

---

### Task 6: Validar o fluxo completo e a compatibilidade

**Files:**
- Modify: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: todas as entregas anteriores.
- Produces: suíte completa verde e comportamento responsivo verificado.

- [ ] **Step 1: Adicionar teste integrado da história completa**

Adicionar em `tests/dashboard-html.test.js`:

```js
test('história operacional conecta Home, filas dedicadas e Configurações', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  assert.match(client, /renderHomeQueue\('prescricoes'/);
  assert.match(client, /renderHomeQueue\('avaliacoes'/);
  assert.match(client, /openFollowQueue\(kind, group\.state\)/);
  assert.match(client, /renderFollowList\(kind,/);
  assert.match(client, /renderAlertSettings\(\)/);
  assert.match(client, /renderHomeSettings\(\)/);
  assert.match(client, /renderPaymentSettings\(\)/);
  assert.match(css, /@media \(max-width: 860px\)[^{]*\{[^}]*\.home-operation-grid/s);
});
```

- [ ] **Step 2: Rodar a suíte completa**

Run: `npm test`

Expected: todos os testes PASS, sem testes ignorados ou cancelados.

- [ ] **Step 3: Construir e servir a PWA localmente**

Run: `python3 -m http.server 8000 --directory pwa`

Expected: servidor disponível em `http://localhost:8000/` sem erro de sintaxe no console.

- [ ] **Step 4: Verificar desktop**

Confirmar em largura de 1440 px:

- duas filas lado a lado;
- fichas e avaliações com categorias próprias;
- clique numa categoria abrindo Acompanhamento no processo e recorte corretos;
- agenda financeira abaixo das filas;
- Configurações sem formulário contínuo e com prévia antes de salvar.

- [ ] **Step 5: Verificar mobile**

Confirmar em larguras de 390 px e 360 px:

- filas empilhadas;
- nenhum scroll horizontal;
- botões com pelo menos 44 px;
- linhas operacionais legíveis como cartões;
- navegação de Configurações utilizável sem corte de texto.

- [ ] **Step 6: Verificar estados de erro**

Confirmar:

- limites fora de ordem bloqueiam salvamento e preservam valores;
- lista vazia informa que não há pendências;
- erro de salvamento mantém a opção `Tentar novamente` existente;
- configuração antiga sem as três novas chaves mostra os três blocos por fallback.

- [ ] **Step 7: Commitar o teste integrado**

```bash
git add tests/dashboard-html.test.js
git commit -m "test: verify operational home and settings"
```
