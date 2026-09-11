# Permanência de clientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporar o relatório Clientes por permanência aos lotes TecnoFit, preservar a primeira entrada e as mudanças históricas, carregar automaticamente os 980 registros iniciais e publicar a terceira subaba Financeiro > Permanência sem estimar LTV.

**Architecture:** O importador continuará transacional e passará a consolidar quatro relatórios. Um módulo puro criará o estado atual e um log idempotente de mudanças; o repositório persistirá `BASE_PERMANENCIA` e `HISTORICO_PERMANENCIA` junto das três bases gerenciadas atuais. O bootstrap público enviará somente os campos seguros, e um módulo JavaScript isolado calculará tempo, faixas e coortes localmente para a PWA.

**Tech Stack:** Google Apps Script V8, SpreadsheetApp, DriveApp, CacheService, HTML/XLS e XLSX, JavaScript ES5 compatível com Apps Script e navegador, Node.js 20+ com `node:test`, PWA estática no GitHub Pages, Cloudflare Worker existente, clasp.

## Global Constraints

- Especificação normativa: `docs/superpowers/specs/2026-08-20-permanencia-clientes-design.md`.
- Arquivo real inicial: `/home/elohimlima/Downloads/clientes por permanencia (07_08).xls`.
- Data de referência da carga inicial: `2026-08-07`; revisão: `r01`.
- A fonte real contém 980 IDs únicos; `Total: 980` é rodapé.
- Lotes futuros contêm exatamente `vencimentos`, `fichas`, `avaliacao_fisica` e `permanencia`, todos com a mesma data e revisão.
- `BASE_ALUNOS` continua limitada à população do relatório de vencimentos.
- Alunos históricos nunca são apagados por ausência em lote posterior.
- `cliente_desde` preserva sempre a menor data válida conhecida.
- Status operacional e status de permanência permanecem campos diferentes.
- Nenhum cálculo pode multiplicar tempo de relacionamento por valor de pacote.
- A interface mostra tempo na empresa e pacote/valor atual separadamente.
- Dados pessoais reais não entram no Git, em fixtures, saídas de teste ou logs de CI.
- O lote inteiro restaura as cinco abas gerenciadas se qualquer etapa posterior à gravação falhar.
- O arquivo real será carregado pelo agente executor; o usuário não copiará dados manualmente.
- Preservar os arquivos não relacionados já existentes no worktree: `.vscode/`, `cancelados-geral-tratado.xls` e `docs/FEEDBACKS_E_STATUS_COMERCIAL.md`.
- Executar em worktree isolado criado com `superpowers:using-git-worktrees`; integrar em `main` somente após testes e revisão.

---

## File Map

| Arquivo | Responsabilidade |
|---|---|
| `apps-script/00_Config.gs` | Quarto tipo, novas abas e cabeçalhos |
| `apps-script/02_ParserHtml.gs` | Rodapé `Total: N` |
| `apps-script/03_Permanencia.gs` | Validação, merge histórico, eventos e serialização puros |
| `apps-script/03_Transformacao.gs` | Enriquecimento de `BASE_ALUNOS` e `VISAO_MESTRE` |
| `apps-script/04_PlanilhaRepositorio.gs` | Leitura, escrita, backup e restauração das cinco bases |
| `apps-script/05_DriveRepositorio.gs` | Nomes, lotes de quatro arquivos e leitor reutilizável |
| `apps-script/07_ImportacaoService.gs` | Orquestração da permanência no lote regular |
| `apps-script/20_CargaInicialPermanencia.gs` | Carga inicial isolada e idempotente do arquivo real |
| `apps-script/11_DashboardRepositorio.gs` | Leitura e payload seguro da permanência |
| `apps-script/12_DashboardApi.gs` | Inclusão e validação das novas coleções no bootstrap |
| `pwa/js/permanencia.js` | Tempo, faixas, coortes, retenção e recortes puros |
| `pwa/js/dashboard.js` | Renderização da terceira subaba e seus detalhes |
| `pwa/js/student-profiles.js` | Cliente desde, tempo e pacotes atuais no perfil |
| `pwa/css/permanencia.css` | Layout responsivo específico da subaba |
| `pwa/index.html` | Botão, CSS e script do novo módulo |
| `pwa/sw.js` | Versão e cache dos novos ativos |
| `scripts/validar-dados-reais.js` | Validação local dos quatro relatórios |
| `scripts/validar-permanencia-real.js` | Auditoria sem PII da carga inicial |
| `docs/operacao/LEIA-ME_POP_01_ENTRADA.html` | Procedimento com quatro relatórios |
| `docs/operacao/LEIA-ME_POP_01_ENTRADA.pdf` | PDF regenerado do POP |
| `apps-script/INSTRUCOES_INSTALACAO.md` | Operação e conferência atualizadas |
| `tests/fixtures/permanencia.html` | Fonte sintética sem alunos reais |
| `tests/permanencia-transformacao.test.js` | Merge, eventos, datas e proteções |
| `tests/carga-inicial-permanencia.test.js` | Orquestração isolada da migração |
| `tests/permanencia-pwa.test.js` | Métricas e recortes do módulo cliente |

---

### Task 1: Reconhecer o quarto relatório e o lote de quatro arquivos

**Files:**
- Create: `tests/fixtures/permanencia.html`
- Modify: `tests/parser.test.js`
- Modify: `tests/lote.test.js`
- Modify: `apps-script/00_Config.gs`
- Modify: `apps-script/02_ParserHtml.gs`
- Modify: `apps-script/05_DriveRepositorio.gs`

**Interfaces:**
- Consumes: `parseTabelaHtml`, `tabelaParaObjetos`, `parseNomeArquivo`, `agruparLote`.
- Produces: tipo `permanencia`, `CABECALHOS_ORIGEM.permanencia` e `lerTabelaArquivo_(entrada, tipo)` usados nas Tasks 4 e 5.

- [ ] **Step 1: Criar fixture sintética e testes falhando**

Criar `tests/fixtures/permanencia.html`:

```html
<table>
  <tr><th>Código</th><th>Cliente</th><th>Cliente desde</th><th>Status atual</th><th>Continuidade (meses)</th><th>Contratos</th></tr>
  <tr><td>100</td><td>ALUNO TESTE A</td><td>10/01/2024</td><td>Ativo</td><td>31</td><td>3</td></tr>
  <tr><td>101</td><td>ALUNO TESTE B</td><td>15/05/2025</td><td>Cancelado</td><td>12</td><td>1</td></tr>
  <tr><td>Total: 2</td></tr>
</table>
```

Acrescentar a `tests/parser.test.js`:

```js
test('interpreta permanência e ignora rodapé Total sem a palavra registros', () => {
  const html = fs.readFileSync('tests/fixtures/permanencia.html', 'utf8');
  const objects = gas.tabelaParaObjetos(gas.parseTabelaHtml(html), [
    'codigo', 'cliente', 'cliente desde', 'status atual', 'continuidade (meses)', 'contratos'
  ]);
  assert.equal(objects.length, 2);
  assert.equal(objects[0]['cliente desde'], '10/01/2024');
  assert.equal(objects.some(row => row.codigo.startsWith('Total:')), false);
});
```

Em `tests/lote.test.js`, criar o helper e substituir os lotes válidos de três itens pelo helper:

```js
function loteValido(data = '2026-08-21', revisao = '01') {
  return [
    file(`vencimentos_${data}_r${revisao}.xls`),
    file(`fichas_${data}_r${revisao}.xls`),
    file(`avaliacao_fisica_${data}_r${revisao}.xls`),
    file(`permanencia_${data}_r${revisao}.xls`)
  ];
}

test('exige exatamente os quatro tipos', () => {
  assert.equal(gas.agruparLote(loteValido()).arquivos.length, 4);
  assert.throws(() => gas.agruparLote(loteValido().slice(0, 3)), /Lote incompleto.*permanencia/);
});
```

- [ ] **Step 2: Executar os testes e confirmar a falha correta**

Run: `node --test tests/parser.test.js tests/lote.test.js`

Expected: FAIL porque `Total: 2` ainda é interpretado como registro, `permanencia` não é aceito no nome e o lote ainda exige três tipos.

- [ ] **Step 3: Implementar o contrato do quarto arquivo**

Em `apps-script/00_Config.gs`:

```js
tiposObrigatorios: Object.freeze(['vencimentos', 'fichas', 'avaliacao_fisica', 'permanencia']),
```

e:

```js
permanencia: Object.freeze([
  'codigo', 'cliente', 'cliente desde', 'status atual', 'continuidade (meses)', 'contratos'
])
```

Em `apps-script/02_ParserHtml.gs`, substituir o filtro final por:

```js
.filter(function (objeto) {
  var codigo = String(objeto.codigo || '').trim();
  return !/^Total:\s*\d+(?:\s+registros?)?$/i.test(codigo) &&
    !/^Total\s+R\$/i.test(codigo);
});
```

Em `apps-script/05_DriveRepositorio.gs`, ampliar o nome:

```js
var match = /^(vencimentos|fichas|avaliacao_fisica|permanencia)_(\d{4})[-_](\d{2})[-_](\d{2})_r(\d{2})\.(xls|xlsx)$/i.exec(texto);
```

Extrair a leitura de um arquivo para:

```js
function lerTabelaArquivo_(entrada, tipo) {
  var blob = entrada.arquivo.getBlob();
  var formato = detectarFormatoArquivo(blob);
  var linhasBrutas;
  if (formato.formato === 'xlsx') {
    linhasBrutas = parseTabelaXlsx(blob);
  } else {
    var html = blob.getDataAsString('UTF-8');
    if (!/<table\b/i.test(html)) {
      throw new Error('Formato de arquivo inválido: esperado XLS HTML ou XLSX.');
    }
    linhasBrutas = parseTabelaHtml(html);
  }
  return {
    linhas: tabelaParaObjetos(linhasBrutas, CABECALHOS_ORIGEM[tipo]),
    extensaoCanonica: formato.extensaoCanonica
  };
}
```

Fazer `lerTabelasDoLote` chamar esse helper para cada item de `CONFIG.tiposObrigatorios`, mantendo a contagem e o nome canônico.

- [ ] **Step 4: Atualizar os casos XLS/XLSX existentes para quatro arquivos**

Nos testes que montam um lote para `lerTabelasDoLote`, acrescentar:

```js
{
  nome: 'permanencia_2026-07-25_r01.xls',
  arquivo: arquivo(htmlBlob(tabelaHtml(
    ['Código', 'Cliente', 'Cliente desde', 'Status atual', 'Continuidade (meses)', 'Contratos'],
    ['101', 'ALUNO TESTE', '01/01/2024', 'Ativo', '30', '3']
  )))
}
```

- [ ] **Step 5: Executar testes e commit**

Run: `node --test tests/parser.test.js tests/lote.test.js`

Expected: PASS.

```bash
git add apps-script/00_Config.gs apps-script/02_ParserHtml.gs apps-script/05_DriveRepositorio.gs tests/fixtures/permanencia.html tests/parser.test.js tests/lote.test.js
git commit -m "feat: accept permanence report in import batches"
```

---

### Task 2: Consolidar permanência e eventos históricos de forma pura

**Files:**
- Create: `apps-script/03_Permanencia.gs`
- Create: `tests/permanencia-transformacao.test.js`

**Interfaces:**
- Consumes: objetos normalizados por `tabelaParaObjetos`, `normalizarId`, `parseDataBr`, `formatarDataIso`.
- Produces: `construirAtualizacaoPermanencia_(linhas, baseAnterior, historicoAnterior, contexto)` retornando `{ base, historico, porId, avisos, resumo }`.

- [ ] **Step 1: Escrever testes das invariantes históricas**

Criar `tests/permanencia-transformacao.test.js` com carga dos módulos e os testes centrais:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas([
  'apps-script/01_Normalizacao.gs',
  'apps-script/03_Permanencia.gs'
]);

function source(id, date, status = 'Ativo', contracts = '1') {
  return {
    codigo: id,
    cliente: `ALUNO ${id}`,
    'cliente desde': date,
    'status atual': status,
    'continuidade (meses)': '12',
    contratos: contracts
  };
}

function context(overrides = {}) {
  return {
    dataReferencia: '2026-08-21', revisao: '01', importacaoId: 'exec-1',
    registradoEm: new Date(2026, 7, 21, 12), cargaInicial: false,
    ...overrides
  };
}

test('carga inicial cria estado e evento por ID', () => {
  const result = gas.construirAtualizacaoPermanencia_(
    [source('100', '10/01/2024'), source('101', '15/05/2025', 'Cancelado')],
    [], [], context({ cargaInicial: true })
  );
  assert.equal(result.base.length, 2);
  assert.deepEqual(result.historico.map(item => item.tipo_evento), ['CARGA_INICIAL', 'CARGA_INICIAL']);
});

test('preserva data menor, registra correção anterior e não aceita data posterior', () => {
  const previous = [{
    id: '100', aluno: 'ALUNO 100', cliente_desde: new Date(2024, 0, 10, 12),
    status_permanencia: 'Ativo', continuidade_meses_origem: 12,
    quantidade_contratos_origem: 1, primeira_observacao_em: '2026-08-07',
    ultima_observacao_em: '2026-08-07', presente_ultimo_lote: true, importacao_id: 'old'
  }];
  const later = gas.construirAtualizacaoPermanencia_(
    [source('100', '10/03/2024')], previous, [], context()
  );
  assert.equal(gas.formatarDataIso(later.base[0].cliente_desde), '2024-01-10');
  assert.match(later.avisos.join(' | '), /data posterior preservada/);

  const earlier = gas.construirAtualizacaoPermanencia_(
    [source('100', '10/12/2023')], previous, [], context({ revisao: '02' })
  );
  assert.equal(gas.formatarDataIso(earlier.base[0].cliente_desde), '2023-12-10');
  assert.equal(earlier.historico[0].tipo_evento, 'CORRECAO_CLIENTE_DESDE');
});

test('marca ausência sem apagar e registra reaparecimento', () => {
  const first = gas.construirAtualizacaoPermanencia_(
    [source('100', '10/01/2024')], [], [], context({ cargaInicial: true })
  );
  const missing = gas.construirAtualizacaoPermanencia_(
    [], first.base, first.historico, context({ revisao: '02', permitirLoteVazioEmTeste: true })
  );
  assert.equal(missing.base[0].presente_ultimo_lote, false);
  assert.equal(missing.historico.at(-1).tipo_evento, 'AUSENTE_NO_LOTE');
  const returned = gas.construirAtualizacaoPermanencia_(
    [source('100', '10/01/2024')], missing.base, missing.historico,
    context({ revisao: '03' })
  );
  assert.equal(returned.historico.at(-1).tipo_evento, 'REAPARECIMENTO');
});

test('bloqueia duplicidade, queda superior a vinte por cento e filtro apenas de ativos', () => {
  assert.throws(
    () => gas.construirAtualizacaoPermanencia_([source('100', '10/01/2024'), source('100', '10/01/2024')], [], [], context()),
    /Código duplicado/
  );
  const previous = Array.from({ length: 10 }, (_, index) => ({
    id: String(index + 1), aluno: `ALUNO ${index + 1}`, cliente_desde: new Date(2024, 0, 1, 12),
    status_permanencia: index === 0 ? 'Cancelado' : 'Ativo', presente_ultimo_lote: true
  }));
  assert.throws(
    () => gas.construirAtualizacaoPermanencia_(previous.slice(0, 7).map(item => source(item.id, '01/01/2024')), previous, [], context()),
    /redução superior a 20%/
  );
  assert.throws(
    () => gas.construirAtualizacaoPermanencia_(previous.map(item => source(item.id, '01/01/2024', 'Ativo')), previous, [], context()),
    /somente ativos/
  );
});
```

- [ ] **Step 2: Rodar o teste para verificar ausência do módulo**

Run: `node --test tests/permanencia-transformacao.test.js`

Expected: FAIL com arquivo ou função `construirAtualizacaoPermanencia_` ausente.

- [ ] **Step 3: Implementar helpers e contrato do módulo**

Criar `apps-script/03_Permanencia.gs` com estas funções e nomes estáveis:

```js
function statusMatriculadoPermanencia_(valor) {
  var status = String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
  return ['ativo', 'bloqueado', 'licenca', 'em licenca'].indexOf(status) !== -1;
}

function inteiroNaoNegativoPermanencia_(valor, campo, id) {
  var texto = String(valor == null ? '' : valor).trim();
  if (!/^\d+$/.test(texto)) throw new Error(campo + ' inválido para o ID ' + id + '.');
  return Number(texto);
}

function eventoIdPermanencia_(contexto, id, tipo, campo) {
  return [contexto.dataReferencia, 'r' + contexto.revisao, id, tipo, campo || 'geral'].join('|');
}

function criarEventoPermanencia_(contexto, id, tipo, campo, anterior, novo) {
  return {
    evento_id: eventoIdPermanencia_(contexto, id, tipo, campo),
    id: id,
    data_referencia: contexto.dataReferencia,
    tipo_evento: tipo,
    campo: campo || '',
    valor_anterior: anterior == null ? '' : anterior,
    valor_novo: novo == null ? '' : novo,
    importacao_id: contexto.importacaoId,
    registrado_em: contexto.registradoEm
  };
}

function objetosPorIdPermanencia_(linhas) {
  return (linhas || []).reduce(function (mapa, linha) {
    mapa[String(linha.id || '')] = Object.assign({}, linha);
    return mapa;
  }, Object.create(null));
}

function serializarObjetosPermanencia_(objetos, cabecalhos) {
  return (objetos || []).map(function (objeto) {
    return cabecalhos.map(function (cabecalho) { return objeto[cabecalho]; });
  });
}
```

Implementar o corpo determinístico abaixo. O parse de data captura erro por linha, mantém a data anterior e acrescenta aviso; IDs novos com data inválida permanecem sem `cliente_desde` para aparecerem na cobertura incompleta.

```js
function construirAtualizacaoPermanencia_(linhas, baseAnterior, historicoAnterior, contexto) {
  linhas = linhas || [];
  baseAnterior = baseAnterior || [];
  historicoAnterior = historicoAnterior || [];
  var avisos = [];
  var fontes = [];
  var idsFonte = Object.create(null);

  linhas.forEach(function (linha) {
    var id = normalizarId(linha.codigo);
    if (!id) throw new Error('Código vazio no relatório de permanência.');
    if (idsFonte[id]) throw new Error('Código duplicado na permanência: ' + id);
    idsFonte[id] = true;
    var clienteDesde = '';
    try {
      clienteDesde = parseDataBr(linha['cliente desde']);
    } catch (erroData) {
      avisos.push('ID ' + id + ': data inválida; valor anterior preservado.');
    }
    fontes.push({
      id: id,
      aluno: String(linha.cliente || '').trim(),
      clienteDesde: clienteDesde,
      status: String(linha['status atual'] || '').trim(),
      continuidade: inteiroNaoNegativoPermanencia_(linha['continuidade (meses)'], 'Continuidade', id),
      contratos: inteiroNaoNegativoPermanencia_(linha.contratos, 'Contratos', id)
    });
  });

  if (baseAnterior.length && !contexto.permitirLoteVazioEmTeste) {
    if (fontes.length < Math.ceil(baseAnterior.length * 0.8)) {
      throw new Error('Relatório de permanência com redução superior a 20%.');
    }
    var possuiaHistorico = baseAnterior.some(function (item) {
      return !statusMatriculadoPermanencia_(item.status_permanencia);
    });
    if (possuiaHistorico && fontes.length && fontes.every(function (item) {
      return statusMatriculadoPermanencia_(item.status);
    })) {
      throw new Error('Relatório de permanência contém somente ativos/matriculados.');
    }
  }

  var basePorId = objetosPorIdPermanencia_(baseAnterior);
  var eventos = historicoAnterior.map(function (item) { return Object.assign({}, item); });
  var eventosPorId = eventos.reduce(function (mapa, evento) {
    mapa[String(evento.evento_id || '')] = true;
    return mapa;
  }, Object.create(null));

  function adicionarEvento(id, tipo, campo, anterior, novo) {
    var evento = criarEventoPermanencia_(contexto, id, tipo, campo, anterior, novo);
    if (!eventosPorId[evento.evento_id]) {
      eventos.push(evento);
      eventosPorId[evento.evento_id] = true;
    }
  }

  fontes.forEach(function (fonte) {
    var anterior = basePorId[fonte.id] || null;
    var dataAnterior = anterior && anterior.cliente_desde ? parseDataBr(anterior.cliente_desde) : '';
    var dataFinal = dataAnterior || fonte.clienteDesde || '';
    if (fonte.clienteDesde && dataAnterior) {
      if (fonte.clienteDesde.getTime() < dataAnterior.getTime()) {
        dataFinal = fonte.clienteDesde;
        adicionarEvento(
          fonte.id, 'CORRECAO_CLIENTE_DESDE', 'cliente_desde',
          formatarDataIso(dataAnterior), formatarDataIso(fonte.clienteDesde)
        );
      } else if (fonte.clienteDesde.getTime() > dataAnterior.getTime()) {
        avisos.push('ID ' + fonte.id + ': data posterior preservada sem substituir a primeira entrada.');
      }
    }

    if (!anterior) {
      adicionarEvento(
        fonte.id, contexto.cargaInicial ? 'CARGA_INICIAL' : 'NOVO_ALUNO', '', '', ''
      );
    } else {
      if (String(anterior.status_permanencia || '') !== fonte.status) {
        adicionarEvento(
          fonte.id, 'ALTERACAO_STATUS', 'status_permanencia',
          anterior.status_permanencia, fonte.status
        );
      }
      if (Number(anterior.continuidade_meses_origem) !== fonte.continuidade) {
        adicionarEvento(
          fonte.id, 'ALTERACAO_CONTINUIDADE', 'continuidade_meses_origem',
          anterior.continuidade_meses_origem, fonte.continuidade
        );
      }
      if (Number(anterior.quantidade_contratos_origem) !== fonte.contratos) {
        adicionarEvento(
          fonte.id, 'ALTERACAO_CONTRATOS', 'quantidade_contratos_origem',
          anterior.quantidade_contratos_origem, fonte.contratos
        );
      }
      if (anterior.presente_ultimo_lote === false || String(anterior.presente_ultimo_lote).toLowerCase() === 'false') {
        adicionarEvento(fonte.id, 'REAPARECIMENTO', 'presente_ultimo_lote', false, true);
      }
    }

    basePorId[fonte.id] = {
      id: fonte.id,
      aluno: fonte.aluno || (anterior ? anterior.aluno : ''),
      cliente_desde: dataFinal,
      status_permanencia: fonte.status,
      continuidade_meses_origem: fonte.continuidade,
      quantidade_contratos_origem: fonte.contratos,
      primeira_observacao_em: anterior ? anterior.primeira_observacao_em : contexto.dataReferencia,
      ultima_observacao_em: contexto.dataReferencia,
      presente_ultimo_lote: true,
      importacao_id: contexto.importacaoId
    };
  });

  Object.keys(basePorId).forEach(function (id) {
    if (idsFonte[id]) return;
    var anterior = basePorId[id];
    if (anterior.presente_ultimo_lote === true || String(anterior.presente_ultimo_lote).toLowerCase() === 'true') {
      adicionarEvento(id, 'AUSENTE_NO_LOTE', 'presente_ultimo_lote', true, false);
    }
    basePorId[id] = Object.assign({}, anterior, { presente_ultimo_lote: false });
  });

  var base = Object.keys(basePorId).sort(function (a, b) {
    return Number(a) - Number(b);
  }).map(function (id) { return basePorId[id]; });
  eventos.sort(function (a, b) {
    return String(a.data_referencia).localeCompare(String(b.data_referencia)) ||
      Number(a.id) - Number(b.id) ||
      String(a.tipo_evento).localeCompare(String(b.tipo_evento));
  });
  return {
    base: base,
    historico: eventos,
    porId: objetosPorIdPermanencia_(base),
    avisos: avisos,
    resumo: { recebidos: fontes.length, conhecidos: base.length, eventos: eventos.length }
  };
}
```

- [ ] **Step 4: Executar teste, corrigir apenas a implementação e commit**

Run: `node --test tests/permanencia-transformacao.test.js`

Expected: PASS.

```bash
git add apps-script/03_Permanencia.gs tests/permanencia-transformacao.test.js
git commit -m "feat: preserve permanence state and change history"
```

---

### Task 3: Persistir e restaurar as duas novas abas

**Files:**
- Modify: `apps-script/00_Config.gs`
- Modify: `apps-script/04_PlanilhaRepositorio.gs`
- Modify: `tests/planilha-repositorio.test.js`

**Interfaces:**
- Consumes: objetos produzidos por `construirAtualizacaoPermanencia_`.
- Produces: `lerEstadoPermanencia_()`, `lerDadosOperacionaisAtuais_()` e suporte às chaves `basePermanencia` e `historicoPermanencia` em substituir/backup/restaurar.

- [ ] **Step 1: Estender mocks e escrever testes falhando**

Adicionar `BASE_PERMANENCIA` e `HISTORICO_PERMANENCIA` a `createSpreadsheet()` e testar:

```js
test('substitui e restaura as cinco abas gerenciadas', () => {
  const spreadsheet = createSpreadsheet();
  const gas = load(spreadsheet);
  const backup = gas.criarBackupAbasGerenciadas();
  gas.substituirAbasGerenciadas({
    alunos: [['1', 'A', '', 'Ativo', new Date(2024, 0, 1), '', '', 'exec']],
    contratos: [],
    visaoMestre: [],
    basePermanencia: [{
      id: '1', aluno: 'A', cliente_desde: new Date(2024, 0, 1), status_permanencia: 'Ativo',
      continuidade_meses_origem: 30, quantidade_contratos_origem: 3,
      primeira_observacao_em: '2026-08-07', ultima_observacao_em: '2026-08-07',
      presente_ultimo_lote: true, importacao_id: 'exec'
    }],
    historicoPermanencia: [{
      evento_id: 'e1', id: '1', data_referencia: '2026-08-07', tipo_evento: 'CARGA_INICIAL',
      campo: '', valor_anterior: '', valor_novo: '', importacao_id: 'exec', registrado_em: new Date()
    }]
  });
  assert.ok(spreadsheet.sheets.BASE_PERMANENCIA.calls.some(call => call[0] === 'clear'));
  assert.ok(spreadsheet.sheets.HISTORICO_PERMANENCIA.calls.some(call => call[0] === 'clear'));
  gas.restaurarBackupAbasGerenciadas(backup);
  assert.equal(spreadsheet.sheets.BASE_PERMANENCIA.calls.at(-1)[0], 'setValues');
});
```

- [ ] **Step 2: Executar e confirmar falha por configuração ausente**

Run: `node --test tests/planilha-repositorio.test.js`

Expected: FAIL porque as novas abas e larguras não existem.

- [ ] **Step 3: Definir abas e cabeçalhos**

Em `CONFIG.abas`:

```js
basePermanencia: 'BASE_PERMANENCIA',
historicoPermanencia: 'HISTORICO_PERMANENCIA',
```

Em `CONFIG.cabecalhos`:

```js
basePermanencia: Object.freeze([
  'id', 'aluno', 'cliente_desde', 'status_permanencia', 'continuidade_meses_origem',
  'quantidade_contratos_origem', 'primeira_observacao_em', 'ultima_observacao_em',
  'presente_ultimo_lote', 'importacao_id'
]),
historicoPermanencia: Object.freeze([
  'evento_id', 'id', 'data_referencia', 'tipo_evento', 'campo', 'valor_anterior',
  'valor_novo', 'importacao_id', 'registrado_em'
]),
```

- [ ] **Step 4: Generalizar persistência sem alterar abas manuais**

Adicionar:

```js
var CHAVES_ABAS_GERENCIADAS = Object.freeze([
  'alunos', 'contratos', 'visaoMestre', 'basePermanencia', 'historicoPermanencia'
]);

function lerObjetosAbaGerenciada_(chave) {
  var planilha = obterPlanilhaMestre_();
  var aba = planilha.getSheetByName(CONFIG.abas[chave]);
  var cabecalhos = CONFIG.cabecalhos[chave];
  if (!aba || aba.getLastRow() < 1) throw new Error('Aba gerenciada ausente: ' + chave);
  var valores = aba.getRange(1, 1, aba.getLastRow(), cabecalhos.length).getValues();
  cabecalhos.forEach(function (cabecalho, indice) {
    if (String(valores[0][indice]) !== cabecalho) throw new Error('Estrutura incompatível: ' + chave);
  });
  return valores.slice(1).filter(function (linha) {
    return linha.some(function (valor) { return valor !== '' && valor != null; });
  }).map(function (linha) {
    return cabecalhos.reduce(function (objeto, cabecalho, indice) {
      objeto[cabecalho] = linha[indice];
      return objeto;
    }, {});
  });
}

function lerEstadoPermanencia_() {
  return {
    base: lerObjetosAbaGerenciada_('basePermanencia'),
    historico: lerObjetosAbaGerenciada_('historicoPermanencia')
  };
}
```

Fazer `substituirAbasGerenciadas` serializar objetos com `serializarObjetosPermanencia_`, validar as cinco larguras antes de qualquer `clearContents`, escrever as cinco abas e formatar `cliente_desde`, datas de referência e `registrado_em`.

Fazer backup e restauração iterarem exclusivamente por `CHAVES_ABAS_GERENCIADAS`; não incluir Configurações, Fluxo ou Perfis.

- [ ] **Step 5: Rodar testes e commit**

Run: `node --test tests/planilha-repositorio.test.js tests/permanencia-transformacao.test.js`

Expected: PASS.

```bash
git add apps-script/00_Config.gs apps-script/04_PlanilhaRepositorio.gs tests/planilha-repositorio.test.js
git commit -m "feat: persist permanence state transactionally"
```

---

### Task 4: Integrar permanência ao lote regular e às bases operacionais

**Files:**
- Modify: `apps-script/03_Transformacao.gs`
- Modify: `apps-script/07_ImportacaoService.gs`
- Modify: `tests/transformacao.test.js`
- Modify: `tests/service.test.js`
- Modify: `tests/log-importacoes.test.js`

**Interfaces:**
- Consumes: `tabelas.permanencia`, `lerEstadoPermanencia_`, `construirAtualizacaoPermanencia_`.
- Produces: `construirDadosMestre(vencimentos, fichas, avaliacoes, permanenciaPorId, importacaoId)` e resultado completo para `substituirAbasGerenciadas`.

- [ ] **Step 1: Escrever testes de enriquecimento e ordem transacional**

Em `tests/transformacao.test.js`, passar um mapa de permanência ao builder e verificar os índices existentes:

```js
test('preenche inicio_plano e visão mestre pela permanência sem mudar a população', () => {
  const permanencia = {
    '100': { cliente_desde: new Date(2024, 0, 10, 12) }
  };
  const result = gas.construirDadosMestre(
    parseFixture('vencimentos.html', ['codigo', 'cliente', 'status cliente', 'contrato', 'valor', 'inicio', 'vencimento', 'status contrato', 'modalidade']),
    parseFixture('fichas.html', ['codigo', 'data inicio', 'contato']),
    parseFixture('avaliacao_fisica.html', ['codigo', 'data da avaliacao']),
    permanencia,
    'exec-001'
  );
  assert.equal(result.alunos.length, 2);
  assert.equal(gas.formatarDataIso(result.alunos.find(row => row[0] === '100')[4]), '2024-01-10');
  assert.equal(gas.formatarDataIso(result.visaoMestre.find(row => row[0] === '100')[6]), '2024-01-10');
});
```

Em `tests/service.test.js`, adicionar `permanencia` ao retorno de `lerTabelas`, dependências `lerEstadoPermanencia` e `transformarPermanencia`, e esperar a ordem:

```js
[
  'check', 'log-start', 'read-permanence-state', 'transform-permanence',
  'backup', 'replace', 'processed', 'version', 'log-SUCESSO', 'release'
]
```

Também alterar o teste do POP para esperar quatro arquivos após o filtro.

- [ ] **Step 2: Executar testes e confirmar falhas de assinatura**

Run: `node --test tests/transformacao.test.js tests/service.test.js tests/log-importacoes.test.js`

Expected: FAIL porque o builder ainda recebe três fontes e o serviço não lê o estado anterior.

- [ ] **Step 3: Enriquecer os arrays existentes**

Alterar a assinatura:

```js
function construirDadosMestre(vencimentos, fichas, avaliacoes, permanenciaPorId, importacaoId) {
```

Na criação de cada aluno:

```js
var permanencia = permanenciaPorId[id] || null;
var clienteDesde = permanencia && permanencia.cliente_desde
  ? parseDataBr(permanencia.cliente_desde)
  : '';
alunosPorId[id] = [
  id,
  String(cadastro.cliente || '').trim(),
  ficha ? String(ficha.contato || '').trim() : '',
  String(cadastro['status cliente'] || '').trim(),
  clienteDesde,
  ficha ? parseDataBr(ficha['data inicio']) : '',
  avaliacao ? parseDataBr(avaliacao['data da avaliacao']) : '',
  importacaoId
];
```

O mapeamento de `visaoMestre` já usa `aluno[4]` na coluna `inicio_plano`; manter esse índice.

Atualizar todas as chamadas existentes em `tests/transformacao.test.js`: passar `{}` como quarto argumento quando o caso não usa permanência e mover `importacaoId` para o quinto argumento. Fazer a mesma atualização em `scripts/validar-dados-reais.js` na Task 10.

- [ ] **Step 4: Orquestrar o estado e anexar as duas novas tabelas**

No serviço, antes do backup:

```js
var estadoPermanencia = deps.lerEstadoPermanencia();
var atualizacaoPermanencia = deps.transformarPermanencia(
  tabelas.permanencia,
  estadoPermanencia.base,
  estadoPermanencia.historico,
  {
    dataReferencia: lote.dataReferencia,
    revisao: lote.revisao,
    importacaoId: execucaoId,
    registradoEm: deps.agora(),
    cargaInicial: estadoPermanencia.base.length === 0
  }
);
var dados = deps.transformar(
  tabelas.vencimentos,
  tabelas.fichas,
  tabelas.avaliacao_fisica,
  atualizacaoPermanencia.porId,
  execucaoId
);
dados.basePermanencia = atualizacaoPermanencia.base;
dados.historicoPermanencia = atualizacaoPermanencia.historico;
dados.avisos = dados.avisos.concat(atualizacaoPermanencia.avisos);
```

Em `criarDependenciasImportacao_`, ligar:

```js
lerEstadoPermanencia: lerEstadoPermanencia_,
transformarPermanencia: construirAtualizacaoPermanencia_,
agora: function () { return new Date(); },
```

O retorno de sucesso deve acrescentar:

```js
permanencia: dados.basePermanencia.length,
eventosPermanencia: dados.historicoPermanencia.length
```

- [ ] **Step 5: Rodar testes do fluxo e commit**

Run: `node --test tests/transformacao.test.js tests/service.test.js tests/log-importacoes.test.js tests/lote.test.js`

Expected: PASS.

```bash
git add apps-script/03_Transformacao.gs apps-script/07_ImportacaoService.gs tests/transformacao.test.js tests/service.test.js tests/log-importacoes.test.js
git commit -m "feat: enrich operational base with customer start dates"
```

---

### Task 5: Criar carga inicial isolada e idempotente

**Files:**
- Create: `apps-script/20_CargaInicialPermanencia.gs`
- Create: `tests/carga-inicial-permanencia.test.js`
- Modify: `apps-script/04_PlanilhaRepositorio.gs`
- Modify: `apps-script/05_DriveRepositorio.gs`

**Interfaces:**
- Consumes: um único arquivo `permanencia_2026-08-07_r01.xls` em `01_ENTRADA` e as bases atuais.
- Produces: `executarCargaInicialPermanencia()`; não é exposto em `doPost` nem no menu público.

- [ ] **Step 1: Escrever teste do orquestrador de migração**

Criar dependências puras e verificar que a carga não exige os outros relatórios:

```js
test('carga inicial lê um único arquivo, grava, arquiva e versiona', () => {
  const calls = [];
  const result = gas.executarCargaInicialPermanenciaComDependencias_({
    adquirirLock: () => ({ releaseLock: () => calls.push('release') }),
    gerarExecucaoId: () => 'initial-1',
    localizarArquivo: () => ({ id: 'drive-1', nome: 'permanencia_2026-08-07_r01.xls' }),
    lerArquivo: () => [{
      codigo: '100', cliente: 'ALUNO TESTE', 'cliente desde': '10/01/2024',
      'status atual': 'Ativo', 'continuidade (meses)': '30', contratos: '3'
    }],
    lerEstado: () => ({ base: [], historico: [] }),
    lerOperacional: () => ({
      alunos: [['100', 'ALUNO TESTE', '', 'Ativo', '', '', '', 'old']],
      contratos: [],
      visaoMestre: [['100', 'ALUNO TESTE', '', 'Ativo', '2X', 500, '', '', '', 'POLO', '', '', 'c1']]
    }),
    transformarPermanencia: gas.construirAtualizacaoPermanencia_,
    enriquecerOperacional: gas.enriquecerDadosOperacionaisComPermanencia_,
    backup: () => { calls.push('backup'); return {}; },
    substituir: dados => { calls.push('replace'); assert.equal(dados.basePermanencia.length, 1); },
    moverProcessado: () => calls.push('processed'),
    incrementarVersao: () => calls.push('version'),
    registrarSucesso: () => calls.push('log'),
    agora: () => new Date(2026, 7, 20, 12)
  });
  assert.equal(result.registros, 1);
  assert.deepEqual(calls, ['backup', 'replace', 'processed', 'version', 'log', 'release']);
});
```

Adicionar testes de base já carregada, arquivo ausente e restauração após falha de arquivamento.

- [ ] **Step 2: Executar e confirmar função ausente**

Run: `node --test tests/carga-inicial-permanencia.test.js`

Expected: FAIL com `executarCargaInicialPermanenciaComDependencias_ is not a function`.

- [ ] **Step 3: Implementar enriquecimento de linhas existentes**

Em `apps-script/03_Transformacao.gs`:

```js
function enriquecerDadosOperacionaisComPermanencia_(dados, permanenciaPorId) {
  var alunos = (dados.alunos || []).map(function (linha) {
    var copia = linha.slice();
    var item = permanenciaPorId[String(copia[0])] || null;
    copia[4] = item && item.cliente_desde ? item.cliente_desde : copia[4];
    return copia;
  });
  var visaoMestre = (dados.visaoMestre || []).map(function (linha) {
    var copia = linha.slice();
    var item = permanenciaPorId[String(copia[0])] || null;
    copia[6] = item && item.cliente_desde ? item.cliente_desde : copia[6];
    return copia;
  });
  return {
    alunos: alunos,
    contratos: (dados.contratos || []).map(function (linha) { return linha.slice(); }),
    visaoMestre: visaoMestre
  };
}
```

Em `apps-script/04_PlanilhaRepositorio.gs`, adicionar `lerDadosOperacionaisAtuais_()` que lê as três abas como arrays na ordem dos cabeçalhos.

- [ ] **Step 4: Implementar o orquestrador com rollback**

`executarCargaInicialPermanenciaComDependencias_` deve:

1. adquirir lock;
2. exigir `estado.base.length === 0`;
3. localizar apenas o nome canônico ou `clientes por permanencia (07_08).xls`;
4. ler com `lerTabelaArquivo_` e tipo `permanencia`;
5. construir contexto fixo `2026-08-07`, revisão `01`, `cargaInicial: true`;
6. enriquecer as linhas operacionais existentes;
7. criar backup das cinco abas;
8. substituir as cinco bases;
9. mover o arquivo para `02_PROCESSADOS/2026/2026-08-07` com nome canônico;
10. incrementar versão e registrar uma linha `SUCESSO` em `IMPORTACOES`;
11. restaurar o backup e mover para rejeitados se ocorrer falha após a substituição;
12. liberar o lock em `finally`.

A função pública será somente:

```js
function executarCargaInicialPermanencia() {
  garantirEstruturaPlanilha();
  return executarCargaInicialPermanenciaComDependencias_(criarDependenciasCargaInicialPermanencia_());
}
```

Não adicionar essa função a `executarApiDashboard`, `doPost` ou `onOpen`.

- [ ] **Step 5: Rodar testes e commit**

Run: `node --test tests/carga-inicial-permanencia.test.js tests/planilha-repositorio.test.js tests/service.test.js`

Expected: PASS.

```bash
git add apps-script/03_Transformacao.gs apps-script/04_PlanilhaRepositorio.gs apps-script/05_DriveRepositorio.gs apps-script/20_CargaInicialPermanencia.gs tests/carga-inicial-permanencia.test.js
git commit -m "feat: add one-time permanence baseline migration"
```

---

### Task 6: Expor permanência com segurança no bootstrap

**Files:**
- Modify: `apps-script/11_DashboardRepositorio.gs`
- Modify: `apps-script/12_DashboardApi.gs`
- Modify: `tests/dashboard-api.test.js`
- Modify: `tests/dashboard-public-web-api.test.js`

**Interfaces:**
- Consumes: `BASE_PERMANENCIA` e `HISTORICO_PERMANENCIA` validadas por cabeçalho.
- Produces: `bootstrap.permanencia` e `bootstrap.eventosPermanencia`.

- [ ] **Step 1: Escrever teste do payload e da validação de cache**

No fixture de planilha de `tests/dashboard-api.test.js`, adicionar as duas abas e testar:

```js
test('bootstrap expõe permanência sem valores históricos ou contato', () => {
  const resultado = gas.obterBootstrapDashboard();
  assert.deepEqual(Object.keys(resultado.permanencia[0]).sort(), [
    'aluno', 'clienteDesde', 'continuidadeMeses', 'id', 'presenteUltimoLote',
    'quantidadeContratos', 'status'
  ]);
  assert.deepEqual(Object.keys(resultado.eventosPermanencia[0]).sort(), [
    'dataReferencia', 'id', 'tipo'
  ]);
  assert.equal('valorAnterior' in resultado.eventosPermanencia[0], false);
  assert.equal('contato' in resultado.permanencia[0], false);
});
```

Para não repetir abas vazias em dezenas de casos, ampliar `carregarComPlanilha` com estes fallbacks, do mesmo modo que o teste já faz para Fluxo:

```js
const permanencia = {
  BASE_PERMANENCIA: criarAba([Array.from(config.cabecalhos.basePermanencia)]),
  HISTORICO_PERMANENCIA: criarAba([Array.from(config.cabecalhos.historicoPermanencia)])
};
```

e resolver a aba por `planilha.getSheetByName(nome) || fluxo[nome] || permanencia[nome] || null`. Nos casos que testam conteúdo real da nova coleção, declarar as duas abas no próprio objeto `abas` para que tenham precedência sobre o fallback.

Atualizar o teste de cache inválido para demonstrar que a ausência das duas coleções força releitura.

- [ ] **Step 2: Rodar e confirmar falha por coleções ausentes**

Run: `node --test tests/dashboard-api.test.js tests/dashboard-public-web-api.test.js`

Expected: FAIL porque o bootstrap não contém permanência.

- [ ] **Step 3: Ler e sanitizar as novas abas**

Em `lerBaseDashboard_` acrescentar:

```js
permanencia: lerTabelaDashboardDaPlanilha_(
  planilha, CONFIG.abas.basePermanencia, CONFIG.cabecalhos.basePermanencia
),
eventosPermanencia: lerTabelaDashboardDaPlanilha_(
  planilha, CONFIG.abas.historicoPermanencia, CONFIG.cabecalhos.historicoPermanencia
),
```

Adicionar mapeadores:

```js
function permanenciaSeguraParaDashboard_(item) {
  return {
    id: String(item.id || ''),
    aluno: String(item.aluno || ''),
    clienteDesde: formatarDataDashboard_(item.cliente_desde),
    status: String(item.status_permanencia || ''),
    continuidadeMeses: Number(item.continuidade_meses_origem) || 0,
    quantidadeContratos: Number(item.quantidade_contratos_origem) || 0,
    presenteUltimoLote: item.presente_ultimo_lote === true || String(item.presente_ultimo_lote).toLowerCase() === 'true'
  };
}

function eventoPermanenciaSeguroParaDashboard_(item) {
  return {
    id: String(item.id || ''),
    dataReferencia: formatarDataDashboard_(item.data_referencia),
    tipo: String(item.tipo_evento || '')
  };
}
```

Em `montarBootstrapDashboard_`:

```js
permanencia: base.permanencia.map(permanenciaSeguraParaDashboard_),
eventosPermanencia: base.eventosPermanencia.map(eventoPermanenciaSeguroParaDashboard_),
```

Em `respostaBootstrapDashboardValida_`, exigir ambos como arrays. Não alterar o envelope público nem adicionar nova ação.

- [ ] **Step 4: Rodar testes e commit**

Run: `node --test tests/dashboard-api.test.js tests/dashboard-public-web-api.test.js tests/dashboard-execution-api.test.js`

Expected: PASS.

```bash
git add apps-script/11_DashboardRepositorio.gs apps-script/12_DashboardApi.gs tests/dashboard-api.test.js tests/dashboard-public-web-api.test.js
git commit -m "feat: expose safe permanence data in dashboard bootstrap"
```

---

### Task 7: Implementar cálculos puros de tempo, faixas e coortes

**Files:**
- Create: `pwa/js/permanencia.js`
- Create: `tests/permanencia-pwa.test.js`

**Interfaces:**
- Consumes: arrays seguros do bootstrap e data local.
- Produces: `window.XSteamPermanencia` e CommonJS com `monthsCompleted`, `relationshipLabel`, `relationshipBand`, `cohortKey`, `isEnrolled`, `buildAnalysis`.

- [ ] **Step 1: Escrever testes de limites e ausência de LTV**

Criar `tests/permanencia-pwa.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const permanence = require('../pwa/js/permanencia.js');

const now = new Date(2026, 7, 20, 12);

test('calcula meses completos e rótulo sem arredondar para cima', () => {
  assert.equal(permanence.monthsCompleted('20/08/2026', now), 0);
  assert.equal(permanence.monthsCompleted('21/07/2026', now), 0);
  assert.equal(permanence.monthsCompleted('20/07/2026', now), 1);
  assert.equal(permanence.relationshipLabel(28), '2 anos e 4 meses');
});

test('classifica os cinco limites exatos', () => {
  assert.deepEqual([3, 4, 6, 7, 12, 13, 24, 25].map(permanence.relationshipBand), [
    'Até 3 meses', '4–6 meses', '4–6 meses', '7–12 meses',
    '7–12 meses', '13–24 meses', '13–24 meses', '25 meses ou mais'
  ]);
});

test('considera ativo, bloqueado e licença como matriculados', () => {
  assert.equal(permanence.isEnrolled('Ativo'), true);
  assert.equal(permanence.isEnrolled('Bloqueado'), true);
  assert.equal(permanence.isEnrolled('Em Licença'), true);
  assert.equal(permanence.isEnrolled('Cancelado'), false);
});

test('monta cobertura, mediana e retenção sem calcular valor monetário', () => {
  const result = permanence.buildAnalysis({
    permanence: [
      { id: '1', aluno: 'A', clienteDesde: '20/08/2024', status: 'Ativo', quantidadeContratos: 2 },
      { id: '2', aluno: 'B', clienteDesde: '20/08/2024', status: 'Cancelado', quantidadeContratos: 1 }
    ],
    currentStudents: [{ id: '1' }, { id: '2' }],
    contracts: [{ id: '1', contrato: '3X', valor: 900 }],
    events: []
  }, now);
  assert.equal(result.kpis.coveragePercent, 100);
  assert.equal(result.cohorts[0].observedRetentionPercent, 50);
  assert.equal('ltv' in result.kpis, false);
  assert.equal('revenue' in result.cohorts[0], false);
  assert.deepEqual(result.rows[0].packages, [{ name: '3X', value: 900 }]);
});
```

- [ ] **Step 2: Rodar e confirmar módulo ausente**

Run: `node --test tests/permanencia-pwa.test.js`

Expected: FAIL com `Cannot find module '../pwa/js/permanencia.js'`.

- [ ] **Step 3: Implementar módulo UMD sem DOM**

Usar o mesmo wrapper de `student-profiles.js`. `monthsCompleted` deve parsear `dd/MM/yyyy`, calcular diferença de ano/mês e subtrair um mês quando o dia atual ainda não alcançou o dia de entrada. Datas ausentes retornam `null`.

`buildAnalysis` deve retornar exatamente:

```js
{
  kpis: {
    currentStudents: 0,
    withStartDate: 0,
    coveragePercent: 0,
    medianMonths: null,
    newInLastBatch: 0,
    absentInLastBatch: 0,
    statusChangesInLastBatch: 0
  },
  bands: [],
  cohorts: [],
  rows: []
}
```

Cada faixa contém `{ key, label, value, ids }`; cada coorte contém `{ key, label, total, enrolled, cancelled, observedRetentionPercent, ids }`. Cada linha contém data, meses, rótulo, faixa, coorte, status, quantidade histórica e `packages`, onde cada pacote mantém `{ name, value }` separado. Não somar valores e não criar propriedades `ltv`, `revenue` ou equivalentes.

Regras exatas de agregação:

- cobertura usa somente `currentStudents`: IDs com `clienteDesde` dividido por IDs atuais distintos;
- mediana usa meses completos somente dos alunos atuais com data; ordenar números e, em população par, usar a média aritmética dos dois centrais;
- faixas usam os alunos atuais do recorte;
- coortes usam toda `permanence` com data válida, inclusive ausentes do lote e cancelados;
- `cancelled` inclui status não matriculados; `enrolled` usa exclusivamente `isEnrolled`;
- descobrir o último lote pela maior `dataReferencia` de `events`;
- `newInLastBatch` conta `NOVO_ALUNO`, sem contar `CARGA_INICIAL`;
- `absentInLastBatch` conta `AUSENTE_NO_LOTE`;
- `statusChangesInLastBatch` conta `ALTERACAO_STATUS`;
- pacotes vêm somente de `contracts` recebidos, que já respeitam status/polo globais;
- deduplicar pacotes por `chave` quando existir e, na ausência, por `id|contrato|valor|vencimento`.

- [ ] **Step 4: Rodar testes e commit**

Run: `node --test tests/permanencia-pwa.test.js`

Expected: PASS.

```bash
git add pwa/js/permanencia.js tests/permanencia-pwa.test.js
git commit -m "feat: calculate tenure and cohorts without estimated ltv"
```

---

### Task 8: Adicionar a terceira subaba Financeiro > Permanência

**Files:**
- Create: `pwa/css/permanencia.css`
- Modify: `pwa/index.html`
- Modify: `pwa/js/dashboard.js`
- Modify: `pwa/sw.js`
- Modify: `tests/dashboard-html.test.js`
- Modify: `tests/pwa-shell.test.js`

**Interfaces:**
- Consumes: `XSteamPermanencia.buildAnalysis` e coleções do bootstrap.
- Produces: `renderPermanence(data)`, `showPermanenceDetail(title, rows)` e subpágina `permanencia`.

- [ ] **Step 1: Escrever testes estruturais falhando**

Acrescentar:

```js
test('Financeiro possui terceira subaba de Permanência sem fórmula de LTV', () => {
  const html = fs.readFileSync('pwa/index.html', 'utf8');
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  const module = fs.readFileSync('pwa/js/permanencia.js', 'utf8');
  assert.match(html, /data-subpage="permanencia"/);
  assert.match(html, /permanencia\.css/);
  assert.match(html, /permanencia\.js/);
  assert.match(client, /function renderPermanence\(data\)/);
  assert.match(client, /function showPermanenceDetail\(title, rows\)/);
  assert.doesNotMatch(client + module, /LTV potencial|valor\s*\*\s*meses|meses\s*\*\s*valor/i);
});
```

Atualizar `tests/pwa-shell.test.js` para exigir `xsteam-static-v7`, `./css/permanencia.css` e `./js/permanencia.js` em `STATIC_ASSETS`.

- [ ] **Step 2: Rodar e confirmar falha visual estrutural**

Run: `node --test tests/dashboard-html.test.js tests/pwa-shell.test.js tests/permanencia-pwa.test.js`

Expected: FAIL porque a subaba e os ativos ainda não existem no shell.

- [ ] **Step 3: Ligar os novos ativos e a navegação**

Em `pwa/index.html`:

```html
<link rel="stylesheet" href="./css/permanencia.css">
```

```html
<button type="button" data-subpage="permanencia">Permanência</button>
```

Carregar `./js/permanencia.js` antes de `./js/app.js`.

Em `dashboard.js`, incluir `permanencia` no conjunto Financeiro:

```js
var finance = b.dataset.subpage === 'planos' ||
  b.dataset.subpage === 'vencimentos' ||
  b.dataset.subpage === 'permanencia';
```

e na ativação:

```js
if (page === 'financeiro' && ['planos', 'vencimentos', 'permanencia'].indexOf(state.subpage) < 0) {
  state.subpage = 'planos';
}
```

No dispatcher Financeiro, usar `renderPlans`, `renderDue` ou `renderPermanence` explicitamente.

- [ ] **Step 4: Renderizar leitura executiva, faixas, coortes e lista**

`renderPermanence(data)` deve chamar:

```js
var analysis = window.XSteamPermanencia.buildAnalysis({
  permanence: state.bootstrap.permanencia || [],
  currentStudents: data.alunos || [],
  contracts: data.contratos || [],
  events: state.bootstrap.eventosPermanencia || []
}, today());
```

Renderizar quatro cartões: cobertura, tempo mediano, novos no último lote e mudanças de status. Em seguida, duas seções clicáveis para faixas e coortes e uma lista ordenada por maior tempo, depois nome. Cada clique deve chamar `showPermanenceDetail` com os IDs do recorte.

O detalhe deve usar APIs de DOM e mostrar:

```text
Cliente desde: 10/01/2024
Tempo na empresa: 2 anos e 7 meses
Status: Ativo
Coorte: Jan/2024
Contratos históricos: 3
Pacote atual: 3X — R$ 900,00
```

Para múltiplos pacotes, criar uma linha por pacote. Para aluno sem contrato atual, mostrar `Sem pacote atual`.

- [ ] **Step 5: Criar CSS responsivo e atualizar cache**

Em `pwa/css/permanencia.css`, definir classes exclusivas:

```css
.permanence-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.permanence-cohort-list { display: grid; gap: 8px; }
.permanence-row { display: grid; grid-template-columns: minmax(180px, 1.5fr) 130px 130px minmax(180px, 1fr) auto; gap: 14px; align-items: center; padding: 14px 0; border-top: 1px solid var(--line); }
.permanence-row:first-child { border-top: 0; }
.permanence-packages { display: grid; gap: 3px; color: var(--muted-strong); }
@media (max-width: 860px) { .permanence-grid { grid-template-columns: 1fr; } .permanence-row { grid-template-columns: minmax(0, 1fr) auto; } }
@media (max-width: 520px) { .permanence-row { align-items: start; } .permanence-row > * { grid-column: 1 / -1; } }
```

No `sw.js`, mudar para `xsteam-static-v7` e adicionar CSS/JS à lista.

- [ ] **Step 6: Rodar testes e commit**

Run: `node --test tests/dashboard-html.test.js tests/pwa-shell.test.js tests/permanencia-pwa.test.js`

Expected: PASS.

```bash
git add pwa/index.html pwa/js/dashboard.js pwa/js/permanencia.js pwa/css/permanencia.css pwa/sw.js tests/dashboard-html.test.js tests/pwa-shell.test.js tests/permanencia-pwa.test.js
git commit -m "feat: add permanence finance subtab"
```

---

### Task 9: Enriquecer o perfil individual sem criar valor derivado

**Files:**
- Modify: `pwa/js/student-profiles.js`
- Modify: `pwa/js/dashboard.js`
- Modify: `tests/student-profiles.test.js`

**Interfaces:**
- Consumes: `bootstrap.permanencia` e `XSteamPermanencia.relationshipLabel`.
- Produces: `card.permanencia` e novos itens somente informativos no diálogo de perfil.

- [ ] **Step 1: Escrever teste de cartão e conteúdo do diálogo**

Atualizar o input de `buildStudentCards` e testar:

```js
test('perfil associa permanência por ID e mantém valor atual separado', () => {
  const cards = profiles.buildStudentCards({
    alunos: [{ id: '42', aluno: 'ALUNO TESTE', status: 'Ativo' }],
    contratos: [{ id: '42', contrato: '3X', valor: 900, statusContrato: 'Ativo' }],
    permanencia: [{
      id: '42', clienteDesde: '10/01/2024', status: 'Ativo', quantidadeContratos: 3
    }],
    perfisAlunos: [], catalogoPerfisAlunos: []
  });
  assert.equal(cards[0].permanencia.clienteDesde, '10/01/2024');
  assert.equal(cards[0].contratoPrincipal.valor, 900);
  assert.equal('ltv' in cards[0], false);
});
```

- [ ] **Step 2: Rodar e confirmar falha por associação ausente**

Run: `node --test tests/student-profiles.test.js`

Expected: FAIL porque `card.permanencia` não existe.

- [ ] **Step 3: Associar por ID e renderizar os campos**

Em `buildStudentCards`, criar `permanenceById` e acrescentar:

```js
permanencia: permanenceById[id] || null,
```

No diálogo, inserir antes do contrato:

```js
['Cliente desde', card.permanencia ? card.permanencia.clienteDesde : ''],
['Tempo na empresa', card.permanencia && options.permanence
  ? options.permanence.relationshipLabel(
      options.permanence.monthsCompleted(card.permanencia.clienteDesde, new Date())
    )
  : ''],
['Contratos históricos', card.permanencia ? card.permanencia.quantidadeContratos : ''],
```

Passar `permanencia: options.bootstrap.permanencia || []` em `renderSection` e `permanence: window.XSteamPermanencia` em `openProfileDialog`. Não somar contratos e não criar campos monetários derivados.

- [ ] **Step 4: Rodar testes e commit**

Run: `node --test tests/student-profiles.test.js tests/dashboard-html.test.js tests/permanencia-pwa.test.js`

Expected: PASS.

```bash
git add pwa/js/student-profiles.js pwa/js/dashboard.js tests/student-profiles.test.js
git commit -m "feat: show tenure in student profiles"
```

---

### Task 10: Atualizar validação local e documentação operacional

**Files:**
- Create: `scripts/validar-permanencia-real.js`
- Modify: `scripts/validar-dados-reais.js`
- Modify: `package.json`
- Modify: `apps-script/Sidebar.html`
- Modify: `apps-script/INSTRUCOES_INSTALACAO.md`
- Modify: `docs/operacao/LEIA-ME_POP_01_ENTRADA.html`
- Regenerate: `docs/operacao/LEIA-ME_POP_01_ENTRADA.pdf`
- Modify: `tests/main.test.js`
- Modify: `tests/deploy-config.test.js`

**Interfaces:**
- Consumes: quatro caminhos locais e status da inspeção do lote.
- Produces: comandos de auditoria sem PII e POP de quatro arquivos.

- [ ] **Step 1: Escrever testes de texto e comando falhando**

Acrescentar testes que exijam `permanencia_2026-08-21_r01.xls`, a expressão `quatro relatórios`, quatro itens na Sidebar e script npm `validate:permanence`.

- [ ] **Step 2: Rodar testes e confirmar documentação antiga**

Run: `node --test tests/main.test.js tests/deploy-config.test.js`

Expected: FAIL porque os textos ainda dizem três relatórios.

- [ ] **Step 3: Criar auditoria real sem imprimir nomes**

`scripts/validar-permanencia-real.js` deve aceitar exatamente um caminho, carregar parser/normalização/permanência, e imprimir somente:

```js
console.log(JSON.stringify({
  linhasFonte: linhas.length,
  idsUnicos: new Set(linhas.map(item => item.codigo)).size,
  datasValidas: resultado.base.filter(item => item.cliente_desde instanceof Date).length,
  eventosIniciais: resultado.historico.length,
  status: resultado.base.reduce(function (acc, item) {
    var key = String(item.status_permanencia || 'Não informado');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})
}, null, 2));
```

Não imprimir linhas individuais, nomes ou IDs.

Em `package.json`:

```json
"validate:permanence": "node scripts/validar-permanencia-real.js"
```

Atualizar `validar-dados-reais.js` para exigir quatro caminhos, parsear `permanencia` e passá-la ao pipeline novo.

- [ ] **Step 4: Atualizar Sidebar, instruções e POP**

Substituir todas as ocorrências operacionais de três por quatro e incluir o nome canônico. Explicar:

- exportação completa, sem filtro de status;
- mesma data e revisão;
- `r02` para correção já processada;
- não editar células nas abas gerenciadas;
- aguardar os quatro uploads e clicar uma vez.

Antes de regenerar o PDF, invocar a skill `html-to-pdf-export`. Gerar o PDF a partir do HTML atualizado usando o script ou navegador indicado por essa skill, sem alterar o layout de marca existente.

- [ ] **Step 5: Rodar testes, conferir PDF e commit**

Run: `node --test tests/main.test.js tests/deploy-config.test.js tests/parser.test.js tests/lote.test.js`

Expected: PASS.

Run: `pdfinfo docs/operacao/LEIA-ME_POP_01_ENTRADA.pdf`

Expected: PDF válido, pelo menos uma página, sem erro de sintaxe.

```bash
git add package.json scripts/validar-dados-reais.js scripts/validar-permanencia-real.js apps-script/Sidebar.html apps-script/INSTRUCOES_INSTALACAO.md docs/operacao/LEIA-ME_POP_01_ENTRADA.html docs/operacao/LEIA-ME_POP_01_ENTRADA.pdf tests/main.test.js tests/deploy-config.test.js
git commit -m "docs: update four-report import procedure"
```

---

### Task 11: Executar verificação completa e revisão de código

**Files:**
- Modify only if failures reveal defects in files already listed.

**Interfaces:**
- Consumes: todas as entregas anteriores.
- Produces: branch pronta para integração e publicação.

- [ ] **Step 1: Auditar o arquivo real sem expor PII**

Run:

```bash
npm run validate:permanence -- '/home/elohimlima/Downloads/clientes por permanencia (07_08).xls'
```

Expected:

```text
linhasFonte: 980
idsUnicos: 980
datasValidas: 980
eventosIniciais: 980
```

- [ ] **Step 2: Executar toda a suíte**

Run: `npm test`

Expected: todos os testes PASS, zero falhas, zero cancelamentos.

- [ ] **Step 3: Executar verificações estáticas**

Run: `git diff --check`

Expected: sem saída.

Run: `git status --short`

Expected: somente mudanças intencionais desta feature; nenhum arquivo real `.xls` rastreado.

- [ ] **Step 4: Invocar revisão formal**

Invocar `requesting-code-review` com a especificação, este plano, o diff completo e os resultados da suíte. Corrigir cada achado confirmado, repetir os testes afetados e então repetir `npm test`.

- [ ] **Step 5: Commit de correções de revisão, quando necessário**

```bash
git add apps-script pwa scripts tests docs/operacao package.json
git commit -m "fix: address permanence implementation review"
```

Se nenhuma correção for necessária, não criar commit vazio.

---

### Task 12: Integrar, publicar e executar a carga real

**Files:**
- No source changes expected; deployment artifacts are produced by existing workflows.

**Interfaces:**
- Consumes: branch revisada, autenticação clasp existente, arquivo local real e pasta Drive `01_ENTRADA`.
- Produces: `main` publicada, Apps Script atualizado, PWA v7 pública e 980 registros carregados.

- [ ] **Step 1: Integrar a branch em main de forma não destrutiva**

Invocar `finishing-a-development-branch`. Confirmar que `main` não avançou de forma conflitante, fazer merge não destrutivo e preservar os três arquivos locais não relacionados listados nas restrições globais.

- [ ] **Step 2: Publicar Apps Script**

Run: `npx --yes @google/clasp@latest push --force`

Expected: arquivos `.gs`, `Sidebar.html` e manifesto enviados sem erro; nenhum arquivo real enviado como código.

Atualizar o deployment existente, nunca criar URL nova:

```bash
npx --yes @google/clasp@latest deployments
npx --yes @google/clasp@latest deploy --deploymentId "$APPS_SCRIPT_API_DEPLOYMENT_ID" --description "Permanência de clientes"
```

Expected: deployment existente atualizado e mesma URL `/exec` preservada.

- [ ] **Step 3: Colocar o arquivo real na entrada sem trabalho manual do usuário**

Usar a sessão Google autenticada do executor para enviar `/home/elohimlima/Downloads/clientes por permanencia (07_08).xls` à pasta Drive `01_ENTRADA`. Renomear no Drive para:

```text
permanencia_2026-08-07_r01.xls
```

Confirmar por leitura que existe exatamente um arquivo operacional na pasta antes de executar a carga inicial; o POP pode permanecer.

- [ ] **Step 4: Executar a função administrativa uma única vez**

Run:

```bash
npx --yes @google/clasp@latest run executarCargaInicialPermanencia
```

Expected: objeto com `ok: true`, `registros: 980`, contagem de associados à base operacional e contagem mantida somente no histórico.

Se `clasp run` não estiver habilitado para o deployment, executar a mesma função autenticada pelo editor Apps Script; esta ação é do agente executor, não do usuário. Não expor a função na API pública.

- [ ] **Step 5: Validar planilha e API após a carga**

Confirmar por funções de diagnóstico, sem imprimir nomes:

- `BASE_PERMANENCIA`: 980 linhas de dados;
- `HISTORICO_PERMANENCIA`: 980 eventos `CARGA_INICIAL`;
- `BASE_ALUNOS`: mesma quantidade anterior;
- `CONTRATOS`: mesma quantidade anterior;
- IDs associados possuem `inicio_plano`;
- arquivo real foi movido para `02_PROCESSADOS/2026/2026-08-07`;
- `IMPORTACOES` possui sucesso para permanência;
- versão do bootstrap mudou.

Testar o Web App com a URL configurada e o segredo existente; exigir HTTP 200, JSON válido, `permanencia.length === 980` e ausência de valores anteriores nos eventos públicos.

- [ ] **Step 6: Publicar e verificar a PWA**

Push de `main` deve acionar GitHub Pages. Acompanhar `deploy-pages.yml` até `conclusion: success`.

Abrir `https://fitmanagementels.github.io/BASE_TECNOFIT_WELLNESS/` em sessão limpa e confirmar:

1. service worker `xsteam-static-v7`;
2. Financeiro mostra Planos, Vencimentos e Permanência;
3. cobertura, mediana, faixas e coortes carregam;
4. detalhe mostra tempo e pacotes separados;
5. perfil do aluno mostra Cliente desde;
6. nenhuma tela apresenta LTV estimado ou multiplicação monetária;
7. Home, Acompanhamento, Fluxo e Configurações continuam funcionando;
8. layout funciona em desktop e viewport móvel.

- [ ] **Step 7: Verificação final antes de declarar conclusão**

Invocar `verification-before-completion`. Registrar no handoff:

- commit final em `main`;
- resultado total de testes;
- deployment Apps Script atualizado;
- execução da carga com 980 registros;
- quantidade associada à população operacional;
- URL e status da PWA;
- qualquer diagnóstico de data posterior preservada ou ID sem correspondência.
