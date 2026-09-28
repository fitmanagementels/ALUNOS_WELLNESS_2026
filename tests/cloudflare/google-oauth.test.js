const test = require('node:test');
const assert = require('node:assert/strict');

const env = {
  GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  SESSION_SECRET: 'session-secret-for-tests-only',
  ALLOWED_EMAILS: 'fitmanagement.els@gmail.com,elohimlima15@gmail.com'
};

function cookieValue(response, name) {
  const cookie = response.headers.get('set-cookie') || '';
  const match = new RegExp(`${name}=([^;]+)`).exec(cookie);
  return match && match[1];
}

test('login Google cria state PKCE e redireciona sem vazar segredo', async () => {
  const { startGoogleLogin } = await import('../../worker/src/google-oauth.js');
  const response = await startGoogleLogin(new Request('https://xsteam-gestao.example/auth/login'), env, {
    randomBytes: (size) => new Uint8Array(size).fill(7)
  });
  const location = response.headers.get('location');
  assert.equal(response.status, 302);
  assert.match(location, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
  assert.match(location, /code_challenge=/);
  assert.match(location, /redirect_uri=https%3A%2F%2Fxsteam-gestao\.example%2Fauth%2Fcallback/);
  assert.doesNotMatch(location, /client-secret/);
  assert.match(response.headers.get('set-cookie'), /xsteam_oauth=/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.ok(cookieValue(response, 'xsteam_oauth'));
});

test('callback permitido cria sessão; e-mail externo é bloqueado', async () => {
  const { startGoogleLogin, finishGoogleLogin } = await import('../../worker/src/google-oauth.js');
  const login = await startGoogleLogin(new Request('https://xsteam-gestao.example/auth/login'), env, {
    randomBytes: (size) => new Uint8Array(size).fill(8)
  });
  const state = new URL(login.headers.get('location')).searchParams.get('state');
  const request = new Request(`https://xsteam-gestao.example/auth/callback?code=google-code&state=${state}`, {
    headers: { cookie: `xsteam_oauth=${cookieValue(login, 'xsteam_oauth')}` }
  });
  const deps = {
    exchangeCode: async () => ({ id_token: 'google-id-token' }),
    verifyOauthToken: async () => ({ payload: { state, nonce: new URL(login.headers.get('location')).searchParams.get('nonce'), verifier: 'verifier' } }),
    verifyGoogleToken: async () => ({ payload: { email: 'fitmanagement.els@gmail.com', email_verified: true, nonce: new URL(login.headers.get('location')).searchParams.get('nonce') } })
  };
  const callback = await finishGoogleLogin(request, env, deps);
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/');
  assert.match(callback.headers.get('set-cookie'), /xsteam_session=/);
  assert.match(callback.headers.get('set-cookie'), /xsteam_oauth=;/);

  await assert.rejects(() => finishGoogleLogin(request, env, {
    ...deps,
    verifyGoogleToken: async () => ({ payload: { email: 'fora@example.com', email_verified: true, nonce: new URL(login.headers.get('location')).searchParams.get('nonce') } })
  }), { code: 'FORBIDDEN_EMAIL', status: 403 });
});

test('callback rejeita state inexistente e token com nonce diferente', async () => {
  const { finishGoogleLogin } = await import('../../worker/src/google-oauth.js');
  await assert.rejects(() => finishGoogleLogin(new Request('https://xsteam-gestao.example/auth/callback?code=x&state=y'), env), { code: 'AUTH_REQUIRED', status: 401 });
});
