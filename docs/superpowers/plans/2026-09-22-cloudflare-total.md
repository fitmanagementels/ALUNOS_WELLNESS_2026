# Migração Integral para Cloudflare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hospedar frontend, backend, autenticação, banco e arquivos do XSTEAM Gestão no Cloudflare, preservando todos os dados e mantendo GitHub apenas como backup do código.

**Architecture:** Um único Worker entrega o PWA por Static Assets e atende `/api/*`; D1 substitui Google Sheets e R2 substitui Drive para arquivos operacionais. Cloudflare Access protege produção e previews com Google, e a API valida o JWT do Access e uma allowlist de dois e-mails.

**Tech Stack:** JavaScript ES modules, Cloudflare Workers, Workers Static Assets, D1/SQLite, R2, Cloudflare Access, Google OAuth, Wrangler, Node.js 20+, `node:test`, IndexedDB e Git.

## Global Constraints

- Produção deve usar somente um endereço gratuito `workers.dev`; não comprar domínio.
- Autorizar exclusivamente `fitmanagement.els@gmail.com` e `elohimlima15@gmail.com`.
- Não ativar plano pago nem cobrança automática.
- GitHub não participa do runtime nem do deploy; recebe somente backup versionado após validação.
- Não versionar planilhas reais, contatos, bancos exportados, tokens ou segredos.
- ID TecnoFit é a chave de conciliação; campos manuais nunca são apagados por importação.
- Dados oficiais prevalecem nos campos de plano; repetidos usam o vencimento mais recente sem inferir status pela data.
- Os quatro relatórios TecnoFit formam um lote indivisível com a mesma data e revisão.
- Fichas e avaliações permanecem processos independentes.
- Toda gravação do PWA deve ser otimista, idempotente e não bloquear a interface.
- O sistema antigo permanece intacto e disponível até o corte aprovado.
- Toda mudança usa TDD, `npm test` e commit pequeno.

---

## Mapa de arquivos

| Caminho | Responsabilidade |
|---|---|
| `worker/wrangler.jsonc` | Worker, Static Assets, D1, R2, variáveis e ambiente local |
| `worker/migrations/*.sql` | Esquema D1 versionado |
| `worker/src/index.js` | Entrada HTTP e entrega de assets |
| `worker/src/http.js` | Respostas JSON e erros seguros |
| `worker/src/auth.js` | Validação JWT do Access e allowlist |
| `worker/src/router.js` | Roteamento das ações da API |
| `worker/src/repositories/*.js` | Acesso exclusivo ao D1 |
| `worker/src/services/*.js` | Bootstrap, mutações, análises e importações |
| `worker/src/imports/*.js` | Validação, estágio, prévia e promoção dos lotes |
| `pwa/js/api.js` | Cliente same-origin da API |
| `pwa/js/sync-queue.js` | Fila IndexedDB idempotente e retentativas |
| `pwa/js/import-parser-entry.js` | Leitura local de XLS/XLSX e normalização |
| `pwa/js/imports.js` | Interface e fluxo da importação |
| `scripts/build-pwa.js` | Bundle local do parser, sem CDN em produção |
| `scripts/build-d1-seed.js` | Conversão de exportação privada para SQL temporário |
| `scripts/reconcile-d1.js` | Comparação da origem com D1 sem expor dados |
| `scripts/restore-r2-backup.js` | Restauração testável de um snapshot R2 |
| `tests/cloudflare/*.test.js` | Contratos do novo runtime |
| `docs/operacao/MIGRACAO_CLOUDFLARE.md` | Procedimento, corte, rollback e recuperação |

## Fase 1 — Fundação isolada e segura

### Task 1: Configurar Worker único com assets, D1 e R2 locais

**Files:**
- Modify: `worker/package.json`
- Modify: `worker/wrangler.jsonc`
- Create: `worker/src/http.js`
- Create: `tests/cloudflare/runtime-config.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces: bindings `DB`, `FILES`, `ASSETS`; `json(data, status)` e `apiError(code, message, status)`.
- Consumes: pasta existente `pwa/` como origem de Static Assets.

- [ ] **Step 1: Escrever teste que exige bindings, rotas e exclusão do estado local**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('runtime Cloudflare usa assets, D1 e R2 sem upstream Google', () => {
  const config = fs.readFileSync('worker/wrangler.jsonc', 'utf8');
  assert.match(config, /"directory"\s*:\s*"\.\.\/pwa"/);
  assert.match(config, /"binding"\s*:\s*"DB"/);
  assert.match(config, /"binding"\s*:\s*"FILES"/);
  assert.doesNotMatch(config, /APPS_SCRIPT/);
  assert.match(fs.readFileSync('.gitignore', 'utf8'), /worker\/\.wrangler\//);
});
```

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `node --test tests/cloudflare/runtime-config.test.js`

Expected: FAIL porque D1, R2, Static Assets e a regra de ignore ainda não estão definidos.

- [ ] **Step 3: Configurar o runtime**

Usar `xsteam-gestao` como nome do novo Worker. Configurar `assets.directory` como `../pwa`, binding `ASSETS` e `run_worker_first` para `/api/*`; adicionar os bindings `DB` e `FILES`. Usar IDs locais provisórios somente no arquivo de exemplo e inserir os IDs reais retornados pelo Wrangler antes do primeiro deploy.

```jsonc
{
  "name": "xsteam-gestao",
  "main": "src/index.js",
  "compatibility_date": "2026-09-22",
  "assets": {
    "directory": "../pwa",
    "binding": "ASSETS",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [{
    "binding": "DB",
    "database_name": "xsteam-gestao",
    "database_id": "LOCAL_DATABASE_ID",
    "migrations_dir": "migrations"
  }],
  "r2_buckets": [{
    "binding": "FILES",
    "bucket_name": "xsteam-gestao-files"
  }],
  "vars": {
    "ALLOWED_EMAILS": "fitmanagement.els@gmail.com,elohimlima15@gmail.com"
  }
}
```

Adicionar `worker/.wrangler/` ao `.gitignore`. Remover do runtime as variáveis `APPS_SCRIPT_WEBAPP_URL` e `APPS_SCRIPT_SHARED_SECRET` apenas no novo Worker; o Worker antigo continua intacto durante a migração.

- [ ] **Step 4: Implementar respostas seguras**

```js
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export function apiError(code, message, status) {
  return json({ ok: false, error: { code, message } }, status);
}
```

- [ ] **Step 5: Executar e versionar**

Run: `node --test tests/cloudflare/runtime-config.test.js && npm test`

Expected: todos os testes aprovados.

```bash
git add .gitignore worker/package.json worker/wrangler.jsonc worker/src/http.js tests/cloudflare/runtime-config.test.js
git commit -m "build: preparar runtime cloudflare completo"
```

### Task 2: Criar esquema D1 e migrações auditáveis

**Files:**
- Create: `worker/migrations/0001_core.sql`
- Create: `worker/migrations/0002_indexes.sql`
- Create: `tests/cloudflare/schema.test.js`

**Interfaces:**
- Produces: tabelas relacionais identificadas por `student_id` e `version_id`.
- Consumes: nomes de campos de `apps-script/00_Config.gs`.

- [ ] **Step 1: Escrever teste estrutural do esquema**

O teste deve carregar os dois SQL e exigir, nominalmente, `students`, `contracts`, `prescriptions`, `assessments`, `permanence`, `permanence_events`, `student_profiles`, `student_last_teachers`, `tags`, `student_tags`, `leads`, `churns`, `new_students`, `settings`, `import_batches`, `import_files`, `import_rows`, `import_errors`, `mutation_log`, `data_versions` e `usage_counters`. Também deve exigir chaves estrangeiras e índices para ID, vencimento, datas de fluxo e versão ativa.

- [ ] **Step 2: Confirmar a falha**

Run: `node --test tests/cloudflare/schema.test.js`

Expected: FAIL por ausência das migrações.

- [ ] **Step 3: Criar `0001_core.sql`**

Definir `PRAGMA foreign_keys = ON`; datas em ISO `YYYY-MM-DD`; instantes em UTC ISO; dinheiro em centavos inteiros. Separar campos oficiais dos manuais. Usar `ON DELETE RESTRICT` para alunos e `ON DELETE CASCADE` somente nas relações dependentes sem valor autônomo.

Contratos mínimos obrigatórios:

```sql
CREATE TABLE students (
  student_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  plan_started_on TEXT,
  prescription_on TEXT,
  assessment_on TEXT,
  source_version_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE student_profiles (
  student_id TEXT PRIMARY KEY REFERENCES students(student_id) ON DELETE RESTRICT,
  responsible_teacher TEXT NOT NULL DEFAULT '',
  payment_profile TEXT NOT NULL DEFAULT '',
  payment_notes TEXT NOT NULL DEFAULT '',
  general_notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE mutation_log (
  request_id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  mutation_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  result_json TEXT NOT NULL
);

CREATE TABLE data_versions (
  version_id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_date TEXT NOT NULL,
  revision INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('staging','active','superseded','rejected')),
  created_at TEXT NOT NULL,
  activated_at TEXT,
  UNIQUE(reference_date, revision)
);
```

Adicionar no mesmo arquivo este contrato explícito para as demais entidades; campos JSON armazenam arrays de strings validados na borda da API:

```sql
CREATE TABLE contracts (
  contract_key TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL DEFAULT '', frequency TEXT NOT NULL DEFAULT '',
  value_cents INTEGER NOT NULL DEFAULT 0, current_started_on TEXT, expires_on TEXT,
  contract_status TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '',
  modality TEXT NOT NULL DEFAULT '', source_version_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE prescriptions (
  student_id TEXT PRIMARY KEY REFERENCES students(student_id) ON DELETE RESTRICT,
  started_on TEXT, source_version_id INTEGER NOT NULL
);
CREATE TABLE assessments (
  student_id TEXT PRIMARY KEY REFERENCES students(student_id) ON DELETE RESTRICT,
  assessed_on TEXT, source_version_id INTEGER NOT NULL
);
CREATE TABLE permanence (
  student_id TEXT PRIMARY KEY REFERENCES students(student_id) ON DELETE RESTRICT,
  customer_since TEXT, permanence_status TEXT NOT NULL DEFAULT '',
  source_continuity_months INTEGER, source_contract_count INTEGER,
  first_seen_on TEXT, last_seen_on TEXT, present_in_latest_batch INTEGER NOT NULL DEFAULT 0,
  source_version_id INTEGER NOT NULL
);
CREATE TABLE permanence_events (
  event_id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,
  reference_date TEXT NOT NULL, event_type TEXT NOT NULL, field_name TEXT NOT NULL,
  previous_value TEXT NOT NULL DEFAULT '', new_value TEXT NOT NULL DEFAULT '',
  source_version_id INTEGER NOT NULL, recorded_at TEXT NOT NULL
);
CREATE TABLE student_last_teachers (
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  teacher_name TEXT NOT NULL, position INTEGER NOT NULL,
  PRIMARY KEY(student_id, teacher_name)
);
CREATE TABLE tag_groups (group_key TEXT PRIMARY KEY, title TEXT NOT NULL, position INTEGER NOT NULL);
CREATE TABLE tags (
  tag_key TEXT PRIMARY KEY, group_key TEXT NOT NULL REFERENCES tag_groups(group_key) ON DELETE RESTRICT,
  title TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, position INTEGER NOT NULL
);
CREATE TABLE student_tags (
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  tag_key TEXT NOT NULL REFERENCES tags(tag_key) ON DELETE RESTRICT,
  PRIMARY KEY(student_id, tag_key)
);
CREATE TABLE leads (
  lead_id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL, origin TEXT NOT NULL DEFAULT '',
  referral TEXT NOT NULL DEFAULT '', first_contact_on TEXT NOT NULL, trial_on TEXT,
  trial_teacher TEXT NOT NULL DEFAULT '', became_customer_on TEXT, status TEXT NOT NULL,
  contracted_plan TEXT NOT NULL DEFAULT '', package_value_cents INTEGER,
  sales_report TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE TABLE churns (
  churn_id TEXT PRIMARY KEY, student_id TEXT NOT NULL, official_name TEXT NOT NULL,
  official_phone TEXT NOT NULL DEFAULT '', official_exit_on TEXT NOT NULL,
  official_contract TEXT NOT NULL DEFAULT '', official_value_cents INTEGER,
  official_started_on TEXT, official_expires_on TEXT, responsible_professional TEXT NOT NULL DEFAULT '',
  last_teacher TEXT NOT NULL DEFAULT '', manual_exit_reason TEXT NOT NULL DEFAULT '',
  manual_context TEXT NOT NULL DEFAULT '', manual_retention_action TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT
);
CREATE TABLE new_students (
  entry_id TEXT PRIMARY KEY, student_id TEXT NOT NULL, official_name TEXT NOT NULL,
  official_phone TEXT NOT NULL DEFAULT '', official_entry_on TEXT NOT NULL,
  official_contract TEXT NOT NULL DEFAULT '', official_value_cents INTEGER,
  source_batch_id TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE settings (
  setting_type TEXT NOT NULL, setting_key TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0, value_json TEXT NOT NULL DEFAULT '{}',
  title TEXT NOT NULL DEFAULT '', states_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY(setting_type, setting_key)
);
CREATE TABLE import_batches (
  batch_id TEXT PRIMARY KEY, import_kind TEXT NOT NULL, reference_date TEXT NOT NULL,
  revision INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('staging','ready','active','rejected')),
  actor_email TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE import_files (
  file_id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES import_batches(batch_id) ON DELETE CASCADE,
  file_kind TEXT NOT NULL, original_name TEXT NOT NULL, r2_key TEXT NOT NULL,
  sha256 TEXT NOT NULL, rows_read INTEGER NOT NULL DEFAULT 0,
  rows_valid INTEGER NOT NULL DEFAULT 0, rows_rejected INTEGER NOT NULL DEFAULT 0,
  UNIQUE(batch_id, file_kind)
);
CREATE TABLE import_rows (
  batch_id TEXT NOT NULL REFERENCES import_batches(batch_id) ON DELETE CASCADE,
  file_kind TEXT NOT NULL, row_number INTEGER NOT NULL, student_id TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL, valid INTEGER NOT NULL, error_code TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(batch_id, file_kind, row_number)
);
CREATE TABLE import_errors (
  error_id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL REFERENCES import_batches(batch_id) ON DELETE CASCADE,
  file_kind TEXT NOT NULL, row_number INTEGER, error_code TEXT NOT NULL,
  safe_message TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE usage_counters (
  usage_day TEXT NOT NULL, metric TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
  PRIMARY KEY(usage_day, metric)
);
```

- [ ] **Step 4: Criar índices em `0002_indexes.sql`**

```sql
CREATE INDEX idx_students_status_name ON students(status, name);
CREATE INDEX idx_contracts_student_expiry ON contracts(student_id, expires_on DESC);
CREATE INDEX idx_churns_student_exit ON churns(student_id, official_exit_on DESC);
CREATE INDEX idx_leads_first_contact ON leads(first_contact_on DESC);
CREATE INDEX idx_import_batches_status_created ON import_batches(status, created_at DESC);
CREATE UNIQUE INDEX idx_data_versions_one_active ON data_versions(status) WHERE status = 'active';
```

- [ ] **Step 5: Aplicar localmente, testar e versionar**

Run: `cd worker && npx wrangler d1 migrations apply xsteam-gestao --local`

Expected: duas migrações aplicadas sem erro.

Run: `cd .. && node --test tests/cloudflare/schema.test.js && npm test`

```bash
git add worker/migrations tests/cloudflare/schema.test.js
git commit -m "feat: criar esquema relacional d1"
```

### Task 3: Validar Cloudflare Access e os dois e-mails

**Files:**
- Modify: `worker/package.json`
- Create: `worker/src/auth.js`
- Create: `tests/cloudflare/auth.test.js`

**Interfaces:**
- Produces: `authenticate(request, env): Promise<{email: string}>`.
- Consumes: `Cf-Access-Jwt-Assertion`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ALLOWED_EMAILS`.

- [ ] **Step 1: Instalar verificador JWT com versão fixada no lockfile**

Run: `cd worker && npm install --save-exact jose`

Expected: `worker/package-lock.json` criado ou atualizado.

- [ ] **Step 2: Escrever testes de ausência, assinatura, audiência e allowlist**

Injetar `jwtVerify` e `createRemoteJWKSet` nas dependências do módulo para que o teste não use rede. Exigir `AUTH_REQUIRED` sem token, `AUTH_INVALID` com assinatura/audiência inválida, `FORBIDDEN_EMAIL` para terceiro e identidade normalizada para os dois e-mails aprovados.

- [ ] **Step 3: Implementar autenticação**

```js
import { createRemoteJWKSet, jwtVerify } from 'jose';

export async function authenticate(request, env, deps = {}) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw Object.assign(new Error('Autenticação necessária.'), { code: 'AUTH_REQUIRED', status: 401 });
  const verify = deps.jwtVerify || jwtVerify;
  const makeJwks = deps.createRemoteJWKSet || createRemoteJWKSet;
  const team = String(env.ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const issuer = `https://${team}`;
  const { payload } = await verify(token, makeJwks(new URL(`${issuer}/cdn-cgi/access/certs`)), {
    issuer,
    audience: env.ACCESS_AUD
  });
  const email = String(payload.email || '').trim().toLowerCase();
  const allowed = String(env.ALLOWED_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(email)) throw Object.assign(new Error('Conta sem acesso.'), { code: 'FORBIDDEN_EMAIL', status: 403 });
  return { email };
}
```

Envolver erros da biblioteca em `AUTH_INVALID`, sem devolver conteúdo do token.

- [ ] **Step 4: Testar e versionar**

Run: `node --test tests/cloudflare/auth.test.js && npm test`

```bash
git add worker/package.json worker/package-lock.json worker/src/auth.js tests/cloudflare/auth.test.js
git commit -m "feat: proteger api com identidade cloudflare access"
```

## Fase 2 — Backend e dados no D1

### Task 4: Portar o contrato de leitura e bootstrap

**Files:**
- Create: `worker/src/repositories/dashboard-repository.js`
- Create: `worker/src/services/bootstrap-service.js`
- Create: `worker/src/router.js`
- Modify: `worker/src/index.js`
- Create: `tests/cloudflare/bootstrap.test.js`
- Create: `tests/cloudflare/router.test.js`

**Interfaces:**
- Produces: `buildBootstrap(db)` com o mesmo formato consumido pelo PWA atual.
- Produces: ações `bootstrap`, `versao` e `analiseChurn` em `POST /api`.
- Consumes: `authenticate()` e bindings D1/Assets.

- [ ] **Step 1: Fixar o contrato atual em teste**

O fixture esperado deve conter `versao`, `atualizadoEm`, `filtrosPadrao`, `configuracao`, `alunos`, `contratos`, `permanencia`, `eventosPermanencia`, `perfisAlunos`, `catalogoPerfisAlunos` e `fluxo` com `leads` e `churns`. Exigir nomes de propriedades idênticos aos usados hoje no PWA.

- [ ] **Step 2: Confirmar a falha**

Run: `node --test tests/cloudflare/bootstrap.test.js tests/cloudflare/router.test.js`

- [ ] **Step 3: Implementar repositório com consultas indexadas**

Cada função do repositório recebe `db`; não acessa `env` global. Executar consultas independentes com `Promise.all`, converter centavos em número decimal somente no adaptador e reconstruir listas de professores/etiquetas por `student_id`.

Assinaturas obrigatórias:

```js
export async function readStudents(db) {}
export async function readContracts(db) {}
export async function readPermanence(db) {}
export async function readProfiles(db) {}
export async function readCatalog(db) {}
export async function readFlow(db) {}
export async function readSettings(db) {}
export async function readActiveVersion(db) {}
```

- [ ] **Step 4: Implementar roteador e fallback de assets**

`/api` aceita somente `POST`; autentica antes de ler o corpo; limita corpo JSON a 1 MiB; despacha apenas as quatro ações atuais. Qualquer caminho fora de `/api` usa `env.ASSETS.fetch(request)`. Remover proxy, CORS, rate bucket em memória e dependências do Apps Script do novo `index.js`.

- [ ] **Step 5: Testar e versionar**

Run: `node --test tests/cloudflare/bootstrap.test.js tests/cloudflare/router.test.js && npm test`

```bash
git add worker/src tests/cloudflare/bootstrap.test.js tests/cloudflare/router.test.js
git commit -m "feat: servir bootstrap pelo d1"
```

### Task 5: Portar mutações idempotentes e análise de churn

**Files:**
- Create: `worker/src/repositories/mutation-repository.js`
- Create: `worker/src/services/mutation-service.js`
- Create: `worker/src/services/churn-analysis-service.js`
- Modify: `worker/src/router.js`
- Create: `tests/cloudflare/mutations.test.js`
- Create: `tests/cloudflare/churn-analysis.test.js`

**Interfaces:**
- Produces: `saveMutations(db, actor, {requestId, patches})`.
- Produces: `analyzeChurn(db, filters)`.
- Consumes: tipos atuais `configDashboard`, `configAlertas`, `perfilPagamento`, `perfilAluno`, `fluxoLead`, `fluxoChurn`, `excluirFluxoChurn`.

- [ ] **Step 1: Escrever testes por tipo de patch**

Cobrir validação, criação, atualização, arquivamento de churn, professor responsável, múltiplos últimos professores, etiquetas, `Coach`, `Performance`, lead e repetição do mesmo `requestId`. A segunda chamada deve retornar o resultado armazenado sem escrever novamente.

- [ ] **Step 2: Confirmar a falha**

Run: `node --test tests/cloudflare/mutations.test.js tests/cloudflare/churn-analysis.test.js`

- [ ] **Step 3: Implementar validação pura**

Portar limites e catálogos de `apps-script/14_DashboardMutacoes.gs` para funções puras. Manter limites atuais de tamanho, datas brasileiras na borda da API e ISO no D1. Converter exclusão de churn em `archived_at`, não `DELETE`.

- [ ] **Step 4: Implementar lote transacional D1**

Primeiro consultar `mutation_log` por `request_id`. Para uma operação nova, gerar statements preparados de todos os patches e finalizar o mesmo `db.batch()` com a inserção do log. O `actor_email` vem exclusivamente de `authenticate()`.

- [ ] **Step 5: Portar a análise temporal**

Reproduzir os totais mensais/semanais e os filtros atuais usando SQL por intervalo. Datas devem ser inclusivas no início e fim, com conversão explícita para `America/Fortaleza` na apresentação.

- [ ] **Step 6: Testar e versionar**

Run: `node --test tests/cloudflare/mutations.test.js tests/cloudflare/churn-analysis.test.js && npm test`

```bash
git add worker/src tests/cloudflare/mutations.test.js tests/cloudflare/churn-analysis.test.js
git commit -m "feat: portar mutacoes e churn para d1"
```

### Task 6: Criar migração privada e relatório de reconciliação

**Files:**
- Create: `scripts/build-d1-seed.js`
- Create: `scripts/reconcile-d1.js`
- Create: `tests/cloudflare/data-migration.test.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces: SQL temporário fora do repositório a partir de exportações JSON/CSV.
- Produces: relatório somente com contagens e IDs divergentes, sem telefones ou observações.
- Consumes: exportações das abas atuais e schema D1.

- [ ] **Step 1: Escrever fixture sintético e testes de precedência**

Criar dados falsos com ID repetido, dois vencimentos, perfil manual, múltiplos professores, lead e churn. Exigir que o maior vencimento vença nos dados oficiais e que todos os campos manuais permaneçam.

- [ ] **Step 2: Implementar gerador seguro**

O comando deve exigir `--input` e `--output`; recusar saída dentro do repositório; escapar aspas SQL; usar centavos; emitir `BEGIN TRANSACTION` e `COMMIT`; nunca imprimir linhas reais no terminal.

Run esperado:

```bash
node scripts/build-d1-seed.js --input /tmp/xsteam-export --output /tmp/xsteam-seed.sql
```

- [ ] **Step 3: Implementar reconciliação**

Comparar por tabela: total de linhas, IDs distintos, IDs ausentes, IDs extras, somas financeiras em centavos e hashes de campos manuais. Sair com código `1` diante de qualquer divergência crítica.

- [ ] **Step 4: Testar e versionar**

Run: `node --test tests/cloudflare/data-migration.test.js && npm test`

```bash
git add .gitignore scripts/build-d1-seed.js scripts/reconcile-d1.js tests/cloudflare/data-migration.test.js
git commit -m "feat: preparar migracao auditavel para d1"
```

## Fase 3 — PWA no mesmo Worker e importações

### Task 7: Mudar o PWA para API same-origin sem quebrar a fila atual

**Files:**
- Modify: `pwa/js/api.js`
- Modify: `pwa/js/config.js`
- Modify: `pwa/index.html`
- Modify: `pwa/sw.js`
- Modify: `tests/pwa-shell.test.js`
- Create: `tests/cloudflare/pwa-api.test.js`

**Interfaces:**
- Produces: `XsteamApi.call(action, payload)` via `/api` com `credentials: 'same-origin'`.
- Consumes: contrato compatível entregue pela Task 4.

- [ ] **Step 1: Escrever teste de same-origin**

Exigir `fetch('/api', ...)`, credenciais de mesma origem e ausência de `workerUrl`, runtime-config e CORS.

- [ ] **Step 2: Confirmar a falha**

Run: `node --test tests/cloudflare/pwa-api.test.js tests/pwa-shell.test.js`

- [ ] **Step 3: Alterar o cliente**

```js
var response = await fetch('/api', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  credentials: 'same-origin',
  body: JSON.stringify({ action: action, payload: payload || {} })
});
```

Remover `runtime-config.js` do HTML e do cache. Incrementar o cache para `xsteam-static-v13`.

- [ ] **Step 4: Testar e versionar**

Run: `node --test tests/cloudflare/pwa-api.test.js tests/pwa-shell.test.js && npm test`

```bash
git add pwa tests/cloudflare/pwa-api.test.js tests/pwa-shell.test.js
git commit -m "feat: conectar pwa a api same-origin"
```

### Task 8: Fortalecer a fila IndexedDB e o fluxo contínuo

**Files:**
- Create: `pwa/js/sync-queue.js`
- Modify: `pwa/js/dashboard.js`
- Modify: `pwa/js/student-profiles.js`
- Modify: `pwa/index.html`
- Modify: `pwa/sw.js`
- Create: `tests/cloudflare/sync-queue.test.js`

**Interfaces:**
- Produces: `XsteamSync.enqueue(patches)`, `flush()`, `subscribe(listener)` e `clearForLogout()`.
- Consumes: `XsteamApi.call('salvarMutacoes', lote)`.

- [ ] **Step 1: Testar persistência, idempotência e backoff**

Usar adaptador de armazenamento injetável no Node. Exigir UUID estável, FIFO, uma operação em voo, repetição em `1s, 2s, 4s, 8s, 30s`, remoção só após confirmação e preservação após recriar a instância.

- [ ] **Step 2: Implementar IndexedDB `xsteam-sync-v1`**

Criar object store `outbox` com chave `requestId` e índice `createdAt`. Cada item contém somente `requestId`, `patches`, `createdAt`, `attempts` e `nextAttemptAt`.

- [ ] **Step 3: Integrar sem bloquear modais ou listas**

Aplicar patch otimista, chamar `enqueue`, fechar o modal imediatamente e preservar `profilesExpanded`, busca, ordenação e scroll. Mostrar somente indicador global `Salvando`, `Salvo` ou `Alterações pendentes`.

- [ ] **Step 4: Testar e versionar**

Run: `node --test tests/cloudflare/sync-queue.test.js tests/student-profiles.test.js && npm test`

```bash
git add pwa tests/cloudflare/sync-queue.test.js tests/student-profiles.test.js
git commit -m "feat: persistir fila de sincronizacao no pwa"
```

### Task 9: Implementar leitura local dos relatórios e upload ao R2

**Files:**
- Modify: `package.json`
- Create: `scripts/build-pwa.js`
- Create: `pwa/js/import-parser-entry.js`
- Create generated: `pwa/js/import-parser.js`
- Create: `pwa/js/imports.js`
- Modify: `pwa/index.html`
- Create: `worker/src/imports/validation.js`
- Create: `worker/src/services/import-service.js`
- Modify: `worker/src/router.js`
- Create: `tests/cloudflare/import-parser.test.js`
- Create: `tests/cloudflare/import-api.test.js`

**Interfaces:**
- Produces: `parseImportFile(file): {kind, referenceDate, revision, rows, sha256}`.
- Produces: rotas `POST /api/imports/start`, `/file`, `/chunk`, `/preview`.
- Consumes: R2 `FILES`, D1 `import_*` e identidade autenticada.

- [ ] **Step 1: Instalar e fixar ferramentas locais**

Run: `npm install --save-exact fflate && npm install --save-dev --save-exact esbuild`

Adicionar `build:pwa` executando `node scripts/build-pwa.js` e fazer o build empacotar `fflate` dentro de `pwa/js/import-parser.js`. Produção não carrega CDN.

- [ ] **Step 2: Testar as quatro fixtures atuais**

Reusar `tests/fixtures/*.html`; adicionar fixture XLSX sintética sem dados reais. Exigir cabeçalhos, descarte do rodapé `Total`, datas válidas, identificação pelo nome e rejeição de lote com data/revisão divergente.

- [ ] **Step 3: Portar os parsers**

Converter `apps-script/02_ParserHtml.gs` e `02_ParserXlsx.gs` para módulos puros no browser. Normalizar somente os cabeçalhos necessários e calcular SHA-256 com `crypto.subtle.digest`.

- [ ] **Step 4: Implementar estágio autenticado**

`start` cria UUID e lote `staging`; `file` grava o bruto em `imports/{referenceDate}/r{revision}/{batchId}/{kind}/{filename}`; `chunk` aceita no máximo 500 linhas, valida todas e grava estágio; `preview` devolve somente contagens, avisos e IDs divergentes.

- [ ] **Step 5: Testar e versionar**

Run: `npm run build:pwa && node --test tests/cloudflare/import-parser.test.js tests/cloudflare/import-api.test.js && npm test`

```bash
git add package.json package-lock.json scripts/build-pwa.js pwa worker/src tests/cloudflare
git commit -m "feat: importar relatorios pelo pwa e r2"
```

### Task 10: Promover lotes atomicamente e adicionar fontes oficiais de fluxo

**Files:**
- Create: `worker/src/imports/transform.js`
- Create: `worker/src/imports/promote.js`
- Modify: `worker/src/services/import-service.js`
- Modify: `pwa/js/imports.js`
- Create: `tests/cloudflare/import-promotion.test.js`
- Create: `tests/cloudflare/official-flow-imports.test.js`

**Interfaces:**
- Produces: `previewBatch(db, batchId)` e `promoteBatch(db, batchId, actor)`.
- Produces: importadores `official_churns` e `official_new_students`.
- Consumes: tabelas de estágio da Task 9 e regras de precedência globais.

- [ ] **Step 1: Escrever testes de atomicidade**

Cobrir lote válido, arquivo ausente, revisão divergente, linha inválida, lote já promovido e falha no meio. Em todas as falhas, a versão ativa e os campos manuais devem permanecer iguais.

- [ ] **Step 2: Portar transformação e permanência**

Portar funções puras de `apps-script/03_Transformacao.gs` e `03_Permanencia.gs`; preservar eventos existentes; não estimar LTV; selecionar o contrato pelo vencimento mais recente conforme a regra aprovada.

- [ ] **Step 3: Implementar promoção transacional**

Gerar a nova `data_version` como `staging`, gravar dados derivados vinculados à versão, executar validações finais e promover com um único `db.batch()` que rebaixa a ativa anterior e ativa a nova. O lote recebe autor e horário.

- [ ] **Step 4: Implementar cancelados e alunos novos**

Cancelados oficiais atualizam somente campos oficiais e preservam dados manuais por `student_id`. Alunos novos ganham tabela e subaba em Fluxo. Ambos exibem prévia antes da promoção.

- [ ] **Step 5: Testar e versionar**

Run: `node --test tests/cloudflare/import-promotion.test.js tests/cloudflare/official-flow-imports.test.js && npm test`

```bash
git add worker/src pwa/js/imports.js tests/cloudflare
git commit -m "feat: promover lotes oficiais com seguranca"
```

## Fase 4 — Deploy protegido, migração e corte

### Task 11: Automatizar backups, restauração e alertas de franquia

**Files:**
- Create: `worker/src/services/backup-service.js`
- Create: `worker/src/services/usage-service.js`
- Create: `scripts/restore-r2-backup.js`
- Modify: `worker/src/index.js`
- Modify: `worker/wrangler.jsonc`
- Modify: `pwa/js/dashboard.js`
- Create: `tests/cloudflare/backup.test.js`

**Interfaces:**
- Produces: `createBackup(db, files, now)`, `recordUsage(db, meta)` e evento agendado semanal.
- Produces: snapshots `backups/YYYY-MM-DD/<backupId>/manifest.json` e um JSONL gzip por tabela.
- Consumes: D1 `DB`, R2 `FILES` e lista fixa de tabelas do schema.

- [ ] **Step 1: Escrever testes de snapshot e restauração**

Usar D1/R2 falsos; exigir paginação de 500 linhas, SHA-256 por objeto, manifesto escrito por último e recusa de restauração quando hash ou schema não coincidir.

- [ ] **Step 2: Implementar backup sem dados em logs**

```js
export const BACKUP_TABLES = Object.freeze([
  'students', 'contracts', 'prescriptions', 'assessments', 'permanence',
  'permanence_events', 'student_profiles', 'student_last_teachers', 'tag_groups',
  'tags', 'student_tags', 'leads', 'churns', 'new_students', 'settings',
  'import_batches', 'import_files', 'import_errors', 'mutation_log', 'data_versions',
  'usage_counters'
]);
```

Ler por chave primária em páginas, serializar uma linha JSON por registro, compactar com `CompressionStream('gzip')`, gravar dados e hashes e somente então publicar o manifesto completo.

- [ ] **Step 3: Ligar cron semanal e restauração**

Adicionar trigger `0 6 * * 1` e handler `scheduled` que chama `createBackup`. O script de restauração recebe `--manifest`, verifica todos os hashes, gera SQL temporário fora do repositório e exige `--confirm-database xsteam-gestao` antes de executar.

- [ ] **Step 4: Registrar uso e exibir alertas**

Somar `rows_read` e `rows_written` retornados no `meta` do D1 em `usage_counters`; registrar requisições e bytes R2 conhecidos pelo aplicativo. A ação autenticada `systemStatus` devolve percentuais contra 5 milhões de leituras/dia, 100 mil escritas/dia e 100 mil requisições/dia. Configurações exibe aviso amarelo a 70% e vermelho a 90%, sem incluir dados pessoais.

- [ ] **Step 5: Testar e versionar**

Run: `node --test tests/cloudflare/backup.test.js && npm test`

```bash
git add worker/src worker/wrangler.jsonc pwa/js/dashboard.js scripts/restore-r2-backup.js tests/cloudflare/backup.test.js
git commit -m "feat: automatizar backups d1 no r2"
```

### Task 12: Criar recursos remotos e proteger o Worker

**Files:**
- Modify: `worker/wrangler.jsonc`
- Create: `docs/operacao/MIGRACAO_CLOUDFLARE.md`
- Create: `tests/cloudflare/deployment-contract.test.js`

**Interfaces:**
- Produces: Worker `xsteam-gestao`, D1 `xsteam-gestao`, R2 `xsteam-gestao-files` e Access ativo.
- Consumes: conta Cloudflare autenticada e credenciais OAuth Google criadas pelo proprietário.

- [ ] **Step 1: Verificar login e criar recursos sem plano pago**

Run:

```bash
cd worker
npx wrangler whoami
npx wrangler d1 create xsteam-gestao
npx wrangler r2 bucket create xsteam-gestao-files
```

Registrar os IDs retornados em `wrangler.jsonc`. Se a Cloudflare solicitar adesão paga, interromper e registrar o bloqueio; não aceitar cobrança.

- [ ] **Step 2: Aplicar migrações remotas**

Run: `cd worker && npx wrangler d1 migrations apply xsteam-gestao --remote`

Expected: todas as migrações com status aplicado.

- [ ] **Step 3: Configurar Google OAuth e Access**

No Google Cloud, criar cliente OAuth Web com origem `https://<team>.cloudflareaccess.com` e callback `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`. No Cloudflare Zero Trust, cadastrar o IdP Google e uma política Allow com os dois e-mails exatos. Proteger produção e previews do Worker. Inserir `ACCESS_TEAM_DOMAIN` e `ACCESS_AUD` como secrets/vars do Worker.

Qualquer tela de aceite de termos, consentimento legal ou ativação de serviço deve ser confirmada pelo usuário, não pelo agente.

- [ ] **Step 4: Publicar ambiente vazio protegido**

Run: `cd worker && npx wrangler deploy`

Validar: os dois e-mails entram; terceiro recebe bloqueio; `/api` sem cookie retorna Access; nenhum conteúdo pessoal existe ainda.

- [ ] **Step 5: Testar e versionar**

Run: `node --test tests/cloudflare/deployment-contract.test.js && npm test`

```bash
git add worker/wrangler.jsonc docs/operacao/MIGRACAO_CLOUDFLARE.md tests/cloudflare/deployment-contract.test.js
git commit -m "ops: publicar ambiente cloudflare protegido"
```

### Task 13: Migrar a base real e emitir relatório de paridade

**Files:**
- No tracked data files.
- Modify: `docs/operacao/MIGRACAO_CLOUDFLARE.md` somente com totais e resultado.

**Interfaces:**
- Produces: D1 preenchido e relatório de reconciliação sem PII.
- Consumes: exportação integral da planilha atual, seed e reconciliador da Task 6.

- [ ] **Step 1: Fazer backup e exportação privada**

Baixar/exportar todas as abas relevantes para um diretório temporário com permissão restrita. Incluir a prévia de churn, perfis, catálogos, leads, churns, permanência, contratos e importações. Não copiar o diretório para o projeto.

- [ ] **Step 2: Gerar e aplicar seed remoto**

```bash
node scripts/build-d1-seed.js --input /tmp/xsteam-export --output /tmp/xsteam-seed.sql
cd worker
npx wrangler d1 execute xsteam-gestao --remote --file /tmp/xsteam-seed.sql
```

- [ ] **Step 3: Reconciliar**

Run: `node scripts/reconcile-d1.js --source /tmp/xsteam-export --database xsteam-gestao`

Expected: zero divergências críticas; relatório com contagens por entidade e lista de IDs que exigem decisão. Não promover os casos duvidosos sem decisão da gestão.

- [ ] **Step 4: Testar mutações reais controladas**

Com um registro de teste aprovado, salvar perfil, etiquetas, múltiplos últimos professores, lead e churn; recarregar; confirmar persistência; restaurar os valores originais pela própria API.

- [ ] **Step 5: Registrar somente o resultado**

Atualizar a documentação com data, totais, hashes agregados, divergências resolvidas e identidade do validador. Não versionar exportações.

```bash
git add docs/operacao/MIGRACAO_CLOUDFLARE.md
git commit -m "docs: registrar reconciliacao da migracao d1"
```

### Task 14: Executar ensaio, corte e rollback verificável

**Files:**
- Modify: `CONTEXTO_DO_PROJETO.md`
- Modify: `CONTEXTO_DO_PROJETO.html`
- Modify: `LEIA-ME.md`
- Modify: `docs/operacao/MIGRACAO_CLOUDFLARE.md`
- Modify after stabilization: `.github/workflows/deploy-pages.yml`
- Modify after stabilization: `.github/workflows/deploy-worker.yml`
- Create: `tests/cloudflare/cutover.test.js`

**Interfaces:**
- Produces: runtime integralmente Cloudflare e Google antigo somente como contingência congelada.
- Consumes: paridade aprovada, backups e testes de todas as fases.

- [ ] **Step 1: Escrever checklist automatizado de corte**

Exigir: URL `workers.dev`, assets HTTP 200 após login, bootstrap D1, mutação idempotente, upload R2, importação rejeitada sem trocar versão, ausência de URLs GitHub Pages/Apps Script no bundle e cache atual.

- [ ] **Step 2: Fazer ensaio completo**

Executar importação sintética e uma cópia do último lote real; comparar os resultados com a base antiga; testar desktop, mobile, instalação PWA, logout, perda de rede e retomada da fila.

- [ ] **Step 3: Criar ponto de retorno**

Registrar deployment/version do Worker antigo, exportação final do Google, backup do D1 e tag Git anterior ao corte. Não apagar nem alterar a base antiga.

- [ ] **Step 4: Executar o corte**

Suspender gravações antigas durante a janela, exportar o delta, reaplicar e reconciliar, publicar o Worker final e comunicar o novo endereço. O GitHub Pages permanece disponível apenas como contingência, sem receber novas gravações.

- [ ] **Step 5: Validar por 48 horas operacionais**

Confirmar logins, Home, Financeiro, Acompanhamento, Fluxo, perfis, WhatsApp, fila, importação e métricas. Se qualquer critério crítico falhar, voltar ao endereço anterior e restaurar o D1 pelo backup; não tentar corrigir dados manualmente em produção.

- [ ] **Step 6: Encerrar dependências antigas sem excluir dados**

Depois da aprovação, desabilitar workflows de Pages/Apps Script e revogar os segredos do proxy. Manter planilha e Drive em modo de arquivo até autorização específica de exclusão.

- [ ] **Step 7: Rodar verificação final e versionar**

Run: `npm run build:pwa && npm test`

Expected: suíte integral aprovada, incluindo contratos Cloudflare e ausência de upstream Google no runtime.

```bash
git add CONTEXTO_DO_PROJETO.md CONTEXTO_DO_PROJETO.html LEIA-ME.md docs/operacao/MIGRACAO_CLOUDFLARE.md .github/workflows tests/cloudflare/cutover.test.js
git commit -m "feat: concluir transicao integral para cloudflare"
git push origin main
```

## Gates obrigatórios

1. Tasks 1–3: nenhuma publicação e nenhum dado real.
2. Tasks 4–6: backend local compatível e migração sintética aprovada.
3. Tasks 7–10: PWA e importação completos, ainda sem corte.
4. Task 11: backup e restauração testados antes de qualquer dado real.
5. Task 12: ambiente remoto vazio, protegido e gratuito.
6. Task 13: dados reais somente após backup; divergências críticas devem ser zero.
7. Task 14: corte somente após aprovação explícita do relatório de paridade.

## Definição de concluído

- Frontend, API, D1, R2 e autenticação funcionam no Cloudflare.
- GitHub contém somente código e documentação atualizados.
- Nenhuma requisição de produção depende de GitHub Pages, Apps Script, Sheets ou Drive.
- Os dois e-mails autorizados entram pelo Google e qualquer terceiro é bloqueado.
- Dados oficiais e manuais reconciliam com a origem por ID.
- Importações são atômicas e reversíveis.
- Salvamentos não bloqueiam a interface e sobrevivem a falhas temporárias.
- Backups, rollback, limites gratuitos e rotina operacional estão documentados e testados.
