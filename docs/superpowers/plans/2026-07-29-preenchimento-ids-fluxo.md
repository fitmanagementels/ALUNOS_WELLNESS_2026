# Preenchimento de IDs de Fluxo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao menu TecnoFit um comando seguro que preencha IDs internos pendentes nas abas de Fluxo.

**Architecture:** Uma função em `08_Main.gs` garantirá a estrutura, lerá as duas abas e escreverá somente células vazias da coluna A em linhas com conteúdo. Ela usará `Utilities.getUuid()` e mostrará o total alterado por aba.

**Tech Stack:** Google Apps Script e Node.js `node:test`.

## Global Constraints

- Não alterar `aluno_id` de Churn nem qualquer coluna além de A.
- Preservar IDs existentes e ignorar linhas totalmente vazias.
- Não validar correspondência entre `aluno_id` e `VISAO_MESTRE` nesta etapa.

---

### Task 1: Comando de preenchimento e menu

**Files:**
- Modify: `apps-script/08_Main.gs`
- Modify: `tests/main.test.js`

**Interfaces:** produz `preencherIdsPendentesFluxo()` e `preencherIdsPendentesNaAbaFluxo_(aba, cabecalhos)`; `onOpen()` expõe o comando no menu TecnoFit.

- [ ] **Step 1: Escrever o teste que exige preenchimento somente em linhas elegíveis**

```js
const resultado = gas.preencherIdsPendentesNaAbaFluxo_(aba, config.cabecalhos.fluxoChurns);
assert.deepEqual(resultado, { preenchidos: 1 });
assert.equal(aba.values[1][0], 'uuid-1');
assert.equal(aba.values[1][1], '123');
assert.equal(aba.values[2][0], 'churn-existente');
assert.equal(aba.values[3][0], '');
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `node tests/main.test.js`

Expected: FAIL porque a função ainda não existe.

- [ ] **Step 3: Implementar leitura, UUID e confirmação**

```js
function preencherIdsPendentesFluxo_() {
  garantirEstruturaPlanilha();
  var planilha = obterPlanilhaMestre_();
  var leads = preencherIdsPendentesNaAbaFluxo_(planilha.getSheetByName(CONFIG.abas.fluxoLeads), CONFIG.cabecalhos.fluxoLeads);
  var churns = preencherIdsPendentesNaAbaFluxo_(planilha.getSheetByName(CONFIG.abas.fluxoChurns), CONFIG.cabecalhos.fluxoChurns);
  SpreadsheetApp.getUi().alert('IDs de Fluxo preenchidos: ' + leads.preenchidos + ' Lead(s) e ' + churns.preenchidos + ' Churn(s).');
}
```

`preencherIdsPendentesNaAbaFluxo_` lê os cabeçalhos exatos, identifica valores não vazios fora da coluna A e usa `setValue(Utilities.getUuid())` somente na célula A da linha elegível.

- [ ] **Step 4: Rodar testes e verificar o menu**

Run: `node tests/main.test.js && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps-script/08_Main.gs tests/main.test.js docs/superpowers/specs/2026-07-29-preenchimento-ids-fluxo-design.md docs/superpowers/plans/2026-07-29-preenchimento-ids-fluxo.md
git commit -m "feat: fill pending fluxo ids from menu"
```

## Self-review

- O único campo alterado é a coluna A das duas abas de Fluxo.
- `aluno_id` de Churn é apenas lido como dado da linha e não sofre validação ou escrita.
- A operação é repetível: após preencher pendências, nova execução informa zero e não muda linhas existentes.
