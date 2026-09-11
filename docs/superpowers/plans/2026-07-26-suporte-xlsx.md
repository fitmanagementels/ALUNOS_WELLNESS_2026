# Suporte a relatórios XLSX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o importador TecnoFit leia relatórios HTML/XLS legados e arquivos XLSX reais, mesmo se a extensão recebida não corresponder ao conteúdo.

**Architecture:** O módulo de Drive detectará o formato pelos bytes do blob e definirá a extensão canônica de arquivamento. Um novo leitor OOXML transformará a primeira worksheet XLSX em matriz de valores e entregará essa matriz à atual `tabelaParaObjetos`, mantendo validação e transformação compartilhadas com o leitor HTML.

**Tech Stack:** Google Apps Script, `Utilities.unzip`, JavaScript ES5/ES6 compatível com V8, Node.js `node:test`.

## Global Constraints

- Não adicionar dependências nem serviços avançados do Google Drive.
- Manter a compatibilidade com os relatórios HTML/XLS já processados.
- Usar o conteúdo real do arquivo, e não a extensão, para escolher o leitor e o nome canônico de arquivamento.
- Validar os três relatórios antes de substituir as abas gerenciadas.
- Não criar worktree; `main` é a única cópia oficial do projeto.

---

### Task 1: Reconhecer extensões e formato real do arquivo

**Files:**
- Modify: `apps-script/05_DriveRepositorio.gs`
- Modify: `tests/lote.test.js`

**Interfaces:**
- Produces: `parseNomeArquivo(nome)` com `{ tipo, dataReferencia, revisao, extensaoRecebida, nomeCanonico }`.
- Produces: `detectarFormatoArquivo(blob)` com `{ formato: 'html'|'xlsx', extensaoCanonica: 'xls'|'xlsx' }`.
- Consumes: blob Apps Script com `getBytes()`.

- [ ] **Step 1: Write the failing tests**

```js
test('aceita XLSX e preserva a extensão recebida no metadado', () => {
  const parsed = gas.parseNomeArquivo('vencimentos_2026-07-25_r01.xlsx');
  assert.equal(parsed.extensaoRecebida, 'xlsx');
  assert.equal(parsed.nomeCanonico, 'vencimentos_2026-07-25_r01.xlsx');
});

test('detecta XLSX pelo cabeçalho ZIP mesmo quando o nome termina em XLS', () => {
  const blob = { getBytes: () => [0x50, 0x4b, 0x03, 0x04] };
  assert.deepEqual(
    gas.detectarFormatoArquivo(blob),
    { formato: 'xlsx', extensaoCanonica: 'xlsx' }
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/lote.test.js`

Expected: FAIL because `.xlsx` and `detectarFormatoArquivo` are not yet supported.

- [ ] **Step 3: Implement minimal name and byte-signature support**

```js
var match = /^(vencimentos|fichas|avaliacao_fisica)_(\d{4})[-_](\d{2})[-_](\d{2})_r(\d{2})\.(xls|xlsx)$/i.exec(texto);

function detectarFormatoArquivo(blob) {
  var bytes = blob.getBytes();
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return { formato: 'xlsx', extensaoCanonica: 'xlsx' };
  }
  return { formato: 'html', extensaoCanonica: 'xls' };
}
```

The implementation must reject a non-ZIP blob that does not contain HTML/table markup when it is later read.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/lote.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps-script/05_DriveRepositorio.gs tests/lote.test.js
git commit -m "feat: recognize xlsx input files"
```

### Task 2: Converter a primeira worksheet XLSX em linhas

**Files:**
- Create: `apps-script/02_ParserXlsx.gs`
- Modify: `tests/parser.test.js`

**Interfaces:**
- Produces: `parseTabelaXlsx(blob)` returning `Array<Array<string>>`.
- Consumes: `Utilities.unzip(blob)` returning blobs with `getName()` and `getDataAsString('UTF-8')`.
- Consumes: `decodificarCelulaHtml_` from `apps-script/02_ParserHtml.gs` for XML entity decoding.

- [ ] **Step 1: Write the failing tests with an in-memory OOXML archive**

```js
function xlsxBlob(files) {
  return { getBytes: () => [0x50, 0x4b, 0x03, 0x04], files };
}

const gas = loadGas(
  ['apps-script/02_ParserHtml.gs', 'apps-script/02_ParserXlsx.gs'],
  { Utilities: { unzip: blob => blob.files } }
);

test('interpreta shared strings, texto inline e números de XLSX', () => {
  const rows = gas.parseTabelaXlsx(xlsxBlob([
    xmlBlob('xl/sharedStrings.xml', '<sst><si><t>Código</t></si><si><t>Cliente</t></si><si><t>101</t></si></sst>'),
    xmlBlob('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="inlineStr"><is><t>Ana</t></is></c></row></sheetData></worksheet>')
  ]));
  assert.deepEqual(rows, [['Código', 'Cliente'], ['101', 'Ana']]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/parser.test.js`

Expected: FAIL because `apps-script/02_ParserXlsx.gs` and `parseTabelaXlsx` do not exist.

- [ ] **Step 3: Implement the minimal OOXML parser**

```js
function parseTabelaXlsx(blob) {
  var partes = arquivosXlsxPorNome_(Utilities.unzip(blob));
  var compartilhadas = lerSharedStringsXlsx_(partes['xl/sharedStrings.xml']);
  var worksheet = primeiraWorksheetXlsx_(partes);
  if (!worksheet) throw new Error('XLSX inválido: nenhuma worksheet encontrada.');
  return linhasWorksheetXlsx_(worksheet.getDataAsString('UTF-8'), compartilhadas);
}
```

Implement helpers for XML local-name extraction, shared strings, inline strings, missing cell positions and Excel numeric dates. A malformed archive must throw an error that identifies XLSX as the failing format.

- [ ] **Step 4: Add date and malformed-XLSX tests, then verify GREEN**

```js
test('converte data serial XLSX para dd/MM/yyyy', () => {
  const rows = gas.parseTabelaXlsx(dataSerializadaXlsx(46000));
  assert.equal(rows[1][0], '09/12/2025');
});

test('rejeita XLSX sem worksheet', () => {
  assert.throws(() => gas.parseTabelaXlsx(xlsxBlob([])), /nenhuma worksheet/);
});
```

Run: `node --test tests/parser.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps-script/02_ParserXlsx.gs tests/parser.test.js tests/helpers/load-gas.js
git commit -m "feat: parse xlsx worksheets"
```

### Task 3: Roteamento, arquivamento e regressão da importação

**Files:**
- Modify: `apps-script/05_DriveRepositorio.gs`
- Modify: `tests/lote.test.js`
- Modify: `tests/service.test.js`
- Modify: `apps-script/INSTRUCOES_INSTALACAO.md`
- Modify: `LEIA-ME.md`

**Interfaces:**
- Consumes: `detectarFormatoArquivo(blob)` and `parseTabelaXlsx(blob)`.
- Produces: `lerTabelasDoLote(lote)` that routes each file by content and assigns `nomeCanonico` from the detected extension.

- [ ] **Step 1: Write the failing routing and safety tests**

```js
test('usa leitor XLSX e corrige o nome canônico de XLSX renomeado como XLS', () => {
  const lote = loteComArquivo('vencimentos_2026-07-25_r01.xls', zipBlob);
  const dados = gas.lerTabelasDoLote(lote);
  assert.equal(lote.arquivosPorTipo.vencimentos.nomeCanonico, 'vencimentos_2026-07-25_r01.xlsx');
  assert.equal(dados.vencimentos[0].codigo, '101');
});

test('não chama substituir quando a leitura XLSX falha', () => {
  assert.throws(() => executarComXlsxInvalido(), /XLSX inválido/);
  assert.equal(substituicoes, 0);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/lote.test.js tests/service.test.js`

Expected: FAIL because the current reader always calls `getDataAsString('UTF-8')` and does not set canonical extension from content.

- [ ] **Step 3: Implement the route before transformation**

```js
var formato = detectarFormatoArquivo(entrada.arquivo.getBlob());
entrada.nomeCanonico = entrada.tipo + '_' + lote.dataReferencia + '_r' + lote.revisao + '.' + formato.extensaoCanonica;
var linhas = formato.formato === 'xlsx'
  ? parseTabelaXlsx(entrada.arquivo.getBlob())
  : parseTabelaHtml(entrada.arquivo.getBlob().getDataAsString('UTF-8'));
```

Pass `linhas` to `tabelaParaObjetos` unchanged. Do not modify the backup/substitution order in `07_ImportacaoService.gs`.

- [ ] **Step 4: Run focused tests and full suite**

Run: `node --test tests/lote.test.js tests/service.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Update operating documentation**

State that `.xls` and `.xlsx` are accepted; instruct operators to preserve the downloaded filename extension when possible; explain that the archived extension follows the actual file format.

- [ ] **Step 6: Commit**

```bash
git add apps-script/05_DriveRepositorio.gs tests/lote.test.js tests/service.test.js apps-script/INSTRUCOES_INSTALACAO.md LEIA-ME.md
git commit -m "feat: route xlsx imports safely"
```

### Task 4: Verificação e instalação

**Files:**
- Modify: `CONTEXTO_DO_PROJETO.md`
- Modify: `CONTEXTO_DO_PROJETO.html`

**Interfaces:**
- Consumes: suite completa verde e código Apps Script atualizado.
- Produces: instruções de atualização e registro do suporte a XLSX.

- [ ] **Step 1: Run final verification**

Run: `npm test`

Expected: PASS without failures.

- [ ] **Step 2: Inspect the final diff and status**

Run: `git diff --check && git status --short --branch`

Expected: no whitespace errors and clean working tree.

- [ ] **Step 3: Commit project context update**

```bash
git add CONTEXTO_DO_PROJETO.md CONTEXTO_DO_PROJETO.html
git commit -m "docs: record xlsx import support"
```

- [ ] **Step 4: Manual operational check**

Copy the updated `.gs` files into the bound Apps Script project, save, reload the master sheet, then import a fresh revision (for example `2026-07-25 r02` if `r01` was not processed). Confirm the panel reports success, `IMPORTACOES` records three `SUCESSO` rows, `01_ENTRADA` is empty and the processed files have extensions matching their actual content.
