# Google direto e backup local criptografado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar o PWA no Worker com autenticação Google direta e backup manual criptografado, sem R2 nem Cloudflare Access.

**Architecture:** O Worker conduz OAuth Authorization Code com PKCE, valida o `id_token` Google e emite cookie de sessão assinado. A API continua same-origin e autentica pela sessão. Um serviço D1 monta o snapshot; o navegador cifra esse conteúdo via Web Crypto antes de baixar um arquivo local. A restauração é uma ferramenta local com confirmação explícita do D1.

**Tech Stack:** Cloudflare Workers, D1, JavaScript ES modules, `jose`, Web Crypto API, Node.js 24, `node:test`.

## Global Constraints

- Não usar R2, Cloudflare Access, Zero Trust, cartão ou domínio próprio.
- Permitir somente `fitmanagement.els@gmail.com` e `elohimlima15@gmail.com`.
- Nunca registrar token Google, segredo OAuth, senha de backup, e-mail do ator ou linhas do backup em logs.
- Password de backup mínimo: 12 caracteres; usar PBKDF2-SHA-256 com 600.000 iterações e AES-256-GCM.
- A senha de backup não sai do navegador, não entra na API e não é persistida.
- D1 continua a fonte de dados; GitHub continua somente backup de código.
- Não remover a produção legada antes da validação manual do novo Worker.

---

### Task 1: Implementar OAuth Google e sessão assinada

**Files:**
- Create: `worker/src/google-oauth.js`
- Modify: `worker/src/auth.js`
- Create: `tests/cloudflare/google-oauth.test.js`
- Modify: `tests/cloudflare/auth.test.js`

**Interfaces:**
- Produces `startGoogleLogin(request, env, deps)`, `finishGoogleLogin(request, env, deps)`, `logout(request)` e `authenticate(request, env, deps)`.
- Consumes Secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` e variável `ALLOWED_EMAILS`.
- `authenticate` devolve `{ email }` ou lança erro com `code` e `status`.

- [ ] **Step 1: Escrever testes que falham para state/PKCE, callback e sessão**

```js
test('login Google cria state PKCE e redireciona sem vazar segredo', async () => {
  const response = await startGoogleLogin(new Request('https://app.workers.dev/auth/login'), env, { random: () => 'a'.repeat(48) });
  assert.equal(response.status, 302);
  assert.match(response.headers.get('location'), /accounts\.google\.com/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.doesNotMatch(response.headers.get('location'), /GOOGLE_CLIENT_SECRET/);
});
test('callback permitido cria sessão; e-mail externo recebe 403', async () => {
  const deps = { exchangeCode: async () => ({ id_token: 'id' }), jwtVerify: async () => ({ payload: { email: 'fitmanagement.els@gmail.com', email_verified: true, nonce: 'nonce-ok' } }) };
  assert.equal((await finishGoogleLogin(callbackRequest, env, deps)).status, 302);
  await assert.rejects(() => finishGoogleLogin(callbackRequest, env, { ...deps, jwtVerify: async () => ({ payload: { email: 'fora@example.com', email_verified: true, nonce: 'nonce-ok' } }) }), { code: 'FORBIDDEN_EMAIL', status: 403 });
});
test('sessão ausente, expirada ou assinada com chave errada é 401', async () => {
  await assert.rejects(() => authenticate(new Request('https://x/api'), env), { code: 'AUTH_REQUIRED', status: 401 });
  await assert.rejects(() => authenticate(sessionRequest('token-invalido'), env), { code: 'AUTH_INVALID', status: 401 });
});
```

- [ ] **Step 2: Rodar o teste e confirmar falha**

Run: `node --test tests/cloudflare/google-oauth.test.js tests/cloudflare/auth.test.js`  
Expected: FAIL por módulo/exportação ausente.

- [ ] **Step 3: Implementar `google-oauth.js`**

Implementar helpers isolados para: base64url; HMAC-SHA-256; cookie `xsteam_oauth` curto; state, nonce e PKCE; URL `https://accounts.google.com/o/oauth2/v2/auth`; troca de código em `https://oauth2.googleapis.com/token`; e validação de `id_token` por `jwtVerify` e `createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))`. Exigir `iss` Google, `aud=GOOGLE_CLIENT_ID`, nonce e `email_verified === true`. Emitir `xsteam_session` com payload `{email, exp}` assinado por `SESSION_SECRET`, atributos `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`.

- [ ] **Step 4: Substituir `auth.js` por verificação de sessão**

```js
export async function authenticate(request, env, deps = {}) {
  const token = readCookie(request.headers.get('cookie'), 'xsteam_session');
  const payload = await verifySession(token, env.SESSION_SECRET, deps);
  const email = String(payload.email || '').trim().toLowerCase();
  if (!allowedEmails(env.ALLOWED_EMAILS).includes(email)) throw authError('FORBIDDEN_EMAIL', 'Conta sem acesso.', 403);
  return { email };
}
```

Remover todos os caminhos `Cf-Access-Jwt-Assertion`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` e `context.access`.

- [ ] **Step 5: Rodar testes focados**

Run: `node --test tests/cloudflare/google-oauth.test.js tests/cloudflare/auth.test.js`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add worker/src/google-oauth.js worker/src/auth.js tests/cloudflare/google-oauth.test.js tests/cloudflare/auth.test.js
git commit -m "feat: autenticar com google sem cloudflare access"
```

### Task 2: Expor rotas de autenticação e preservar a API protegida

**Files:**
- Modify: `worker/src/index.js`
- Modify: `worker/src/router.js`
- Modify: `tests/cloudflare/router.test.js`
- Create: `tests/cloudflare/auth-routes.test.js`

**Interfaces:**
- `handleRequest` despacha `GET /auth/login`, `GET /auth/callback`, `POST /auth/logout` antes de assets.
- `/api` permanece somente POST e chama `authenticate` por sessão.

- [ ] **Step 1: Escrever teste de despacho**

```js
test('Worker atende login, callback e logout sem entregar asset antes da autenticação', async () => {
  assert.equal((await handleRequest(new Request('https://x/auth/login'), env, {}, { startGoogleLogin })).status, 302);
  assert.equal((await handleRequest(new Request('https://x/auth/logout', { method: 'POST' }), env, {}, { logout })).status, 204);
});
test('API sem sessão devolve AUTH_REQUIRED e não toca no bootstrap', async () => {
  let called = false;
  const response = await handleApiRequest(apiRequest('bootstrap'), { DB: {} }, { authenticate: async () => { throw Object.assign(new Error('Autenticação necessária.'), { code: 'AUTH_REQUIRED', status: 401 }); }, buildBootstrap: async () => { called = true; return {}; } });
  assert.equal(response.status, 401); assert.equal(called, false);
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test tests/cloudflare/auth-routes.test.js tests/cloudflare/router.test.js`  
Expected: FAIL porque as rotas ainda são assets/404.

- [ ] **Step 3: Implementar despacho e headers seguros**

Em `index.js`, despachar as três rotas OAuth e usar `Cache-Control: no-store` em respostas de autenticação. Remover `handleScheduled` e imports de backup R2. Não permitir `GET /api`.

- [ ] **Step 4: Ajustar teste do roteador e executar**

Run: `node --test tests/cloudflare/auth-routes.test.js tests/cloudflare/router.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.js worker/src/router.js tests/cloudflare/auth-routes.test.js tests/cloudflare/router.test.js
git commit -m "feat: expor login google no worker"
```

### Task 3: Exportar retrato D1 autenticado para backup manual

**Files:**
- Create: `worker/src/services/local-backup-service.js`
- Modify: `worker/src/repositories/dashboard-repository.js`
- Modify: `worker/src/router.js`
- Create: `tests/cloudflare/local-backup.test.js`

**Interfaces:**
- Produces `buildLocalBackup(db, now)` com `{format:'xsteam-local-backup',version:1,createdAt,tables}`.
- Ação `exportBackup` devolve o objeto somente a uma sessão permitida.
- Nenhuma linha do snapshot é incluída em logs, erros ou `meta`.

- [ ] **Step 1: Escrever teste de snapshot e rota**

```js
test('backup local contém tabelas de recuperação e não retorna dados em metadados', async () => {
  const data = await buildLocalBackup(fakeDb, new Date('2026-09-28T12:00:00Z'));
  assert.equal(data.format, 'xsteam-local-backup');
  assert.deepEqual(Object.keys(data.tables).includes('student_profiles'), true);
});
test('exportBackup exige autenticação e não registra linhas pessoais', async () => {
  const lines = []; const original = console.error; console.error = (line) => lines.push(line);
  try { const response = await handleApiRequest(apiRequest('exportBackup'), { DB: {} }, { authenticate: async () => ({ email: 'fitmanagement.els@gmail.com' }), buildLocalBackup: async () => { throw new Error('falha'); } }); assert.equal(response.status, 503); } finally { console.error = original; }
  assert.equal(JSON.stringify(lines).includes('fitmanagement.els@gmail.com'), false);
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test tests/cloudflare/local-backup.test.js`  
Expected: FAIL por serviço/ação ausente.

- [ ] **Step 3: Implementar leitura fixa e resposta**

Criar lista fixa de tabelas iguais às que o backup R2 cobria. Consultar cada tabela com nomes internos fixos e `ORDER BY rowid`; retornar somente o envelope de backup. No roteador, adicionar `exportBackup` e passar `env.DB`; limitar JSON de resposta a 8 MiB, devolvendo `SERVICE_UNAVAILABLE` genérico quando exceder.

- [ ] **Step 4: Rodar testes focados**

Run: `node --test tests/cloudflare/local-backup.test.js tests/cloudflare/router.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/services/local-backup-service.js worker/src/repositories/dashboard-repository.js worker/src/router.js tests/cloudflare/local-backup.test.js tests/cloudflare/router.test.js
git commit -m "feat: exportar backup manual do d1"
```

### Task 4: Cifrar e baixar backup no navegador

**Files:**
- Create: `pwa/js/local-backup.js`
- Modify: `pwa/js/api.js`
- Create: `tests/cloudflare/local-backup-pwa.test.js`

**Interfaces:**
- `XsteamLocalBackup.createEncryptedFile(snapshot, password, cryptoApi)` devolve `Blob` JSON envelope.
- `XsteamApi.call` redireciona para `/auth/login` em `AUTH_REQUIRED`.
- Arquivo usa extensão `.xsteam-backup` e envelope `{format,version,kdf,iterations,salt,iv,ciphertext}`.

- [ ] **Step 1: Escrever testes Web Crypto simulados**

```js
test('backup cifra com PBKDF2 de 600000 iterações e não serializa a senha', async () => {
  const file = await createEncryptedFile({ tables: { students: [] } }, 'senha-longa-123', cryptoStub);
  const text = await file.text();
  assert.match(text, /AES-GCM/);
  assert.match(text, /600000/);
  assert.doesNotMatch(text, /senha-longa-123/);
});
test('senha curta ou confirmação diferente é recusada antes de chamar a API', async () => {
  await assert.rejects(() => validatePasswordPair('curta', 'curta'), /12 caracteres/);
  await assert.rejects(() => validatePasswordPair('senha-longa-123', 'outra-senha-456'), /não coincidem/);
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test tests/cloudflare/local-backup-pwa.test.js`  
Expected: FAIL por módulo ausente.

- [ ] **Step 3: Implementar cifra local**

Usar `crypto.getRandomValues` para salt de 16 bytes e IV de 12 bytes. Derivar `AES-GCM` de 256 bits via `crypto.subtle.deriveKey` com PBKDF2/SHA-256/600000. Cifrar `TextEncoder().encode(JSON.stringify(snapshot))`; gerar `Blob([JSON.stringify(envelope)], {type:'application/x-xsteam-backup+json'})`; criar download por `URL.createObjectURL` e revogar URL após clique.

- [ ] **Step 4: Ajustar API para login sem interrupção ambígua**

```js
if (body?.error?.code === 'AUTH_REQUIRED') {
  window.location.assign('/auth/login');
  throw error('Redirecionando para entrar com Google.', 'AUTH_REQUIRED');
}
```

- [ ] **Step 5: Rodar testes focados**

Run: `node --test tests/cloudflare/local-backup-pwa.test.js tests/cloudflare/pwa-api.test.js`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add pwa/js/local-backup.js pwa/js/api.js tests/cloudflare/local-backup-pwa.test.js tests/cloudflare/pwa-api.test.js
git commit -m "feat: cifrar backup manual no navegador"
```

### Task 5: Adicionar subaba Segurança e backup ao PWA

**Files:**
- Modify: `pwa/index.html`
- Modify: `pwa/js/dashboard.js`
- Modify: `pwa/css/dashboard.css`
- Modify: `pwa/sw.js`
- Create: `tests/cloudflare/settings-backup-pwa.test.js`

**Interfaces:**
- Nova seção `backup` em `state.settingsSection`.
- `renderBackupSettings()` coleta senha e confirmação, chama `XsteamApi.call('exportBackup')`, cifra via `XsteamLocalBackup` e atualiza `localStorage['xsteam-last-local-backup-at']` somente após download.

- [ ] **Step 1: Escrever teste de contrato da tela**

```js
test('Configurações inclui Segurança e backup e carrega o módulo offline', () => {
  assert.match(dashboard, /\['backup', 'Segurança e backup'\]/);
  assert.match(index, /local-backup\.js/);
  assert.match(worker, /local-backup\.js/);
});
test('tela não persiste nem envia senha para XsteamApi', () => {
  assert.doesNotMatch(dashboard, /localStorage\.setItem\([^)]*(senha|password)/i);
  assert.match(dashboard, /XsteamApi\.call\('exportBackup'\)/);
  assert.doesNotMatch(dashboard, /XsteamApi\.call\('exportBackup',\s*(senha|password)/i);
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test tests/cloudflare/settings-backup-pwa.test.js`  
Expected: FAIL porque a subaba não existe.

- [ ] **Step 3: Implementar área discreta**

Adicionar botão `Segurança e backup` depois de `Perfil de pagamento`. Painel: explicação curta, senha, confirmação, botão `Gerar backup criptografado`, status acessível e texto da última geração local. Desabilitar botão durante exportação/cifra; limpar campos de senha em sucesso e erro. Adicionar CSS reutilizando `settings-panel`; em mobile, mudar navegação para quatro colunas roláveis. Carregar `local-backup.js` antes de `dashboard.js` e incluí-lo em `STATIC_ASSETS`; elevar cache para `xsteam-static-v15`.

- [ ] **Step 4: Rodar testes focados**

Run: `node --test tests/cloudflare/settings-backup-pwa.test.js tests/cloudflare/pwa-shell.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pwa/index.html pwa/js/dashboard.js pwa/css/dashboard.css pwa/sw.js tests/cloudflare/settings-backup-pwa.test.js
git commit -m "feat: adicionar backup local nas configuracoes"
```

### Task 6: Criar recuperação local criptografada e retirar R2

**Files:**
- Create: `scripts/restore-local-backup.js`
- Create: `tests/cloudflare/restore-local-backup.test.js`
- Modify: `worker/wrangler.jsonc`
- Modify: `tests/cloudflare/runtime-config.test.js`
- Delete: `worker/src/services/backup-service.js`
- Delete: `scripts/download-r2-backup.js`
- Delete: `scripts/restore-r2-backup.js`
- Delete: `tests/cloudflare/backup.test.js`
- Delete: `tests/cloudflare/download-r2-backup.test.js`
- Delete: `tests/cloudflare/restore-r2-backup.test.js`

**Interfaces:**
- CLI: `node scripts/restore-local-backup.js --file /caminho/backup.xsteam-backup --out /tmp/xsteam-restore.sql`.
- O CLI solicita senha sem eco, decifra AES-GCM, verifica envelope e gera SQL com modo `0600` fora do repositório.
- Aplicação exige `--apply --confirm-database xsteam-gestao`.

- [ ] **Step 1: Escrever testes de recuperação**

```js
test('restauração decifra envelope válido e gera SQL fora do repositório', async () => {
  const rows = await decryptEnvelope(envelope, 'senha-longa-123', cryptoApi);
  assert.deepEqual(rows.tables.students, [{ student_id: '1' }]);
});
test('senha errada, versão inválida e banco não confirmado são recusados', async () => {
  await assert.rejects(() => decryptEnvelope(envelope, 'senha-errada-123', cryptoApi), /Não foi possível decifrar/);
  await assert.rejects(() => decryptEnvelope({ ...envelope, version: 99 }, 'senha-longa-123', cryptoApi), /versão/);
  assert.throws(() => assertApplyAllowed(['--apply', '--confirm-database', 'outro']), /confirm-database xsteam-gestao/);
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test tests/cloudflare/restore-local-backup.test.js`  
Expected: FAIL por script/exportação ausente.

- [ ] **Step 3: Implementar recuperação e remover recursos R2**

Implementar leitura de senha pelo terminal sem escrevê-la em argumentos, PBKDF2/AES-GCM equivalentes ao PWA, geração SQL com a lista de tabelas permitidas e `BEGIN IMMEDIATE`. Em `wrangler.jsonc`, remover `triggers`, `r2_buckets` e bloco `access`; preservar Assets, D1 e `ALLOWED_EMAILS`. Atualizar teste de configuração para exigir ausência de `FILES`, `r2_buckets`, `triggers` e `access`.

- [ ] **Step 4: Rodar testes focados**

Run: `node --test tests/cloudflare/restore-local-backup.test.js tests/cloudflare/runtime-config.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A worker/wrangler.jsonc worker/src scripts tests/cloudflare
git commit -m "feat: substituir r2 por recuperacao local criptografada"
```

### Task 7: Eliminar dependência externa de gráficos e validar build

**Files:**
- Modify: `package.json`
- Create: `scripts/copy-pwa-vendor.js`
- Modify: `pwa/index.html`
- Modify: `pwa/sw.js`
- Modify: `tests/cloudflare/pwa-api.test.js`
- Create: `tests/cloudflare/pwa-vendor.test.js`

**Interfaces:**
- `npm run build:pwa-assets` copia `chart.umd.min.js` da dependência `chart.js` para `pwa/vendor/`.
- `index.html` carrega somente `./vendor/chart.umd.min.js` na mesma origem.

- [ ] **Step 1: Escrever teste de ausência de CDN**

```js
test('PWA serve Chart.js localmente e não depende de CDN externo', () => {
  assert.match(html, /\.\/vendor\/chart\.umd\.min\.js/);
  assert.doesNotMatch(html, /https:\/\/cdn\./);
  assert.equal(fs.existsSync('pwa/vendor/chart.umd.min.js'), true);
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `node --test tests/cloudflare/pwa-vendor.test.js`  
Expected: FAIL porque o asset local não existe.

- [ ] **Step 3: Instalar e copiar asset com versão fixa**

Run: `npm install --save-dev chart.js@4.4.7`.

Criar `copy-pwa-vendor.js` que usa `fs.copyFileSync('node_modules/chart.js/dist/chart.umd.min.js', 'pwa/vendor/chart.umd.min.js')`. Adicionar `build:pwa-assets` e executar antes do teste/deploy. Substituir o script CDN em `pwa/index.html`; incluir o vendor no cache service worker.

- [ ] **Step 4: Rodar testes e dry-run**

Run: `npm run build:pwa-assets && node --test tests/cloudflare/pwa-vendor.test.js tests/cloudflare/pwa-api.test.js && cd worker && ./node_modules/.bin/wrangler deploy --dry-run`  
Expected: PASS; dry-run lista assets, D1 e `ALLOWED_EMAILS`, sem R2/cron/Access.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json scripts/copy-pwa-vendor.js pwa/index.html pwa/sw.js pwa/vendor/chart.umd.min.js tests/cloudflare
git commit -m "feat: servir dependencias pwa pelo worker"
```

### Task 8: Atualizar contexto, validar e preparar publicação

**Files:**
- Modify: `docs/operacao/MIGRACAO_CLOUDFLARE.md`
- Modify: `CONTEXTO_DO_PROJETO.md`
- Modify: `scripts/build-project-context-html.mjs` se o resumo estático exigir atualização
- Modify: `CONTEXTO_DO_PROJETO.html` gerado pelo script
- Create: `tests/cloudflare/google-deploy-contract.test.js`

**Interfaces:**
- Guia final declara apenas três Secrets manuais: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`.
- O deploy completo é bloqueado até os Secrets estarem presentes.

- [ ] **Step 1: Escrever contrato de deploy**

```js
test('configuração final usa D1/Assets e não contém Access ou R2', () => {
  assert.match(config, /"binding"\s*:\s*"DB"/);
  assert.doesNotMatch(config, /r2_buckets|FILES|cloudflareaccess|ACCESS_/i);
});
```

- [ ] **Step 2: Rodar e confirmar falha se a configuração ainda tiver recurso removido**

Run: `node --test tests/cloudflare/google-deploy-contract.test.js`  
Expected: PASS somente depois da Task 6.

- [ ] **Step 3: Atualizar documentação**

Documentar criação do OAuth Web no Google, URL de callback `https://xsteam-gestao.fitmanagement-els.workers.dev/auth/callback`, cadastro de Secrets no Worker, teste com as duas contas e conta externa, geração/guarda/restauração de backup local. Declarar que a criação do Client Secret e Session Secret é a única ação manual restante e que nenhum deles deve ser enviado por chat.

- [ ] **Step 4: Rodar toda a suíte e gerar contexto**

Run: `node scripts/build-project-context-html.mjs && npm test && git diff --check`  
Expected: todos os testes PASS e nenhum erro de whitespace.

- [ ] **Step 5: Commit**

```bash
git add CONTEXTO_DO_PROJETO.md CONTEXTO_DO_PROJETO.html docs/operacao/MIGRACAO_CLOUDFLARE.md scripts/build-project-context-html.mjs tests/cloudflare/google-deploy-contract.test.js
git commit -m "docs: preparar publicacao sem r2 e access"
```

## Verificação final manual após Secrets

1. Cadastrar os três Secrets no Worker pelo painel Cloudflare.
2. Executar `cd worker && ./node_modules/.bin/wrangler deploy`.
3. Abrir o endereço `workers.dev` em janela anônima; confirmar redirecionamento Google.
4. Entrar com cada e-mail permitido; confirmar Home e `POST /api` autenticado.
5. Tentar uma terceira conta; confirmar bloqueio sem sessão.
6. Gerar backup com senha de 12+ caracteres; confirmar download e que a senha não aparece no arquivo.
7. Validar decifração local sem aplicar SQL; a aplicação de SQL continua exigindo confirmação explícita.
