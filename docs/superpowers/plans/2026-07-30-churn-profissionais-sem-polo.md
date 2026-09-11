# Churn — profissionais responsáveis sem plano ou polo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir contrato/polo por profissional responsável e último personal em `FLUXO_CHURNS`, preservando o fluxo manual e as análises temporais.

**Architecture:** O schema central em `00_Config.gs` dirige planilha, leitura e mutações. `15_DashboardFluxo.gs` define as listas permitidas, o payload seguro e diagnósticos; o cliente forma os menus e a lista. A aba está vazia por decisão do usuário, então a atualização de cabeçalho não migra registros antigos.

**Tech Stack:** Google Apps Script, HTML Service, JavaScript DOM, CSS, `node:test`.

## Global Constraints

- O cabeçalho de Churn é exatamente `churn_id`, `aluno_id`, `nome`, `telefone`, `data_saida`, `profissional_responsavel`, `ultimo_personal`, `motivo_saida`, `sinais_contexto`, `acao_retencao`, `criado_em`, `atualizado_em`.
- Não criar nem ler `contrato_x_sem` ou `polo` em Fluxo.
- Todos os Churns passam ao dashboard, sem filtro de polo.
- Os dois profissionais são opcionais e só aceitam as listas aprovadas.
- Não excluir, limpar ou alterar linhas de usuários; a aba já foi limpa manualmente.

---

### Task 1: Testes de schema, mutação e leitura

**Files:**
- Modify: `tests/dashboard-fluxo.test.js`
- Modify: `tests/dashboard-mutacoes.test.js`
- Modify: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: `CONFIG.cabecalhos.fluxoChurns`, `linhaChurnFluxoMutacao_`, `churnSeguroParaDashboard_`, `diagnosticosChurnFluxo_`.
- Produces: testes que exigem schema sem contrato/polo, profissionais válidos, leitura sem filtro e novos controles do cliente.

- [ ] **Step 1: Escrever testes que falham**

Adicionar um teste para o schema e um churn válido:

```js
assert.deepEqual(Array.from(gas.CONFIG.cabecalhos.fluxoChurns), [
  'churn_id', 'aluno_id', 'nome', 'telefone', 'data_saida',
  'profissional_responsavel', 'ultimo_personal', 'motivo_saida',
  'sinais_contexto', 'acao_retencao', 'criado_em', 'atualizado_em'
]);
assert.equal(linha[5], 'Elohim');
assert.equal(linha[6], 'Wallyson');
```

Adicionar testes que exigem todos os churns na leitura, agrupamento em `responsaveis`, rejeição de profissional inválido e campos `profissionalResponsavel`/`ultimoPersonal` no cliente.

- [ ] **Step 2: Executar testes para confirmar a falha**

Run: `node --test tests/dashboard-fluxo.test.js tests/dashboard-mutacoes.test.js tests/dashboard-html.test.js`

Expected: FAIL porque schema, backend e interface ainda referenciam contrato/polo.

### Task 2: Atualizar schema, backend e análises

**Files:**
- Modify: `apps-script/00_Config.gs`
- Modify: `apps-script/04_PlanilhaRepositorio.gs`
- Modify: `apps-script/14_DashboardMutacoes.gs`
- Modify: `apps-script/15_DashboardFluxo.gs`

**Interfaces:**
- Consumes: os nomes de cabeçalho da Task 1.
- Produces: `RESPONSAVEIS_CHURN_FLUXO`, `PERSONAIS_CHURN_FLUXO`, payload seguro com os novos campos e diagnóstico `responsaveis`.

- [ ] **Step 1: Definir o cabeçalho exato**

Substituir o cabeçalho de Churn em `CONFIG` pela sequência global e remover a migração legada que reintroduz contrato/polo.

- [ ] **Step 2: Definir listas e leitura segura**

```js
var RESPONSAVEIS_CHURN_FLUXO = Object.freeze(['Elohim', 'Xico', 'Cadu', 'Ruan', 'Iranildo']);
var PERSONAIS_CHURN_FLUXO = Object.freeze(RESPONSAVEIS_CHURN_FLUXO.concat([
  'Wallyson', 'Genuca', 'Yasmin', 'Wanderson Fabrício', 'Leonardo', 'Jackson',
  'Vitória', 'Maria', 'Clara', 'Thomas', 'Max', 'Sávio', 'Cristian', 'Rafael'
]));
```

Mapear colunas 5 e 6 do novo schema para `profissionalResponsavel` e `ultimoPersonal`. `filtrarChurnsFluxoParaDashboard_` deve devolver a lista sem filtro. Substituir `frequencias` por `responsaveis` nos diagnósticos, agrupando vazio em `Não informado`.

- [ ] **Step 3: Ajustar mutação**

Validar cada valor não vazio contra sua lista e devolver as 12 colunas na ordem do schema, preservando timestamps por índice 10 e 11.

- [ ] **Step 4: Executar os testes de backend**

Run: `node --test tests/dashboard-fluxo.test.js tests/dashboard-mutacoes.test.js`

Expected: PASS.

### Task 3: Atualizar PWA, contexto e instruções

**Files:**
- Modify: `apps-script/DashboardClient.html`
- Modify: `apps-script/INSTRUCOES_INSTALACAO.md`
- Modify: `CONTEXTO_DO_PROJETO.md`
- Modify: `CONTEXTO_DO_PROJETO.html`
- Test: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: `profissionalResponsavel`, `ultimoPersonal`, `diagnosticos.responsaveis`.
- Produces: formulário com dois selects, pop-up sem contrato/polo e documentação de aplicação atualizada.

- [ ] **Step 1: Atualizar formulário e lista**

No formulário de Churn, declarar primeiro `dataSaida`, depois selects com as listas aprovadas para `profissionalResponsavel` e `ultimoPersonal`; remover controles de contrato e polo. No pop-up, exibir ID como metadado e incluir os profissionais somente se preenchidos.

- [ ] **Step 2: Atualizar diagnóstico**

Trocar o bloco e título `Frequência contratada` por `Profissional responsável`, lendo `diagnosticos.responsaveis`.

- [ ] **Step 3: Atualizar continuidade**

Registrar o schema final e a regra de todos os churns no contexto Markdown/HTML. Em instruções de instalação, orientar que a aba já vazia terá os cabeçalhos atualizados e que não há filtro de polo.

- [ ] **Step 4: Executar verificação completa**

Run: `node --test tests/dashboard-html.test.js && npm test && git diff --check`

Expected: todos os testes passam, o cliente compila em `new Function(...)` e não há erro de whitespace.
