const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('bootstrap remoto não expõe assets nem bindings de dados antes do Access', async () => {
  const config = fs.readFileSync('worker/wrangler.access-bootstrap.jsonc', 'utf8');
  assert.match(config, /"name"\s*:\s*"xsteam-gestao"/);
  assert.match(config, /"main"\s*:\s*"src\/access-bootstrap\.js"/);
  assert.doesNotMatch(config, /d1_databases|r2_buckets|assets/);

  const app = await import('../../worker/src/access-bootstrap.js');
  const response = await app.default.fetch(new Request('https://xsteam-gestao.example/'));
  assert.equal(response.status, 503);
  assert.equal(await response.text(), 'Acesso do XSTEAM Gestão em configuração.');
  assert.match(response.headers.get('cache-control'), /no-store/);
});
