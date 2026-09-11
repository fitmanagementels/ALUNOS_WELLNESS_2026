# Refinamento de Fluxo e Pop-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar as listas e formulários de Leads e Churns mais legíveis, seguros e práticos no uso diário.

**Architecture:** A apresentação continuará toda no cliente Apps Script. `DashboardClient.html` formará estruturas DOM sem `innerHTML`, preservando os payloads atuais; `DashboardStyles.html` fornecerá as classes de ação, linhas e rodapés responsivos. O backend e a planilha não serão alterados.

**Tech Stack:** Google Apps Script HTML Service, JavaScript DOM, CSS, `node:test`.

## Global Constraints

- Não mudar mutações, métricas, filtros, payloads ou cabeçalhos da planilha.
- Datas devem chegar ao backend no formato `dd/MM/yyyy`.
- Manter confirmação antes da exclusão de churn.
- Não usar `innerHTML` no cliente.
- Toda ação deve ter alvo de toque de ao menos 44 px.

---

## File Structure

- `apps-script/DashboardClient.html`: monta os cartões da lista, configura datas de formulário e converte datas no envio.
- `apps-script/DashboardStyles.html`: estiliza ações semânticas, cartões de churn e rodapé dos formulários.
- `tests/dashboard-html.test.js`: protege os contratos estáticos de UX e a conversão das datas.
- `apps-script/INSTRUCOES_INSTALACAO.md`: explica que o refinamento exige publicar os arquivos de cliente e estilo atuais.

### Task 1: Cobertura de regressão para Fluxo

**Files:**
- Modify: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: classes `secondary`, `danger`, `record-actions`, `churn-detail-row`, `fluxo-form`.
- Produces: teste estático que exige os elementos e a conversão `dashboardDate` no envio do formulário.

- [ ] **Step 1: Escrever o teste que falha**

```js
test('Fluxo usa ações semânticas, datas nativas e rodapé de formulário', () => {
  const client = fs.readFileSync('apps-script/DashboardClient.html', 'utf8');
  const css = fs.readFileSync('apps-script/DashboardStyles.html', 'utf8');
  assert.match(client, /record-actions/);
  assert.match(client, /'danger','Apagar'/);
  assert.match(client, /fluxo-form/);
  assert.match(client, /'Primeiro contato',[^\n]*'date'/);
  assert.match(client, /item\.dataset\.date==='true'\?dashboardDate\(item\.value\):item\.value/);
  assert.match(css, /\.churn-detail-row/);
  assert.match(css, /\.fluxo-form \.form-actions/);
  assert.match(css, /\.danger\s*\{[^}]*min-height:\s*44px/s);
});
```

- [ ] **Step 2: Executar o teste para confirmar a falha**

Run: `node --test tests/dashboard-html.test.js`

Expected: FAIL porque as classes de cartões, ações de risco e rodapé ainda não existem.

- [ ] **Step 3: Manter o teste como contrato de regressão**

O teste permanecerá no arquivo para validar as alterações das tarefas seguintes.

### Task 2: Lista de churns e formulários de Fluxo

**Files:**
- Modify: `apps-script/DashboardClient.html`
- Test: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: `parseDate`, `inputDate`, `dashboardDate`, `enqueue`, `abrirFormularioFluxo`.
- Produces: `linhaDetalheChurnFluxo(item)` com uma linha semântica e `fluxoCampo(...)` com metadado `dataset.date` para conversão de envio.

- [ ] **Step 1: Criar a linha compacta de churn**

Substituir a sequência de título, parágrafo, lista e botões soltos por `article.churn-detail-row`, contendo `churn-detail-heading`, `churn-detail-date`, `churn-detail-meta`, detalhes apenas preenchidos e `div.record-actions`. Criar `Editar` com a classe `secondary` e `Apagar` com a classe `danger`, mantendo o mesmo `window.confirm` antes de `enqueue`.

- [ ] **Step 2: Corrigir a ordenação cronológica**

```js
itens.slice().sort(function(a,b){
  return (parseDate(b.dataSaida) || 0) - (parseDate(a.dataSaida) || 0);
});
```

- [ ] **Step 3: Tornar datas campos nativos sem mudar o payload**

Em `fluxoCampo`, quando `type === 'date'`, preencher com `inputDate(value)` e guardar `input.dataset.date = 'true'`. Declarar como `date` os campos `primeiroContato`, `experimental`, `entradaComoCliente` e `dataSaida`. No envio do formulário, usar exatamente:

```js
values[item.name] = item.dataset.date==='true'
  ? dashboardDate(item.value)
  : item.value;
```

- [ ] **Step 4: Criar o rodapé de ação do formulário**

Montar o formulário com a classe `settings-grid fluxo-form`, adicionar `div.form-actions` e colocar dentro dela o botão `Salvar` de tipo `submit`.

- [ ] **Step 5: Executar o teste após a implementação**

Run: `node --test tests/dashboard-html.test.js`

Expected: PASS.

### Task 3: Acabamento responsivo e instrução de publicação

**Files:**
- Modify: `apps-script/DashboardStyles.html`
- Modify: `apps-script/INSTRUCOES_INSTALACAO.md`
- Test: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: as classes produzidas na Task 2.
- Produces: controles consistentes, ações com hierarquia visual e formulário adaptado a telas estreitas.

- [ ] **Step 1: Estilizar ações semânticas**

Adicionar regras para `.secondary` e `.danger` com `min-height: 44px`, foco visível, hover e contraste. `danger` deve ter borda e cor vermelhas sem depender apenas da cor do texto.

- [ ] **Step 2: Estilizar cartões e metadados da lista**

Adicionar `.churn-detail-row`, `.churn-detail-heading`, `.churn-detail-date`, `.churn-detail-meta`, `.churn-detail-notes` e `.record-actions`. Em telas até 720 px, empilhar o cabeçalho quando necessário e manter as ações confortáveis para toque.

- [ ] **Step 3: Estilizar o formulário de Fluxo**

Adicionar `.fluxo-form .form-actions` com separador superior e alinhamento após os campos. Em telas até 720 px, o botão primário deve ocupar `width: 100%`.

- [ ] **Step 4: Atualizar instrução de publicação**

Em `apps-script/INSTRUCOES_INSTALACAO.md`, registrar que o refinamento visual exige copiar `DashboardClient.html` e `DashboardStyles.html` e publicar uma nova versão do Web App.

- [ ] **Step 5: Verificar a entrega**

Run: `node --test tests/dashboard-html.test.js && npm test && git diff --check`

Expected: todos os testes passam e não há erros de whitespace.
