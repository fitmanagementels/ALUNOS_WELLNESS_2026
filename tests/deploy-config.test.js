const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { gerarRuntimeConfig } = require('../scripts/gerar-runtime-config');

test('gerador publica somente a URL pública do Worker', () => {
  assert.throws(() => gerarRuntimeConfig({}), /PUBLIC_WORKER_URL/);
  assert.throws(() => gerarRuntimeConfig({ PUBLIC_WORKER_URL: 'https://api.example', CLIENT_SECRET: 'segredo' }), /CLIENT_SECRET/);
  const output = gerarRuntimeConfig({ PUBLIC_WORKER_URL: 'https://xsteam.example.workers.dev/' });
  assert.match(output, /"workerUrl": "https:\/\/xsteam\.example\.workers\.dev"/);
  assert.doesNotMatch(output, /oauthClientId|client_secret|secret/i);
});

test('workflows publicam Pages e Worker sem OAuth público', () => {
  const pages = fs.readFileSync('.github/workflows/deploy-pages.yml', 'utf8');
  const gas = fs.readFileSync('.github/workflows/deploy-apps-script.yml', 'utf8');
  const worker = fs.readFileSync('.github/workflows/deploy-worker.yml', 'utf8');
  assert.match(pages, /path: pwa/);
  assert.match(pages, /PUBLIC_WORKER_URL/);
  assert.match(pages, /vars\.PUBLIC_WORKER_URL\s*\|\|/);
  assert.match(pages, /https:\/\/xsteam-dashboard-api\.fitmanagement-els\.workers\.dev/);
  assert.doesNotMatch(pages, /if:\s*\$\{\{\s*vars\.PUBLIC_WORKER_URL\s*!=\s*''\s*\}\}/);
  assert.doesNotMatch(pages, /PUBLIC_OAUTH_CLIENT_ID|PUBLIC_OAUTH_SCOPES/);
  assert.match(worker, /cloudflare\/wrangler-action@v3/);
  assert.match(worker, /APPS_SCRIPT_SHARED_SECRET/);
  assert.match(worker, /name: Criar ou atualizar o Worker/);
  assert.match(worker, /name: Enviar segredos do Worker/);
  assert.match(worker, /wranglerVersion: "4"/);
  assert.match(worker, /vars\.ENABLE_WORKER_DEPLOY\s*==\s*'true'/);
  assert.match(gas, /clasp push --force/);
  assert.doesNotMatch(gas, /APPS_SCRIPT_AUTODEPLOY/);
  assert.match(gas, /APPS_SCRIPT_API_DEPLOYMENT_ID/);
  assert.match(gas, /clasp deploy --deploymentId/);
  assert.match(gas, /APPS_SCRIPT_WEBAPP_URL/);
  assert.match(gas, /APPS_SCRIPT_SHARED_SECRET/);
  assert.match(gas, /Verificar configuração do deploy/);
  assert.match(gas, /vars\.ENABLE_APPS_SCRIPT_DEPLOY\s*==\s*'true'/);
  assert.doesNotMatch(gas, /ready=false/);
  assert.match(pages, /capacidades\.perfilAluno !== true/);
  assert.match(pages, /action:\s*'versao'/);
  assert.match(gas, /steps\.config\.outputs\.ready == 'true'/);
  assert.match(gas, /Verificar API pública/);
  assert.match(gas, /action:\s*'versao'/);
  assert.match(gas, /capacidades\.perfilAluno !== true/);
});

test('manifesto preserva o Web App público ao atualizar a implantação', () => {
  const manifest = JSON.parse(fs.readFileSync('apps-script/appsscript.json', 'utf8'));
  assert.deepEqual(manifest.webapp, {
    access: 'ANYONE_ANONYMOUS',
    executeAs: 'USER_DEPLOYING'
  });
  assert.deepEqual(manifest.executionApi, { access: 'MYSELF' });
});

test('operação documenta o quarto relatório e oferece auditoria de permanência', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const pop = fs.readFileSync('docs/operacao/LEIA-ME_POP_01_ENTRADA.html', 'utf8');
  const instructions = fs.readFileSync('apps-script/INSTRUCOES_INSTALACAO.md', 'utf8');
  assert.equal(packageJson.scripts['validate:permanence'], 'node scripts/validar-permanencia-real.js');
  assert.match(pop, /quatro relatórios/i);
  assert.match(pop, /permanencia_2026-08-21_r01\.xls/);
  assert.match(instructions, /permanencia_AAAA-MM-DD_rNN\.xls/);
  assert.match(instructions, /exportação completa, sem filtro de status/i);
});
