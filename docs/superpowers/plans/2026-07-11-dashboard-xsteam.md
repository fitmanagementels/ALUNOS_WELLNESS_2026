# Dashboard XSTEAM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um dashboard web responsivo em Google Apps Script, com o padrão visual XSTEAM e quatro páginas de análise operacional alimentadas pela planilha `Tecnofit_Base_Mestre`.

**Architecture:** O backend existente permanece responsável pela importação. Novos módulos `.gs` leem a base, deduplicam alunos e contratos, calculam métricas e expõem um único endpoint por página. O frontend será uma SPA sem framework, composta por parciais HTML/CSS/JavaScript, com Chart.js para gráficos e navegação lateral no desktop ou inferior no celular.

**Tech Stack:** Google Apps Script V8, SpreadsheetApp, CacheService, HtmlService, HTML5, CSS3, JavaScript ES2020 no navegador, Chart.js 4.4.7, Node.js 20 `node:test`.

## Global Constraints

- Planilha: `Tecnofit_Base_Mestre`, ID `1I63DuNBk1mR-U5gNe9EvGhSu-QryqXxfVrG0RC0vtfM`.
- Abas: `BASE_ALUNOS`, `CONTRATOS`, `VISAO_MESTRE`, `IMPORTACOES`.
- Fuso horário: `America/Fortaleza`; datas exibidas em `dd/MM/yyyy`.
- Ficha desatualizada: mais de 30 dias; avaliação desatualizada: mais de 90 dias.
- Alunos são deduplicados por `id`; contratos e valores são deduplicados por `_chave_contrato`.
- Interface: preto/grafite, branco e verde-limão; vermelho e âmbar apenas para alertas.
- Desktop é o foco principal; o celular deve ter navegação inferior e listas sem rolagem horizontal da aplicação.
- Não expor dados pessoais em logs ou mensagens de erro.
- Não adicionar edição da base, automação de mensagens, tarefas comerciais ou métricas corporais.
- Não alterar o fluxo existente de importação nem a `Sidebar.html`.
- O workspace ainda não é um repositório Git funcional. Antes da Task 1, solicitar autorização explícita para remover o placeholder vazio `.git`, executar `git init`, criar a branch `main`, adicionar `.superpowers/` ao `.gitignore` e registrar um commit-base. Se a autorização não for concedida, executar os mesmos checkpoints sem os passos de commit.

---

## File Map

| Arquivo | Responsabilidade |
|---|---|
| `apps-script/00_Config.gs` | Limites e chaves de cache do dashboard |
| `apps-script/09_DashboardMetricas.gs` | Datas, deduplicação, classificações e agregações puras |
| `apps-script/10_DashboardPaginas.gs` | Montagem dos DTOs das quatro páginas |
| `apps-script/11_DashboardRepositorio.gs` | Leitura das abas e conversão de linhas em objetos |
| `apps-script/12_DashboardApi.gs` | API pública, cache, filtros e normalização de erros |
| `apps-script/Dashboard.html` | Documento da web app e composição das parciais |
| `apps-script/DashboardStyles.html` | Design system e responsividade XSTEAM |
| `apps-script/DashboardComponents.html` | Templates de cartões, gráficos, listas e estados |
| `apps-script/DashboardClient.html` | Estado, navegação, filtros e chamadas `google.script.run` |
| `apps-script/08_Main.gs` | `doGet`, inclusão de parciais e menu para localizar a web app |
| `tests/dashboard-metricas.test.js` | Testes unitários das regras de cálculo |
| `tests/dashboard-paginas.test.js` | Testes dos DTOs das quatro páginas |
| `tests/dashboard-api.test.js` | Testes de leitura, cache e erros seguros |
| `tests/dashboard-html.test.js` | Contrato estrutural e de privacidade da interface |
| `apps-script/INSTRUCOES_INSTALACAO.md` | Publicação e atualização do deployment |

---

### Task 1: Dashboard Configuration and Pure Date Rules

**Files:**
- Modify: `apps-script/00_Config.gs`
- Create: `apps-script/09_DashboardMetricas.gs`
- Create: `tests/dashboard-metricas.test.js`

**Interfaces:**
- Consumes: `CONFIG.fusoHorario`.
- Produces: `CONFIG.dashboard`, `paraDataDashboard_`, `formatarDataDashboard_`, `diasEntreDashboard_`, `classificarVencimento_`, `classificarAtualizacao_`, `unicosPor_`.

- [ ] **Step 1: Write failing tests for date boundaries and deduplication**

Create `tests/dashboard-metricas.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas([
  'apps-script/00_Config.gs',
  'apps-script/09_DashboardMetricas.gs'
]);

const hoje = new Date(2026, 6, 11, 12);

test('classifica vencimento nos limites de 7 e 30 dias', () => {
  assert.equal(gas.classificarVencimento_(new Date(2026, 6, 10, 12), hoje), 'vencido');
  assert.equal(gas.classificarVencimento_(new Date(2026, 6, 18, 12), hoje), 'ate7');
  assert.equal(gas.classificarVencimento_(new Date(2026, 7, 10, 12), hoje), 'ate30');
  assert.equal(gas.classificarVencimento_(new Date(2026, 7, 11, 12), hoje), 'futuro');
});

test('classifica ficha e avaliação com limite estritamente excedido', () => {
  assert.equal(gas.classificarAtualizacao_('', hoje, 30), 'ausente');
  assert.equal(gas.classificarAtualizacao_(new Date(2026, 5, 11, 12), hoje, 30), 'atualizada');
  assert.equal(gas.classificarAtualizacao_(new Date(2026, 5, 10, 12), hoje, 30), 'desatualizada');
  assert.equal(gas.classificarAtualizacao_(new Date(2026, 3, 12, 12), hoje, 90), 'atualizada');
  assert.equal(gas.classificarAtualizacao_(new Date(2026, 3, 11, 12), hoje, 90), 'desatualizada');
});

test('deduplica pelo primeiro valor não vazio da chave', () => {
  const rows = [{ id: '1', nome: 'A' }, { id: '1', nome: 'A2' }, { id: '2', nome: 'B' }];
  assert.deepEqual(Array.from(gas.unicosPor_(rows, 'id'), row => row.nome), ['A', 'B']);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/dashboard-metricas.test.js`

Expected: FAIL with `ENOENT` for `apps-script/09_DashboardMetricas.gs`.

- [ ] **Step 3: Add centralized dashboard configuration**

Add this property inside `CONFIG` after `fusoHorario`:

```javascript
  dashboard: Object.freeze({
    diasFicha: 30,
    diasAvaliacao: 90,
    cacheSegundos: 300,
    chartJsUrl: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js'
  }),
```

- [ ] **Step 4: Implement the pure date and deduplication helpers**

Create `apps-script/09_DashboardMetricas.gs`:

```javascript
function paraDataDashboard_(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) return new Date(valor.getTime());
  if (typeof valor === 'number' && isFinite(valor)) return new Date(valor);
  var texto = String(valor == null ? '' : valor).trim();
  if (!texto) return null;
  var br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  var iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  var partes = br ? [br[3], br[2], br[1]] : (iso ? [iso[1], iso[2], iso[3]] : null);
  if (!partes) return null;
  return new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]), 12);
}

function formatarDataDashboard_(valor) {
  var data = paraDataDashboard_(valor);
  if (!data) return '';
  return [
    String(data.getDate()).padStart(2, '0'),
    String(data.getMonth() + 1).padStart(2, '0'),
    data.getFullYear()
  ].join('/');
}

function inicioDiaDashboard_(valor) {
  var data = paraDataDashboard_(valor);
  return data ? new Date(data.getFullYear(), data.getMonth(), data.getDate(), 12) : null;
}

function diasEntreDashboard_(inicio, fim) {
  var a = inicioDiaDashboard_(inicio);
  var b = inicioDiaDashboard_(fim);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function classificarVencimento_(vencimento, hoje) {
  var dias = diasEntreDashboard_(hoje, vencimento);
  if (dias == null) return 'semData';
  if (dias < 0) return 'vencido';
  if (dias <= 7) return 'ate7';
  if (dias <= 30) return 'ate30';
  return 'futuro';
}

function classificarAtualizacao_(data, hoje, limiteDias) {
  if (!paraDataDashboard_(data)) return 'ausente';
  var idade = diasEntreDashboard_(data, hoje);
  return idade > limiteDias ? 'desatualizada' : 'atualizada';
}

function unicosPor_(linhas, chave) {
  var vistos = {};
  return (linhas || []).filter(function (linha) {
    var valor = String(linha[chave] == null ? '' : linha[chave]).trim();
    if (!valor || vistos[valor]) return false;
    vistos[valor] = true;
    return true;
  });
}
```

- [ ] **Step 5: Run the test and commit**

Run: `node --test tests/dashboard-metricas.test.js`

Expected: 3 tests PASS.

```bash
git add apps-script/00_Config.gs apps-script/09_DashboardMetricas.gs tests/dashboard-metricas.test.js
git commit -m "feat: add dashboard date and deduplication rules"
```

---

### Task 2: Page DTO Builders

**Files:**
- Create: `apps-script/10_DashboardPaginas.gs`
- Create: `tests/dashboard-paginas.test.js`

**Interfaces:**
- Consumes: helpers from `09_DashboardMetricas.gs` and rows shaped as objects using definitive headers.
- Produces: `montarPaginaVencimentos_`, `montarPaginaFichas_`, `montarPaginaAvaliacoes_`, `montarPaginaPlanos_` returning `{ kpis, graficos, lista, filtros }`.

- [ ] **Step 1: Write failing tests for the four page builders**

Create `tests/dashboard-paginas.test.js` with synthetic data only:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas([
  'apps-script/00_Config.gs',
  'apps-script/09_DashboardMetricas.gs',
  'apps-script/10_DashboardPaginas.gs'
]);
const hoje = new Date(2026, 6, 11, 12);
const alunos = [
  { id: '1', aluno: 'ALUNO A', contato: '8500000001', status: 'Ativo', data_ficha: '', data_avaliacao: new Date(2026, 6, 1) },
  { id: '2', aluno: 'ALUNO B', contato: '8500000002', status: 'Ativo', data_ficha: new Date(2026, 5, 1), data_avaliacao: '' }
];
const contratos = [
  { _chave_contrato: 'c1', id: '1', contrato_x_sem: '2X', valor: 100, vencimento: new Date(2026, 6, 10), status_contrato: 'Finalizado', polo: 'POLO A', modalidade: 'MUSCULAÇÃO' },
  { _chave_contrato: 'c2', id: '1', contrato_x_sem: '3X', valor: 200, vencimento: new Date(2026, 6, 18), status_contrato: 'Ativo', polo: 'POLO B', modalidade: 'CORRIDA' },
  { _chave_contrato: 'c3', id: '2', contrato_x_sem: '2X', valor: 300, vencimento: new Date(2026, 7, 1), status_contrato: 'Ativo', polo: 'POLO A', modalidade: 'MUSCULAÇÃO' }
];

test('vencimentos deduplica contratos e soma apenas a janela de 30 dias', () => {
  const page = gas.montarPaginaVencimentos_(alunos, contratos.concat(contratos[0]), hoje);
  assert.deepEqual(JSON.parse(JSON.stringify(page.kpis)), { vencidos: 1, ate7: 1, ate30: 2, valorAte30: 500 });
  assert.equal(page.lista[0].chave, 'c1');
});

test('fichas e avaliações contam alunos, não contratos', () => {
  const fichas = gas.montarPaginaFichas_(alunos, contratos, hoje);
  const avaliacoes = gas.montarPaginaAvaliacoes_(alunos, contratos, hoje);
  assert.equal(fichas.kpis.ausentes, 1);
  assert.equal(fichas.kpis.desatualizadas, 1);
  assert.equal(avaliacoes.kpis.ausentes, 1);
  assert.equal(avaliacoes.kpis.atualizadas, 1);
});

test('planos calcula alunos, contratos, valor e ticket sem duplicar', () => {
  const page = gas.montarPaginaPlanos_(alunos, contratos.concat(contratos[0]));
  assert.deepEqual(JSON.parse(JSON.stringify(page.kpis)), { alunos: 2, contratos: 3, valor: 600, ticketMedio: 200 });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/dashboard-paginas.test.js`

Expected: FAIL because `apps-script/10_DashboardPaginas.gs` does not exist.

- [ ] **Step 3: Implement reusable grouping and row projection**

Create `apps-script/10_DashboardPaginas.gs` beginning with:

```javascript
function contarPorDashboard_(linhas, campo) {
  return (linhas || []).reduce(function (acc, linha) {
    var chave = String(linha[campo] || 'Não informado');
    acc[chave] = (acc[chave] || 0) + 1;
    return acc;
  }, {});
}

function mapaAlunosDashboard_(alunos) {
  return unicosPor_(alunos, 'id').reduce(function (acc, aluno) {
    acc[String(aluno.id)] = aluno;
    return acc;
  }, {});
}

function polosPorAlunoDashboard_(contratos) {
  return (contratos || []).reduce(function (acc, contrato) {
    var id = String(contrato.id || '');
    var polo = String(contrato.polo || 'Não informado');
    if (!acc[id]) acc[id] = [];
    if (acc[id].indexOf(polo) === -1) acc[id].push(polo);
    return acc;
  }, {});
}

function vencimentosPorSemanaDashboard_(linhas, hoje) {
  var semanas = [0, 1, 2, 3, 4, 5].map(function (indice) {
    var inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + indice * 7, 12);
    var fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6, 12);
    return { chave: String(indice), label: formatarDataDashboard_(inicio) + '–' + formatarDataDashboard_(fim), valor: 0 };
  });
  linhas.forEach(function (linha) {
    if (linha.diasParaVencer == null || linha.diasParaVencer < 0) return;
    var indice = Math.floor(linha.diasParaVencer / 7);
    if (semanas[indice]) semanas[indice].valor += 1;
  });
  return semanas;
}

function faixasAtualizacaoDashboard_(lista) {
  return lista.reduce(function (acc, linha) {
    var dias = linha.diasSemAtualizacao;
    var faixa = linha.situacao === 'ausente' ? 'Sem data'
      : dias <= 30 ? '0–30 dias'
      : dias <= 60 ? '31–60 dias'
      : dias <= 90 ? '61–90 dias' : 'Mais de 90 dias';
    acc[faixa] = (acc[faixa] || 0) + 1;
    return acc;
  }, {});
}

function coberturaPorPoloDashboard_(lista) {
  var grupos = {};
  lista.forEach(function (linha) {
    (linha.polos || ['Não informado']).forEach(function (polo) {
      if (!grupos[polo]) grupos[polo] = { total: 0, cobertos: 0 };
      grupos[polo].total += 1;
      if (linha.situacao !== 'ausente') grupos[polo].cobertos += 1;
    });
  });
  return Object.keys(grupos).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).map(function (polo) {
    return { polo: polo, cobertura: Math.round((grupos[polo].cobertos / grupos[polo].total) * 1000) / 10 };
  });
}

function somarPorDashboard_(linhas, grupo, valor) {
  return (linhas || []).reduce(function (acc, linha) {
    var chave = String(linha[grupo] || 'Não informado');
    acc[chave] = (acc[chave] || 0) + (Number(linha[valor]) || 0);
    return acc;
  }, {});
}

function linhaContratoDashboard_(contrato, aluno, hoje) {
  return {
    chave: contrato._chave_contrato,
    id: String(contrato.id || ''),
    aluno: aluno ? aluno.aluno : '',
    contato: aluno ? aluno.contato : '',
    statusAluno: aluno ? aluno.status : '',
    frequencia: contrato.contrato_x_sem || '',
    modalidade: contrato.modalidade || '',
    polo: contrato.polo || 'Não informado',
    vencimento: formatarDataDashboard_(contrato.vencimento),
    diasParaVencer: diasEntreDashboard_(hoje, contrato.vencimento),
    situacao: classificarVencimento_(contrato.vencimento, hoje),
    statusContrato: contrato.status_contrato || '',
    valor: Number(contrato.valor) || 0
  };
}
```

- [ ] **Step 4: Implement the four public builders**

Append the following functions to the same file:

```javascript
function montarPaginaVencimentos_(alunos, contratos, hoje) {
  var unicos = unicosPor_(contratos, '_chave_contrato');
  var mapa = mapaAlunosDashboard_(alunos);
  var lista = unicos.map(function (contrato) {
    return linhaContratoDashboard_(contrato, mapa[String(contrato.id)], hoje);
  }).sort(function (a, b) {
    var da = a.diasParaVencer == null ? 999999 : a.diasParaVencer;
    var db = b.diasParaVencer == null ? 999999 : b.diasParaVencer;
    return da - db;
  });
  var kpis = { vencidos: 0, ate7: 0, ate30: 0, valorAte30: 0 };
  lista.forEach(function (linha) {
    if (linha.situacao === 'vencido') kpis.vencidos += 1;
    if (linha.situacao === 'ate7') kpis.ate7 += 1;
    if (linha.diasParaVencer != null && linha.diasParaVencer >= 0 && linha.diasParaVencer <= 30) {
      kpis.ate30 += 1;
      kpis.valorAte30 += linha.valor;
    }
  });
  return {
    kpis: kpis,
    graficos: { situacao: contarPorDashboard_(lista, 'situacao'), semanas: vencimentosPorSemanaDashboard_(lista, hoje) },
    lista: lista,
    filtros: {}
  };
}

function montarPaginaAtualizacao_(alunos, contratos, hoje, campo, limiteDias) {
  var polos = polosPorAlunoDashboard_(contratos);
  var lista = unicosPor_(alunos, 'id').map(function (aluno) {
    var situacao = classificarAtualizacao_(aluno[campo], hoje, limiteDias);
    return {
      id: String(aluno.id || ''), aluno: aluno.aluno || '', contato: aluno.contato || '',
      polos: polos[String(aluno.id)] || ['Não informado'], situacao: situacao,
      data: formatarDataDashboard_(aluno[campo]), diasSemAtualizacao: diasEntreDashboard_(aluno[campo], hoje)
    };
  }).sort(function (a, b) {
    var peso = { ausente: 0, desatualizada: 1, atualizada: 2 };
    return peso[a.situacao] - peso[b.situacao] || (b.diasSemAtualizacao || 0) - (a.diasSemAtualizacao || 0);
  });
  var contagem = contarPorDashboard_(lista, 'situacao');
  var total = lista.length;
  return {
    kpis: {
      atualizadas: contagem.atualizada || 0,
      desatualizadas: contagem.desatualizada || 0,
      ausentes: contagem.ausente || 0,
      cobertura: total ? Math.round(((total - (contagem.ausente || 0)) / total) * 1000) / 10 : 0
    },
    graficos: {
      situacao: contagem,
      faixas: faixasAtualizacaoDashboard_(lista),
      coberturaPorPolo: coberturaPorPoloDashboard_(lista)
    },
    lista: lista,
    filtros: {}
  };
}

function montarPaginaFichas_(alunos, contratos, hoje) {
  return montarPaginaAtualizacao_(alunos, contratos, hoje, 'data_ficha', CONFIG.dashboard.diasFicha);
}

function montarPaginaAvaliacoes_(alunos, contratos, hoje) {
  return montarPaginaAtualizacao_(alunos, contratos, hoje, 'data_avaliacao', CONFIG.dashboard.diasAvaliacao);
}

function montarPaginaPlanos_(alunos, contratos) {
  var unicos = unicosPor_(contratos, '_chave_contrato');
  var mapa = mapaAlunosDashboard_(alunos);
  var valor = unicos.reduce(function (soma, contrato) { return soma + (Number(contrato.valor) || 0); }, 0);
  var lista = unicos.map(function (contrato) {
    return linhaContratoDashboard_(contrato, mapa[String(contrato.id)], new Date());
  });
  return {
    kpis: { alunos: unicosPor_(alunos, 'id').length, contratos: unicos.length, valor: valor, ticketMedio: unicos.length ? valor / unicos.length : 0 },
    graficos: {
      polos: contarPorDashboard_(unicos, 'polo'), frequencias: contarPorDashboard_(unicos, 'contrato_x_sem'),
      modalidades: contarPorDashboard_(unicos, 'modalidade'), status: contarPorDashboard_(unicos, 'status_contrato'),
      valorPorPolo: somarPorDashboard_(unicos, 'polo', 'valor')
    },
    lista: lista, filtros: {}
  };
}
```

- [ ] **Step 5: Run page tests and commit**

Run: `node --test tests/dashboard-paginas.test.js`

Expected: 3 tests PASS.

```bash
git add apps-script/10_DashboardPaginas.gs tests/dashboard-paginas.test.js
git commit -m "feat: build dashboard page datasets"
```

---

### Task 3: Spreadsheet Repository and Safe Dashboard API

**Files:**
- Create: `apps-script/11_DashboardRepositorio.gs`
- Create: `apps-script/12_DashboardApi.gs`
- Create: `tests/dashboard-api.test.js`

**Interfaces:**
- Produces: `lerTabelaDashboard_(nomeAba, cabecalhos)`, `obterDadosPaginaDashboard(pagina, filtros)`.
- Public response: `{ ok, pagina, atualizadoEm, avisoImportacao, dados }` or safe thrown error.

- [ ] **Step 1: Write failing repository and API tests**

Create `tests/dashboard-api.test.js` covering: header-to-object mapping, page dispatch, cache hit and sanitized errors. Use sheet mocks whose `getDataRange().getValues()` returns synthetic rows and a cache mock backed by a `Map`. Assert that a second identical request does not reopen the spreadsheet and that a thrown error contains `Não foi possível carregar o dashboard.` without row contents.

Exact core assertions:

```javascript
assert.equal(result.ok, true);
assert.equal(result.pagina, 'vencimentos');
assert.equal(result.dados.kpis.vencidos, 1);
assert.equal(openCount, 1);
assert.throws(() => gas.obterDadosPaginaDashboard('inexistente', {}), /Página inválida/);
assert.throws(() => broken.obterDadosPaginaDashboard('vencimentos', {}), /^Error: Não foi possível carregar o dashboard\.$/);
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/dashboard-api.test.js`

Expected: FAIL because the repository and API files do not exist.

- [ ] **Step 3: Implement bounded table reading**

Create `apps-script/11_DashboardRepositorio.gs`:

```javascript
function lerTabelaDashboard_(nomeAba, cabecalhos) {
  var aba = obterPlanilhaMestre_().getSheetByName(nomeAba);
  if (!aba) throw new Error('Aba necessária não encontrada.');
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return [];
  var valores = aba.getRange(1, 1, ultimaLinha, cabecalhos.length).getValues();
  var recebidos = valores[0].map(String);
  cabecalhos.forEach(function (cabecalho, indice) {
    if (recebidos[indice] !== cabecalho) throw new Error('Estrutura de dados incompatível.');
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

function lerBaseDashboard_() {
  return {
    alunos: lerTabelaDashboard_(CONFIG.abas.alunos, CONFIG.cabecalhos.alunos),
    contratos: lerTabelaDashboard_(CONFIG.abas.contratos, CONFIG.cabecalhos.contratos),
    ultimaImportacao: obterUltimaImportacaoBemSucedida()
  };
}
```

- [ ] **Step 4: Implement cached page dispatch and safe errors**

Create `apps-script/12_DashboardApi.gs`:

```javascript
function chaveCacheDashboard_(pagina, filtros) {
  return 'dashboard:v1:' + pagina + ':' + JSON.stringify(filtros || {});
}

function obterDadosPaginaDashboard(pagina, filtros) {
  var construtores = {
    vencimentos: montarPaginaVencimentos_,
    fichas: montarPaginaFichas_,
    avaliacoes: montarPaginaAvaliacoes_,
    planos: montarPaginaPlanos_
  };
  if (!construtores[pagina]) throw new Error('Página inválida.');
  filtros = filtros || {};
  var cache = CacheService.getScriptCache();
  var chave = chaveCacheDashboard_(pagina, filtros);
  var existente = cache.get(chave);
  if (existente) return JSON.parse(existente);
  try {
    var base = lerBaseDashboard_();
    var hoje = new Date();
    var dados = construtores[pagina](base.alunos, base.contratos, hoje);
    var resposta = {
      ok: true,
      pagina: pagina,
      atualizadoEm: base.ultimaImportacao ? base.ultimaImportacao.concluidaEm : '',
      avisoImportacao: '',
      dados: dados
    };
    cache.put(chave, JSON.stringify(resposta), CONFIG.dashboard.cacheSegundos);
    return resposta;
  } catch (erro) {
    console.error('dashboard_error', { pagina: pagina, tipo: erro && erro.name ? erro.name : 'Error' });
    throw new Error('Não foi possível carregar o dashboard.');
  }
}
```

- [ ] **Step 5: Run API tests and commit**

Run: `node --test tests/dashboard-api.test.js`

Expected: all dashboard API tests PASS.

```bash
git add apps-script/11_DashboardRepositorio.gs apps-script/12_DashboardApi.gs tests/dashboard-api.test.js
git commit -m "feat: expose cached dashboard API"
```

---

### Task 4: Web App Entry Point and HTML Composition

**Files:**
- Modify: `apps-script/08_Main.gs`
- Create: `apps-script/Dashboard.html`
- Modify: `tests/main.test.js`

**Interfaces:**
- Produces: `doGet()`, `incluirArquivo_(nome)`, `obterUrlDashboard()`.
- Consumes: `DashboardStyles`, `DashboardComponents`, `DashboardClient` partials.

- [ ] **Step 1: Extend the main tests first**

Update the mocks in `tests/main.test.js` so `HtmlService.createTemplateFromFile('Dashboard').evaluate()` returns an object implementing `setTitle`, `setXFrameOptionsMode` and `addMetaTag`. Add tests asserting:

```javascript
test('doGet monta a web app do dashboard', () => {
  const { gas, calls } = setup();
  const output = gas.doGet();
  assert.equal(output.title, 'XSTEAM — Gestão');
  assert.equal(output.viewport, 'width=device-width, initial-scale=1');
  assert.equal(calls.some(call => call[0] === 'template' && call[1] === 'Dashboard'), true);
});

test('obterUrlDashboard retorna a URL publicada', () => {
  const { gas } = setup();
  assert.equal(gas.obterUrlDashboard(), 'https://script.google.com/mock');
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/main.test.js`

Expected: FAIL because `doGet` and `obterUrlDashboard` are not defined.

- [ ] **Step 3: Add the web entry point without changing the importer sidebar**

Append to `apps-script/08_Main.gs`:

```javascript
function incluirArquivo_(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

function doGet() {
  return HtmlService.createTemplateFromFile('Dashboard')
    .evaluate()
    .setTitle('XSTEAM — Gestão')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function obterUrlDashboard() {
  return ScriptApp.getService().getUrl() || '';
}
```

- [ ] **Step 4: Create the HTML document shell**

Create `apps-script/Dashboard.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <base target="_top">
    <meta charset="utf-8">
    <?!= incluirArquivo_('DashboardStyles'); ?>
    <script src="<?= CONFIG.dashboard.chartJsUrl ?>" defer></script>
  </head>
  <body>
    <div id="app" class="app-shell">
      <?!= incluirArquivo_('DashboardComponents'); ?>
    </div>
    <?!= incluirArquivo_('DashboardClient'); ?>
  </body>
</html>
```

- [ ] **Step 5: Run main tests and commit**

Run: `node --test tests/main.test.js`

Expected: all tests PASS.

```bash
git add apps-script/08_Main.gs apps-script/Dashboard.html tests/main.test.js
git commit -m "feat: add dashboard web app entry point"
```

---

### Task 5: XSTEAM Responsive Design System and App Shell

**Files:**
- Create: `apps-script/DashboardStyles.html`
- Create: `apps-script/DashboardComponents.html`
- Create: `tests/dashboard-html.test.js`

**Interfaces:**
- Produces stable DOM ids: `navDesktop`, `navMobile`, `pageTitle`, `filters`, `kpiGrid`, `chartGrid`, `listPanel`, `appState`.

- [ ] **Step 1: Write a failing static HTML contract test**

Create `tests/dashboard-html.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('shell contém as quatro páginas e regiões acessíveis', () => {
  const html = fs.readFileSync('apps-script/DashboardComponents.html', 'utf8');
  for (const page of ['vencimentos', 'fichas', 'avaliacoes', 'planos']) {
    assert.match(html, new RegExp(`data-page="${page}"`));
  }
  for (const id of ['pageTitle', 'filters', 'kpiGrid', 'chartGrid', 'listPanel', 'appState']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /aria-live="polite"/);
});

test('estilos definem breakpoints desktop e mobile da marca', () => {
  const css = fs.readFileSync('apps-script/DashboardStyles.html', 'utf8');
  assert.match(css, /--lime:\s*#dfff22/i);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
  assert.match(css, /\.mobile-nav/);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/dashboard-html.test.js`

Expected: FAIL with missing HTML partials.

- [ ] **Step 3: Create the semantic app shell**

Create `apps-script/DashboardComponents.html` with: a desktop `<aside id="navDesktop">`, four buttons using `data-page`, a sticky header, `<main>` containing `pageTitle`, `filters`, `kpiGrid`, `chartGrid`, `listPanel`, a polite live region `appState`, and `<nav id="navMobile" class="mobile-nav">` repeating the same four page destinations. Use text labels `Vencimentos`, `Fichas`, `Avaliações`, `Planos` and no real student data.

The state region must start as:

```html
<section id="appState" class="app-state" aria-live="polite">
  <div class="spinner" aria-hidden="true"></div>
  <p>Carregando dashboard…</p>
</section>
```

- [ ] **Step 4: Implement the approved visual tokens and responsive layout**

Create `apps-script/DashboardStyles.html` as a `<style>` partial. Include these non-negotiable tokens and layout rules:

```css
:root {
  --lime: #dfff22; --bg: #080909; --panel: #111313; --panel-2: #171919;
  --line: #292c2c; --text: #f5f7f7; --muted: #969d9d;
  --danger: #ff6b5f; --warning: #ffb84d; --success: #76df8b;
  --radius: 14px; --sidebar: 246px;
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; color: var(--text); background: var(--bg); font: 14px/1.45 Inter, Arial, sans-serif; }
.app-shell { min-height: 100vh; display: grid; grid-template-columns: var(--sidebar) minmax(0, 1fr); }
.desktop-nav { position: sticky; top: 0; height: 100vh; padding: 28px 18px; border-right: 1px solid var(--line); background: #050606; }
.brand-mark { background: var(--lime); color: #050606; }
.nav-button { width: 100%; min-height: 44px; color: var(--muted); background: transparent; border: 0; border-radius: 10px; text-align: left; }
.nav-button.active { color: #050606; background: var(--lime); }
.content { min-width: 0; padding: 30px 34px 100px; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.chart-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(300px, .85fr); gap: 12px; }
.card { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); }
.mobile-nav { display: none; }
@media (max-width: 1050px) {
  :root { --sidebar: 78px; }
  .nav-label, .brand-copy { display: none; }
  .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .app-shell { display: block; }
  .desktop-nav { display: none; }
  .content { padding: 22px 16px 100px; }
  .kpi-grid { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; }
  .kpi-card { min-width: 235px; scroll-snap-align: start; }
  .chart-grid { display: block; }
  .data-table { display: none; }
  .mobile-cards { display: grid; }
  .mobile-nav { display: grid; grid-template-columns: repeat(4, 1fr); position: fixed; left: 10px; right: 10px; bottom: 10px; z-index: 20; background: rgba(17,19,19,.96); border: 1px solid var(--line); border-radius: var(--radius); }
}
```

- [ ] **Step 5: Run the static tests and commit**

Run: `node --test tests/dashboard-html.test.js`

Expected: 2 tests PASS.

```bash
git add apps-script/DashboardStyles.html apps-script/DashboardComponents.html tests/dashboard-html.test.js
git commit -m "feat: add responsive XSTEAM dashboard shell"
```

---

### Task 6: Client Navigation, Rendering, Filters, Charts, and States

**Files:**
- Create: `apps-script/DashboardClient.html`
- Modify: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: `obterDadosPaginaDashboard(page, filters)` through `google.script.run`.
- Produces: `navigate(page)`, `loadPage()`, `renderDashboard(response)`, `renderError(error)`, `renderEmpty()`.

- [ ] **Step 1: Extend the static contract test before client code**

Add assertions that `DashboardClient.html` contains `withSuccessHandler`, `withFailureHandler`, `obterDadosPaginaDashboard`, `Chart`, `textContent`, and does not contain `innerHTML =`.

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test tests/dashboard-html.test.js`

Expected: FAIL because `DashboardClient.html` does not exist.

- [ ] **Step 3: Implement state and safe DOM helpers**

Create `apps-script/DashboardClient.html` as a `<script>` partial. Define:

```javascript
const state = { page: 'vencimentos', filters: {}, charts: [] };
const pageLabels = { vencimentos: 'Vencimentos dos alunos', fichas: 'Fichas prescritas', avaliacoes: 'Avaliações físicas', planos: 'Planos dos alunos' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
}

function clearNode(node) { node.replaceChildren(); }
function destroyCharts() { state.charts.forEach(chart => chart.destroy()); state.charts = []; }
function money(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0); }
function number(value) { return new Intl.NumberFormat('pt-BR').format(Number(value) || 0); }
```

- [ ] **Step 4: Implement navigation and loading states**

All elements with `[data-page]` call `navigate(button.dataset.page)`. `navigate` updates `.active`, `aria-current`, `pageTitle`, `state.page`, then calls `loadPage`. `loadPage` displays the loading state and calls:

```javascript
google.script.run
  .withSuccessHandler(renderDashboard)
  .withFailureHandler(renderError)
  .obterDadosPaginaDashboard(state.page, state.filters);
```

`renderError` must show only `Não foi possível carregar esta página.` and a `Tentar novamente` button. `renderEmpty` must show `Nenhum resultado para os filtros selecionados.` and a `Limpar filtros` button.

- [ ] **Step 5: Implement cards, Chart.js graphs, desktop table, and mobile cards**

Render with `createElement` and `textContent`. Never interpolate names or contacts into HTML strings. Use `Chart` with colors `#dfff22`, `#9daa29`, `#505a25`, `#ffb84d`, `#ff6b5f`; set `responsive: true`, `maintainAspectRatio: false`, dark tick colors, no animation when `prefers-reduced-motion` is active.

Render the page-specific KPIs from these key maps:

```javascript
const kpiMaps = {
  vencimentos: [['vencidos','Vencidos','number'],['ate7','Vencem em 7 dias','number'],['ate30','Vencem em 30 dias','number'],['valorAte30','Valor a renovar','money']],
  fichas: [['atualizadas','Com ficha atualizada','number'],['ausentes','Sem ficha','number'],['desatualizadas','Ficha desatualizada','number'],['cobertura','Cobertura','percent']],
  avaliacoes: [['atualizadas','Com avaliação atualizada','number'],['ausentes','Sem avaliação','number'],['desatualizadas','Avaliação desatualizada','number'],['cobertura','Cobertura','percent']],
  planos: [['alunos','Alunos distintos','number'],['contratos','Contratos','number'],['valor','Valor contratado','money'],['ticketMedio','Ticket médio','money']]
};
```

Mask contacts on mobile with `contact.replace(/\d(?=\d{2})/g, '•')`. Desktop tables may show the full contact to authorized users. When `dados.lista.length === 0`, call `renderEmpty()`.

- [ ] **Step 6: Add filters and preserve them by page**

Maintain `state.filtersByPage = {}`. Build selects only from values supplied in `dados.filtros`. On change, save `state.filtersByPage[state.page]` and reload. The initial implementation must support `polo` and `statusAluno`; page-specific values can be added without changing the shell.

- [ ] **Step 7: Run HTML tests and commit**

Run: `node --test tests/dashboard-html.test.js`

Expected: all tests PASS.

```bash
git add apps-script/DashboardClient.html tests/dashboard-html.test.js
git commit -m "feat: render interactive dashboard pages"
```

---

### Task 7: Complete Filter Data, Import Warning, and Full Regression Suite

**Files:**
- Modify: `apps-script/10_DashboardPaginas.gs`
- Modify: `apps-script/12_DashboardApi.gs`
- Modify: `tests/dashboard-paginas.test.js`
- Modify: `tests/dashboard-api.test.js`

**Interfaces:**
- Produces page `filtros` as `{ polos: string[], statusAlunos: string[] }`, applies `{ polo?: string, statusAluno?: string }`, and returns `avisoImportacao` without personal data.

- [ ] **Step 1: Add failing assertions for sorted filter options and import warning**

Assert that polo options are unique, sorted with `localeCompare('pt-BR')`, selecting `polo: 'POLO A'` removes contracts and students outside that polo, selecting `statusAluno: 'Ativo'` removes other students and their contracts, and a failed latest import produces only a generic warning containing its date, not its raw `mensagem` field.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/dashboard-paginas.test.js tests/dashboard-api.test.js`

Expected: FAIL on missing filter arrays and warning.

- [ ] **Step 3: Add filter option helpers and safe warning logic**

Add:

```javascript
function opcoesDashboard_(linhas, campo) {
  return Array.from(new Set((linhas || []).map(function (linha) { return String(linha[campo] || '').trim(); }).filter(Boolean)))
    .sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
}

function filtrarBaseDashboard_(alunos, contratos, filtros) {
  filtros = filtros || {};
  var alunosFiltrados = (alunos || []).filter(function (aluno) {
    return !filtros.statusAluno || String(aluno.status || '') === filtros.statusAluno;
  });
  var idsPermitidos = alunosFiltrados.reduce(function (acc, aluno) {
    acc[String(aluno.id)] = true;
    return acc;
  }, {});
  var contratosFiltrados = (contratos || []).filter(function (contrato) {
    return idsPermitidos[String(contrato.id)] &&
      (!filtros.polo || String(contrato.polo || '') === filtros.polo);
  });
  if (filtros.polo) {
    var idsComContrato = contratosFiltrados.reduce(function (acc, contrato) {
      acc[String(contrato.id)] = true;
      return acc;
    }, {});
    alunosFiltrados = alunosFiltrados.filter(function (aluno) {
      return idsComContrato[String(aluno.id)];
    });
  }
  return { alunos: alunosFiltrados, contratos: contratosFiltrados };
}
```

In `obterDadosPaginaDashboard`, calculate `opcoes` from the original arrays, call `filtrarBaseDashboard_`, pass the filtered arrays to the selected builder, and then assign `dados.filtros = opcoes`. This guarantees that every visible component uses the same filtered population while the controls retain all valid choices:

```javascript
var opcoes = {
  polos: opcoesDashboard_(base.contratos, 'polo'),
  statusAlunos: opcoesDashboard_(base.alunos, 'status')
};
var filtrada = filtrarBaseDashboard_(base.alunos, base.contratos, filtros);
var dados = construtores[pagina](filtrada.alunos, filtrada.contratos, hoje);
dados.filtros = opcoes;
```

Add this repository function:

```javascript
function obterUltimoRegistroImportacaoDashboard_() {
  var aba = obterAbaImportacoes_();
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return null;
  var linha = aba.getRange(ultimaLinha, 1, 1, CONFIG.cabecalhos.importacoes.length).getDisplayValues()[0];
  return { concluidaEm: linha[2], dataReferencia: linha[6], status: linha[11] };
}
```

`lerBaseDashboard_` returns that record as `ultimaTentativa`. The API sets:

```javascript
var aviso = base.ultimaTentativa && base.ultimaTentativa.status === 'ERRO'
  ? 'A última tentativa de atualização falhou em ' + (base.ultimaTentativa.concluidaEm || base.ultimaTentativa.dataReferencia) + '. Exibindo a última base válida.'
  : '';
```

Return `avisoImportacao: aviso`. Never return the raw import `mensagem`.

- [ ] **Step 4: Run the entire suite**

Run: `npm test`

Expected: all existing importer tests and all dashboard tests PASS.

- [ ] **Step 5: Commit the integration hardening**

```bash
git add apps-script/10_DashboardPaginas.gs apps-script/12_DashboardApi.gs tests/dashboard-paginas.test.js tests/dashboard-api.test.js
git commit -m "feat: add dashboard filters and import health warning"
```

---

### Task 8: Deployment Documentation and Real-Data Validation

**Files:**
- Modify: `apps-script/INSTRUCOES_INSTALACAO.md`
- Modify: `LEIA-ME.md`

**Interfaces:**
- Produces a repeatable Apps Script deployment procedure and acceptance checklist.

- [ ] **Step 1: Document the exact deployment procedure**

Add a `Publicação do dashboard` section instructing the operator to copy files `09_DashboardMetricas.gs` through `12_DashboardApi.gs` and the four `Dashboard*.html` files, then choose **Implantar > Nova implantação > Aplicativo da Web**, execute as the owner, restrict access to the intended Google Workspace users, authorize scopes, copy the `/exec` URL, and open it in desktop and mobile browsers.

- [ ] **Step 2: Add the acceptance checklist**

Document these checks verbatim:

```markdown
- [ ] A página abre sem solicitar acesso público à planilha.
- [ ] As quatro áreas abrem no desktop e no celular.
- [ ] A data da última importação aparece corretamente.
- [ ] Um aluno com vários contratos conta uma vez em indicadores de alunos.
- [ ] O mesmo contrato não duplica valores.
- [ ] Vencimentos de 7 e 30 dias conferem com uma amostra manual.
- [ ] Fichas sem data aparecem como ausentes; fichas com mais de 30 dias, como desatualizadas.
- [ ] Avaliações sem data aparecem como ausentes; avaliações com mais de 90 dias, como desatualizadas.
- [ ] Busca e filtros atualizam cartões, gráficos e lista.
- [ ] Telefones ficam parcialmente ocultos nos cartões do celular.
- [ ] Nenhuma mensagem de erro exibe nomes ou contatos.
```

- [ ] **Step 3: Run automated verification**

Run: `npm test`

Expected: zero failures.

Run: `npm run validate:real -- --dir /tmp/tecnofit-validacao`

Expected: validation succeeds without modifying the master spreadsheet. Before running, place the three authorized weekly exports in `/tmp/tecnofit-validacao`; delete that temporary copy after validation and do not commit files or output containing student data.

- [ ] **Step 4: Perform manual visual verification**

Open the deployed `/exec` URL at 1440×900, 1024×768 and 390×844. Verify the sidebar-to-bottom-nav transition, KPI scrolling, chart stacking, mobile cards, focus visibility, reduced motion, loading, empty and error states.

- [ ] **Step 5: Update the project status and commit**

Change `LEIA-ME.md` section 14 to state that the dashboard code is implemented and awaiting or has completed deployment, matching the actual state at that moment.

```bash
git add apps-script/INSTRUCOES_INSTALACAO.md LEIA-ME.md
git commit -m "docs: add dashboard deployment and verification guide"
```

---

## Final Verification

Run:

```bash
npm test
```

Expected: every importer and dashboard test passes with zero failures.

Confirm that only synthetic fixtures exist under `tests/`, no `.xls` exports or real student data are staged, and the Apps Script deployment is restricted to authorized users.
