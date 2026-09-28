const test = require('node:test');
const assert = require('node:assert/strict');

test('Worker expõe login, callback e logout antes de assets', async () => {
  const { handleRequest } = await import('../../worker/src/index.js');
  const env = { ASSETS: { fetch: async () => new Response('asset') } };
  const login = await handleRequest(new Request('https://xsteam.example/auth/login'), env, {}, { startGoogleLogin: async () => new Response(null, { status: 302 }) });
  const callback = await handleRequest(new Request('https://xsteam.example/auth/callback'), env, {}, { finishGoogleLogin: async () => new Response(null, { status: 302 }) });
  const logout = await handleRequest(new Request('https://xsteam.example/auth/logout', { method: 'POST' }), env, {}, { logout: async () => new Response(null, { status: 204 }) });
  assert.equal(login.status, 302);
  assert.equal(callback.status, 302);
  assert.equal(logout.status, 204);
});

test('raiz sem sessão direciona ao login antes de carregar o PWA', async () => {
  const { handleRequest } = await import('../../worker/src/index.js');
  let assets = 0;
  const response = await handleRequest(new Request('https://xsteam.example/'), { ASSETS: { fetch: async () => { assets += 1; return new Response('asset'); } } });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://xsteam.example/auth/login');
  assert.equal(assets, 0);
});

test('Worker não permite GET na API e não entrega asset para rota auth inválida', async () => {
  const { handleRequest } = await import('../../worker/src/index.js');
  let assets = 0;
  const env = { ASSETS: { fetch: async () => { assets += 1; return new Response('asset'); } } };
  const api = await handleRequest(new Request('https://xsteam.example/api'), env);
  const invalid = await handleRequest(new Request('https://xsteam.example/auth/logout'), env);
  assert.equal(api.status, 405);
  assert.equal(invalid.status, 405);
  assert.equal(assets, 0);
});
