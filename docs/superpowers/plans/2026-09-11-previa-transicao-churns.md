# Prévia de Transição de Churns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar, a partir da fonte oficial e da `FLUXO_CHURNS` atual, uma prévia auditável da nova lista de Churns sem modificar a lista usada pelo PWA.

**Architecture:** Um módulo Apps Script isolado lê o arquivo XLSX oficial já compartilhado, consolida uma linha por ID pelo maior vencimento e combina somente os campos manuais do registro atual com o mesmo ID. A prévia é escrita em uma aba de conferência separada e retorna contagens por classificação; `FLUXO_CHURNS`, o bootstrap e o PWA não sofrem escrita nem mudança de contrato nesta fase.

**Tech Stack:** Google Apps Script, Google Sheets, Google Drive, parser XLSX já existente (`apps-script/02_ParserXlsx.gs`), testes Node `node:test`.

## Global Constraints

- Não versionar nem copiar para o repositório os arquivos oficiais, IDs de fontes, telefones ou dados reais de alunos.
- Não alterar, limpar, reordenar ou substituir `FLUXO_CHURNS` durante esta fase.
- A fonte oficial define nome, contrato, valor, início, vencimento, professor e modalidade; o vencimento máximo por ID vence quaisquer datas antigas.
- Os únicos valores trazidos da lista antiga são telefone e campos manuais: responsável, último personal, motivo, contexto e retenção.
- IDs equivalentes como `123` e `123.0` são o mesmo aluno.
- ID ausente, vencimento ausente, empate no maior vencimento e mais de uma linha antiga manualmente preenchida são divergências, nunca escolhas automáticas.
- O PWA só deverá mudar após revisão humana do relatório e nova autorização explícita.

---

## Estrutura de arquivos

| Caminho | Responsabilidade |
|---|---|
| `apps-script/21_TransicaoChurns.gs` | Leitura da fonte configurada, normalização, consolidação, reconciliação, relatório e escrita exclusiva da prévia. |
| `apps-script/08_Main.gs` | Item de menu para gerar a prévia, sem ação de troca. |
| `tests/transicao-churns.test.js` | Regras puras de consolidação, transferência e classificação da prévia. |
| `tests/main.test.js` | Contrato do item de menu e garantia de que a prévia não usa a mutação do PWA. |
| `docs/operacao/` | Não modificar nesta fase; o procedimento final só será documentado após o relatório ser aprovado. |

### Task 1: Criar o núcleo puro de consolidação e reconciliação

**Files:**
- Create: `apps-script/21_TransicaoChurns.gs`
- Create: `tests/transicao-churns.test.js`

**Interfaces:**
- Consumes: linhas do XLSX oficial, onde a primeira linha contém os cabeçalhos `Código`, `Cliente`, `Contrato`, `Valor`, `Início`, `Vencimento`, `Professor` e `Modalidade`; linhas atuais da `FLUXO_CHURNS` na ordem de `CONFIG.cabecalhos.fluxoChurns`.
- Produces: `construirPreviaTransicaoChurns_(linhasOficiais, churnsAtuais)` retorna `{ linhas, resumo }`, sem chamar Apps Script ou gravar planilha.
- Produces: cada item de `linhas` tem `grupo`, `alunoId`, `nomeOficial`, `nomeAnterior`, `inicioOficial`, `vencimentoOficial`, `planoOficial`, `valorOficial`, `professorOficial`, `modalidadeOficial`, `telefonePreservado`, campos manuais e `detalheRevisao`.

- [ ] **Step 1: Escrever os testes que falham**

Crie `tests/transicao-churns.test.js` carregando `00_Config.gs` e `21_TransicaoChurns.gs`. Use apenas dados sintéticos. Cubra estas quatro situações:

```js
const fonteOficialTeste = [
  ['', 'Código', 'Cliente', 'Contrato', 'Valor', 'Início', 'Vencimento', 'Professor', 'Modalidade'],
  ['', '42.0', 'NOME OFICIAL', '2X', 765, '01/06/2026', '30/07/2026', 'Ruan', 'Musculação']
];

test('consolida cada ID pelo maior vencimento oficial', () => {
  const previa = gas.construirPreviaTransicaoChurns_([
    ['', 'Código', 'Cliente', 'Contrato', 'Valor', 'Início', 'Vencimento', 'Professor', 'Modalidade'],
    ['', '42.0', 'ALUNO A', '2X', 765, '01/06/2026', '30/06/2026', 'Xico', 'Musculação'],
    ['', '42', 'ALUNO A', '3X', 1000, '01/07/2026', '30/07/2026', 'Ruan', 'Musculação']
  ], []);
  assert.equal(previa.linhas.length, 1);
  assert.equal(previa.linhas[0].alunoId, '42');
  assert.equal(previa.linhas[0].planoOficial, '3X');
  assert.equal(previa.linhas[0].vencimentoOficial, '30/07/2026');
});

test('preserva somente telefone e campos manuais pelo ID', () => {
  const antiga = [['old-1', '42', 'NOME ANTIGO', '85999999999', '01/01/2026',
    'Elohim', 'Xico', 'Horário', 'Mudança de rotina', 'Ligação feita', 'criado', 'atualizado']];
  const previa = gas.construirPreviaTransicaoChurns_(fonteOficialTeste, antiga);
  const linha = previa.linhas[0];
  assert.equal(linha.nomeOficial, 'NOME OFICIAL');
  assert.equal(linha.vencimentoOficial, '30/07/2026');
  assert.equal(linha.telefonePreservado, '85999999999');
  assert.equal(linha.profissionalResponsavel, 'Elohim');
  assert.equal(linha.motivoSaida, 'Horário');
});

test('classifica antigo sem fonte e novo sem dados manuais', () => {
  const previa = gas.construirPreviaTransicaoChurns_(fonteComIdNovo, churnsComIdLegado);
  assert.deepEqual(previa.resumo, {
    migraraComDadosManuais: 0,
    migraraSemDadosManuais: 1,
    antigoSemCorrespondenteOficial: 1,
    divergenciaParaRevisao: 0
  });
});

test('não transfere automaticamente em empate oficial ou duplicidade manual', () => {
  const previa = gas.construirPreviaTransicaoChurns_(fonteComEmpate, churnsComDoisManuaisMesmoId);
  assert.equal(previa.linhas.filter(linha => linha.grupo === 'Divergência para revisão').length, 2);
  assert.ok(previa.linhas.every(linha => linha.grupo !== 'Migrará com dados manuais preservados' || !linha.detalheRevisao));
});
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `node --test tests/transicao-churns.test.js`

Expected: FAIL com `ENOENT` para `apps-script/21_TransicaoChurns.gs` ou função inexistente.

- [ ] **Step 3: Implementar o núcleo mínimo**

Crie `apps-script/21_TransicaoChurns.gs` com funções puras e independentes do PWA. A normalização e a escolha do vencimento devem seguir esta lógica:

```js
function chaveDataTransicaoChurn_(valor) {
  var partes = String(valor == null ? '' : valor).trim().split('/');
  if (partes.length !== 3 || !/^\d{2}$/.test(partes[0]) || !/^\d{2}$/.test(partes[1]) || !/^\d{4}$/.test(partes[2])) return '';
  var data = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]), 12);
  if (data.getFullYear() !== Number(partes[2]) || data.getMonth() !== Number(partes[1]) - 1 || data.getDate() !== Number(partes[0])) return '';
  return partes[2] + partes[1] + partes[0];
}

function normalizarIdTransicaoChurn_(valor) {
  var texto = String(valor == null ? '' : valor).trim();
  if (!texto) return '';
  return /^\d+\.0+$/.test(texto) ? texto.replace(/\.0+$/, '') : texto;
}

function maiorDataTransicaoChurn_(a, b) {
  return chaveDataTransicaoChurn_(a) > chaveDataTransicaoChurn_(b) ? a : b;
}
```

Não use `maiorDataTransicaoChurn_` para resolver empates: ao encontrar duas linhas do mesmo ID com o mesmo maior vencimento, crie o caso `Divergência para revisão` com `detalheRevisao` igual a `Empate no maior vencimento oficial`.

Monte um índice da lista antiga por `aluno_id`. Considere uma linha “manualmente preenchida” quando ao menos um dos campos `telefone`, `profissional_responsavel`, `ultimo_personal`, `motivo_saida`, `sinais_contexto` ou `acao_retencao` tiver conteúdo. Se houver duas ou mais linhas manuais para o mesmo ID, não escolha uma delas: gere `Divergência para revisão` com `detalheRevisao` igual a `Mais de um registro manual para o ID`.

O registro consolidado oficial usa os valores do maior vencimento. Para o caso sem conflito, copie da antiga somente os seis campos permitidos; não copie `nome`, `data_saida`, `criado_em`, `atualizado_em` ou qualquer dado de plano antigo.

- [ ] **Step 4: Rodar os testes do núcleo**

Run: `node --test tests/transicao-churns.test.js`

Expected: PASS, 4 testes aprovados.

- [ ] **Step 5: Commit**

```bash
git add apps-script/21_TransicaoChurns.gs tests/transicao-churns.test.js
git commit -m "feat: preparar reconciliacao de churns oficiais"
```

### Task 2: Ler a fonte oficial e escrever exclusivamente a aba de prévia

**Files:**
- Modify: `apps-script/21_TransicaoChurns.gs`
- Modify: `apps-script/08_Main.gs`
- Modify: `tests/transicao-churns.test.js`
- Modify: `tests/main.test.js`

**Interfaces:**
- Consumes: propriedade de script `tecnofit.fluxo.churns.fonte_oficial_id`, contendo o ID do XLSX oficial já compartilhado.
- Consumes: `parseTabelaXlsx(blob)` de `02_ParserXlsx.gs` e a aba `FLUXO_CHURNS` existente.
- Produces: `gerarPreviaTransicaoChurns()` retorna `{ aba: 'PREVIA_TRANSICAO_CHURNS', resumo }` e só escreve nessa aba.
- Produces: `configurarFonteOficialChurns_(fileId)` armazena um ID de arquivo não vazio em Script Properties; ela não salva dados de aluno.

- [ ] **Step 1: Adicionar testes de orquestração que falham**

No mesmo teste, crie mocks para `DriveApp.getFileById`, `PropertiesService.getScriptProperties`, uma planilha com `FLUXO_CHURNS` e uma aba vazia de prévia. Valide:

```js
test('gerarPreviaTransicaoChurns grava somente a aba de conferência', () => {
  const antes = JSON.stringify(sheets.FLUXO_CHURNS.values);
  const resultado = gas.gerarPreviaTransicaoChurns();
  assert.equal(resultado.aba, 'PREVIA_TRANSICAO_CHURNS');
  assert.equal(JSON.stringify(sheets.FLUXO_CHURNS.values), antes);
  assert.equal(sheets.PREVIA_TRANSICAO_CHURNS.values[0][0], 'grupo');
});

test('recusa gerar prévia sem fonte configurada', () => {
  assert.throws(() => gas.gerarPreviaTransicaoChurns(), /Fonte oficial de Churns não configurada/);
});
```

Também valide que o novo item de menu usa exatamente `Gerar prévia de transição de Churns` e chama `gerarPreviaTransicaoChurns`.

- [ ] **Step 2: Rodar os testes para confirmar a falha**

Run: `node --test tests/transicao-churns.test.js tests/main.test.js`

Expected: FAIL porque a função de geração, o cabeçalho de prévia e o item de menu ainda não existem.

- [ ] **Step 3: Implementar a leitura e a escrita segura**

Em `21_TransicaoChurns.gs`, declare os cabeçalhos da prévia sem alterar `CONFIG.abas`:

```js
var CABECALHOS_PREVIA_TRANSICAO_CHURNS = Object.freeze([
  'grupo', 'aluno_id', 'nome_oficial', 'nome_anterior', 'inicio_oficial',
  'vencimento_oficial', 'plano_oficial', 'valor_oficial', 'professor_oficial',
  'modalidade_oficial', 'telefone_preservado', 'profissional_responsavel',
  'ultimo_personal', 'motivo_saida', 'sinais_contexto', 'acao_retencao',
  'detalhe_revisao'
]);
var CHAVE_FONTE_OFICIAL_CHURNS = 'tecnofit.fluxo.churns.fonte_oficial_id';
```

Implemente `configurarFonteOficialChurns_(fileId)` validando texto não vazio e gravando somente em `PropertiesService.getScriptProperties()`.

Implemente `gerarPreviaTransicaoChurns()` nesta sequência fixa:

1. adquirir `LockService.getScriptLock()` e liberá-lo em `finally`;
2. ler a propriedade; sem ID, lançar `Fonte oficial de Churns não configurada.`;
3. ler `DriveApp.getFileById(fileId).getBlob()` e chamar `parseTabelaXlsx(blob)`;
4. ler `FLUXO_CHURNS` usando `lerTabelaDashboardDaPlanilha_` e seus cabeçalhos canônicos;
5. chamar `construirPreviaTransicaoChurns_`;
6. criar ou localizar somente `PREVIA_TRANSICAO_CHURNS`, limpar seu conteúdo, escrever o cabeçalho e as linhas, congelar a primeira linha e criar filtro;
7. chamar `SpreadsheetApp.flush()` e retornar nome da aba e resumo.

A escrita deve usar linhas serializadas exatamente na ordem de `CABECALHOS_PREVIA_TRANSICAO_CHURNS`. Não chame `salvarMutacoesDashboard`, `escreverTabelaMutacoesDashboard_`, `incrementarVersaoDashboard_` nem `incrementarVersaoChurnDashboard_` nesta função.

Em `08_Main.gs`, acrescente ao menu:

```js
.addItem('Gerar prévia de transição de Churns', 'gerarPreviaTransicaoChurns')
```

O menu não chama nenhuma função de substituição.

- [ ] **Step 4: Rodar testes de orquestração e regressão de Fluxo**

Run: `node --test tests/transicao-churns.test.js tests/main.test.js tests/dashboard-fluxo.test.js tests/dashboard-mutacoes.test.js`

Expected: PASS; a asserção de imutabilidade de `FLUXO_CHURNS` durante a prévia permanece verde.

- [ ] **Step 5: Commit**

```bash
git add apps-script/08_Main.gs apps-script/21_TransicaoChurns.gs tests/transicao-churns.test.js tests/main.test.js
git commit -m "feat: gerar previa segura de transicao de churns"
```

### Task 3: Validar o relatório real e interromper antes da troca

**Files:**
- Modify: `CONTEXTO_DO_PROJETO.md`
- Modify: `CONTEXTO_DO_PROJETO.html`
- Test: `tests/transicao-churns.test.js`

**Interfaces:**
- Consumes: a função publicada `configurarFonteOficialChurns_` e `gerarPreviaTransicaoChurns`.
- Produces: uma aba privada `PREVIA_TRANSICAO_CHURNS` revisada pelo usuário e um estado documentado de “aguardando decisão”.

- [ ] **Step 1: Executar a suíte completa antes de publicar**

Run: `npm test`

Expected: PASS sem regressões; não publicar se houver falha.

- [ ] **Step 2: Publicar apenas o Apps Script necessário**

Envie o módulo Apps Script pelo workflow existente `Deploy Apps Script`, que executa `clasp push --force` e atualiza a implantação configurada. Antes de executar qualquer função remota, confirme que o deployment ativo contém `gerarPreviaTransicaoChurns` e que a propriedade da fonte aponta para o XLSX oficial fornecido pelo usuário.

Expected: o deployment aceita a configuração da fonte e a função de prévia, sem mudança de `FLUXO_CHURNS`.

- [ ] **Step 3: Gerar e conferir a prévia em produção**

Execute `gerarPreviaTransicaoChurns` uma vez. Confirme visualmente na planilha mestre:

```text
PREVIA_TRANSICAO_CHURNS
  - cabeçalho com 17 colunas;
  - grupos de relatório preenchidos;
  - uma linha oficial máxima por ID;
  - telefones e campos manuais presentes somente nos IDs correspondentes;
  - FLUXO_CHURNS inalterada, linha a linha.
```

Registre as contagens retornadas pela função, mas não copie telefones ou nomes para o Git, testes ou documentação.

- [ ] **Step 4: Atualizar o contexto sem expor dados operacionais**

Em ambos os arquivos de contexto, registre: fonte oficial processada, prévia gerada, contagens agregadas e que a troca da lista principal depende da revisão humana. Não registre IDs, nomes, telefones, URL da fonte nem conteúdo do relatório.

- [ ] **Step 5: Commit e parar para decisão do usuário**

```bash
git add CONTEXTO_DO_PROJETO.md CONTEXTO_DO_PROJETO.html
git commit -m "docs: registrar previa de transicao de churns"
```

Entregue ao usuário apenas o link para a aba de prévia e as contagens agregadas. Não implemente backup, substituição de `FLUXO_CHURNS`, atualização do PWA, cache ou GitHub Pages nesta tarefa. Essas ações pertencem a um novo plano, após a decisão do usuário sobre os casos do relatório.

## Self-review

- **Cobertura do escopo aprovado:** Tasks 1–2 constroem a consolidação e o relatório; Task 3 valida o relatório real e interrompe antes da troca, exatamente como aprovado.
- **Limite deliberado:** a substituição da lista, o backup datado, a evolução do perfil de churn e o PWA estão fora deste plano porque dependem da decisão que será tomada ao revisar `PREVIA_TRANSICAO_CHURNS`.
- **Segurança:** não há caminho de escrita para `FLUXO_CHURNS` durante a prévia; conflitos permanecem classificados em vez de resolvidos silenciosamente.
- **Consistência:** todas as tarefas usam `construirPreviaTransicaoChurns_`, `gerarPreviaTransicaoChurns`, `PREVIA_TRANSICAO_CHURNS` e os mesmos seis campos manuais definidos nas regras globais.
