# Fluxo — Leads e Churns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a página Fluxo com cadastro manual, auditoria e análise temporal de Leads e Churns no dashboard XSTEAM.

**Architecture:** Duas abas persistentes ficam isoladas do snapshot importado. O novo módulo `15_DashboardFluxo.gs` define contratos, leitura segura e resumos; o bootstrap entrega o payload para a interface e `salvarMutacoesDashboard` mantém operações atômicas, bloqueadas e idempotentes.

**Tech Stack:** Google Apps Script, Google Sheets, HTML/CSS/JavaScript sem framework, Node.js `node:test` e `vm`.

## Global Constraints

- Não apagar nem alterar `BASE_ALUNOS`, `CONTRATOS` ou `VISAO_MESTRE`.
- Não usar contatos da base mestre; telefone de Lead só serve ao link operacional de WhatsApp.
- Não usar dados pessoais reais em fixtures, testes ou documentação.
- Status de Lead é manual; `entrada_como_cliente` não muda o status.
- Churn é sempre `XSTEAM WELLNESS CLUB`; somente Churn pode ser excluído.
- Não tocar no diretório não rastreado `(DIVISAO)-apps-script/`.

---

### Task 1: Criar a estrutura persistente

**Files:**
- Modify: `apps-script/00_Config.gs`
- Modify: `apps-script/04_PlanilhaRepositorio.gs`
- Modify: `tests/planilha-repositorio.test.js`

**Interfaces:** produz `CONFIG.abas.fluxoLeads`, `CONFIG.abas.fluxoChurns`, `CONFIG.cabecalhos.fluxoLeads` e `CONFIG.cabecalhos.fluxoChurns`; `garantirEstruturaPlanilha()` passa a criar ambas sem apagar linhas.

- [ ] **Step 1: Escrever o teste que exige cabeçalhos e preservação**

```js
test('garantirEstruturaPlanilha preserva FLUXO_LEADS e cria FLUXO_CHURNS', () => {
  const { gas, planilha, config } = setup();
  const leads = planilha.insertSheet('FLUXO_LEADS');
  leads.values = [Array.from(config.cabecalhos.fluxoLeads), ['lead-1', 'LEAD TESTE']];
  gas.garantirEstruturaPlanilha();
  assert.equal(leads.values[1][0], 'lead-1');
  assert.deepEqual(planilha.getSheetByName('FLUXO_CHURNS').values[0], Array.from(config.cabecalhos.fluxoChurns));
});
```

- [ ] **Step 2: Confirmar a falha**

Run: `node --test tests/planilha-repositorio.test.js`

Expected: FAIL pois as chaves ainda não existem.

- [ ] **Step 3: Declarar os contratos de colunas**

```js
fluxoLeads: 'FLUXO_LEADS', fluxoChurns: 'FLUXO_CHURNS'
// lead_id,nome,telefone,origem,indicacao,primeiro_contato,experimental,
// professor_experimental,entrada_como_cliente,status,plano_contratado,
// valor_pacote,minirrelatorio_venda,criado_em,atualizado_em
// churn_id,aluno_id,nome,polo,data_saida,motivo_saida,sinais_contexto,
// acao_retencao,criado_em,atualizado_em
```

O laço existente em `garantirEstruturaPlanilha()` já usa `CONFIG.abas`; adaptar os mocks para que novas abas sejam criadas com todos os métodos já usados no teste.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/planilha-repositorio.test.js`

Expected: PASS.

```bash
git add apps-script/00_Config.gs apps-script/04_PlanilhaRepositorio.gs tests/planilha-repositorio.test.js
git commit -m "feat: add persistent fluxo sheets"
```

### Task 2: Implementar domínio, payload e métricas

**Files:**
- Create: `apps-script/15_DashboardFluxo.gs`
- Create: `tests/dashboard-fluxo.test.js`

**Interfaces:** consome `CONFIG`, `lerTabelaDashboardDaPlanilha_`, `formatarDataDashboard_` e `paraDataDashboard_`; produz `lerFluxoDashboardDaPlanilha_`, `leadSeguroParaDashboard_`, `churnSeguroParaDashboard_`, `resumoLeadsFluxo_` e `resumoChurnsFluxo_`.

- [ ] **Step 1: Escrever testes de regras temporais e completude**

```js
test('resumoLeadsFluxo_ calcula entradas, conversão e funil manual', () => {
  const r = gas.resumoLeadsFluxo_(leads, new Date(2026, 6, 1), new Date(2026, 6, 31));
  assert.deepEqual(json(r.kpis), { novosLeads: 2, entradasComoCliente: 1, conversaoPeriodo: 50, emAcao: 1 });
  assert.equal(r.funil.Convertido, 1);
  assert.equal(r.inconsistenciasEntrada.length, 1);
});
test('resumoChurnsFluxo_ calcula saídas e completude', () => {
  const r = gas.resumoChurnsFluxo_(churns, new Date(2026, 6, 1), new Date(2026, 6, 31));
  assert.deepEqual(json(r.kpis), { saidas: 2, comMotivo: 1, comAcaoRetencao: 1 });
});
```

- [ ] **Step 2: Confirmar a falha**

Run: `node --test tests/dashboard-fluxo.test.js`

Expected: FAIL porque o módulo não existe.

- [ ] **Step 3: Criar o módulo com os contratos canônicos**

```js
var STATUS_LEADS_FLUXO = Object.freeze(['Novo', 'Em contato', 'Esfriando', 'Experimental agendado', 'Experimental realizado', 'Convertido', 'Perdido']);
var PLANOS_LEADS_FLUXO = Object.freeze(['Pacote 5x', 'Pacote 10x', '1x/sem', '2x/sem', '3x/sem', '4x/sem', '5x/sem', '6x/sem']);
function lerFluxoDashboardDaPlanilha_(planilha) {
  return {
    leads: lerTabelaDashboardDaPlanilha_(planilha, CONFIG.abas.fluxoLeads, CONFIG.cabecalhos.fluxoLeads).map(leadSeguroParaDashboard_),
    churns: lerTabelaDashboardDaPlanilha_(planilha, CONFIG.abas.fluxoChurns, CONFIG.cabecalhos.fluxoChurns).map(churnSeguroParaDashboard_)
  };
}
```

Normalizar datas em `dd/MM/yyyy`, produzir somente campos permitidos e agrupar séries por mês. “Em ação” inclui `Novo`, `Em contato`, `Esfriando`, `Experimental agendado` e `Experimental realizado`.

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/dashboard-fluxo.test.js tests/dashboard-paginas.test.js`

Expected: PASS.

```bash
git add apps-script/15_DashboardFluxo.gs tests/dashboard-fluxo.test.js
git commit -m "feat: add fluxo data model and metrics"
```

### Task 3: Expor Fluxo no bootstrap

**Files:**
- Modify: `apps-script/12_DashboardApi.gs`
- Modify: `tests/dashboard-api.test.js`

**Interfaces:** consome `lerFluxoDashboardDaPlanilha_`; produz `obterBootstrapDashboard().fluxo = { leads, churns }` e valida o formato no cache.

- [ ] **Step 1: Escrever teste de payload**

```js
assert.equal(resultado.fluxo.leads[0].telefone, '85900000000');
assert.equal(resultado.fluxo.churns[0].polo, 'XSTEAM WELLNESS CLUB');
assert.equal(JSON.stringify(resultado.alunos).includes('8500000001'), false);
```

- [ ] **Step 2: Confirmar a falha**

Run: `node --test tests/dashboard-api.test.js`

Expected: FAIL porque `fluxo` não está no bootstrap.

- [ ] **Step 3: Acrescentar Fluxo ao bootstrap e ao cache**

```js
function respostaBootstrapDashboardValida_(r, versao) {
  return objetoDashboardValido_(r) && r.versao === versao && Array.isArray(r.alunos) &&
    Array.isArray(r.contratos) && objetoDashboardValido_(r.fluxo) &&
    Array.isArray(r.fluxo.leads) && Array.isArray(r.fluxo.churns);
}
// Em montarBootstrapDashboard_: fluxo: lerFluxoDashboardDaPlanilha_(base.planilha)
```

- [ ] **Step 4: Verificar e commitar**

Run: `node --test tests/dashboard-api.test.js`

Expected: PASS, inclusive na leitura do cache.

```bash
git add apps-script/12_DashboardApi.gs tests/dashboard-api.test.js
git commit -m "feat: expose fluxo in dashboard bootstrap"
```

### Task 4: Criar mutações idempotentes

**Files:**
- Modify: `apps-script/14_DashboardMutacoes.gs`
- Modify: `tests/dashboard-mutacoes.test.js`

**Interfaces:** adiciona patches `fluxoLead`, `fluxoChurn` e `excluirFluxoChurn` a `salvarMutacoesDashboard({ requestId, patches })`.

- [ ] **Step 1: Escrever testes de criação, edição, rejeição e exclusão**

```js
gas.salvarMutacoesDashboard({ requestId: 'lead-1', patches: [{ tipo: 'fluxoLead', valores: {
  nome: 'LEAD TESTE', telefone: '85900000000', primeiroContato: '01/07/2026', status: 'Novo'
} }] });
assert.equal(sheets.FLUXO_LEADS.values.length, 2);
assert.throws(() => gas.salvarMutacoesDashboard({ requestId: 'bad', patches: [{ tipo: 'fluxoLead', valores: { nome: 'A', telefone: '', status: 'Novo' } }] }), /Lead inválido/);
assert.throws(() => gas.salvarMutacoesDashboard({ requestId: 'lead-delete', patches: [{ tipo: 'excluirFluxoLead', valores: { id: 'lead-1' } }] }), /Tipo de alteração inválido/);
```

Cobrir também edição que preserva `criado_em`, polo automático do Churn, exclusão de Churn, request repetido e nenhum write se qualquer patch do lote for inválido.

- [ ] **Step 2: Confirmar a falha**

Run: `node --test tests/dashboard-mutacoes.test.js`

Expected: FAIL porque os patches não são reconhecidos.

- [ ] **Step 3: Normalizar em memória antes de gravar**

```js
function fluxoAgoraMutacao_() {
  return Utilities.formatDate(new Date(), CONFIG.fusoHorario, 'dd/MM/yyyy HH:mm');
}
function fluxoIdMutacao_(idExistente) {
  return textoMutacaoDashboard_(idExistente || Utilities.getUuid(), 120);
}
function excluirFluxoChurnMutacao_(linhas, valores) {
  var id = textoMutacaoDashboard_(valores.id, 120);
  var restantes = linhas.filter(function (linha) { return String(linha[0]) !== id; });
  if (!id || restantes.length === linhas.length) throw new Error('Churn inválido.');
  return restantes;
}
```

Ler tabelas dentro do lock, calcular todas as linhas antes de qualquer `setValues`, gravar tabelas alteradas, chamar `SpreadsheetApp.flush()`, incrementar versão e registrar `requestId`. Gerar IDs com `Utilities.getUuid()` e timestamps com `Utilities.formatDate(new Date(), CONFIG.fusoHorario, 'dd/MM/yyyy HH:mm')`.

- [ ] **Step 4: Verificar e commitar**

Run: `npm test`

Expected: PASS.

```bash
git add apps-script/14_DashboardMutacoes.gs tests/dashboard-mutacoes.test.js
git commit -m "feat: save fluxo leads and churns"
```

### Task 5: Implementar a página Fluxo

**Files:**
- Modify: `apps-script/DashboardComponents.html`
- Modify: `apps-script/DashboardClient.html`
- Modify: `apps-script/DashboardStyles.html`
- Modify: `tests/dashboard-html.test.js`

**Interfaces:** consome `bootstrap.fluxo` e patches da Task 4; produz página `fluxo`, subabas `leads`/`churns`, filtros locais, formulários e confirmação de exclusão.

- [ ] **Step 1: Escrever testes estáticos para navegação e operações**

```js
assert.match(client, /fluxo: 'Fluxo'/);
assert.match(components, /data-page="fluxo"/);
assert.match(components, /data-subpage="leads"/);
assert.match(components, /data-subpage="churns"/);
assert.match(client, /tipo: 'fluxoLead'/);
assert.match(client, /tipo: 'excluirFluxoChurn'/);
assert.match(client, /wa\.me/);
```

- [ ] **Step 2: Confirmar a falha**

Run: `node --test tests/dashboard-html.test.js`

Expected: FAIL porque a página Fluxo não existe.

- [ ] **Step 3: Renderizar a área operacional**

```js
function renderFluxoLeads() {
  return renderFluxoLeadsComDados_(state.bootstrap.fluxo.leads || [], state.fluxoFiltros.leads || {});
}
function renderFluxoChurns() {
  return renderFluxoChurnsComDados_(state.bootstrap.fluxo.churns || [], state.fluxoFiltros.churns || {});
}
function excluirChurnComConfirmacao_(churn) {
  if (window.confirm('Apagar este churn? Esta ação não pode ser desfeita.')) enqueue({ tipo: 'excluirFluxoChurn', valores: { id: churn.id } });
}
```

Incluir `Fluxo` no menu desktop e dock móvel; revelar Leads/Churns somente para a página Fluxo; ocultar os filtros globais nessa página. Criar badge colorido de status, formulário aberto sob demanda e link `https://wa.me/55` usando apenas dígitos do telefone, desabilitado abaixo de dez dígitos. Não usar `innerHTML` com textos cadastrados.

- [ ] **Step 4: Verificar e commitar**

Run: `npm test`

Expected: PASS.

```bash
git add apps-script/DashboardComponents.html apps-script/DashboardClient.html apps-script/DashboardStyles.html tests/dashboard-html.test.js
git commit -m "feat: add fluxo dashboard page"
```

### Task 6: Atualizar memória e instalação

**Files:**
- Modify: `CONTEXTO_DO_PROJETO.md`
- Modify: `CONTEXTO_DO_PROJETO.html`
- Modify: `apps-script/INSTRUCOES_INSTALACAO.md`

- [ ] **Step 1: Documentar a nova etapa e o rollout**

```markdown
1. Copie todos os arquivos alterados e crie o arquivo `15_DashboardFluxo` no Apps Script.
2. Salve e execute `garantirEstruturaPlanilha` uma vez para criar `FLUXO_LEADS` e `FLUXO_CHURNS`.
3. Publique uma nova versão do Web App e abra `Fluxo`.
4. Valide um Lead fictício, o link de WhatsApp sem enviar mensagem e a edição.
5. Valide um Churn fictício, edição e confirmação de exclusão.
```

- [ ] **Step 2: Executar a verificação final e commitar**

Run: `npm test && git diff --check && git status --short --branch`

Expected: testes verdes, diff limpo e nenhum arquivo do diretório não rastreado incluído.

```bash
git add CONTEXTO_DO_PROJETO.md CONTEXTO_DO_PROJETO.html apps-script/INSTRUCOES_INSTALACAO.md
git commit -m "docs: document fluxo rollout"
```

## Self-review

- As Tasks 1–4 cobrem abas, leitura, payload, validação, idempotência e exclusão segura.
- Task 5 cobre navegação, operação, WhatsApp e análise; Task 6 cobre o passo a passo remoto.
- O plano não inclui sincronização com a base mestre, automação de status, exclusão de Leads, classificação automática de textos livres ou taxa histórica de churn.
