const test = require('node:test');
const assert = require('node:assert/strict');

const env = {
  ACCESS_TEAM_DOMAIN: 'xsteam.cloudflareaccess.com',
  ACCESS_AUD: 'xsteam-gestao',
  ALLOWED_EMAILS: 'fitmanagement.els@gmail.com,elohimlima15@gmail.com'
};

function request(token = 'token-valido') {
  return new Request('https://xsteam-gestao.example/api', {
    headers: { 'Cf-Access-Jwt-Assertion': token }
  });
}

test('autentica somente e-mail permitido pelo JWT do Access', async () => {
  const { authenticate } = await import('../../worker/src/auth.js');
  const identity = await authenticate(request(), env, {
    createRemoteJWKSet: (url) => ({ url: String(url) }),
    jwtVerify: async (_token, jwks, options) => {
      assert.equal(jwks.url, 'https://xsteam.cloudflareaccess.com/cdn-cgi/access/certs');
      assert.deepEqual(options, {
        issuer: 'https://xsteam.cloudflareaccess.com',
        audience: 'xsteam-gestao'
      });
      return { payload: { email: 'ELOHIMLIMA15@GMAIL.COM' } };
    }
  });
  assert.deepEqual(identity, { email: 'elohimlima15@gmail.com' });
});

test('rejeita requisição sem JWT, JWT inválido e e-mail externo', async () => {
  const { authenticate } = await import('../../worker/src/auth.js');
  await assert.rejects(
    () => authenticate(new Request('https://xsteam-gestao.example/api'), env),
    { code: 'AUTH_REQUIRED', status: 401 }
  );
  await assert.rejects(
    () => authenticate(request(), env, {
      createRemoteJWKSet: () => ({}),
      jwtVerify: async () => { throw new Error('assinatura inválida'); }
    }),
    { code: 'AUTH_INVALID', status: 401 }
  );
  await assert.rejects(
    () => authenticate(request(), env, {
      createRemoteJWKSet: () => ({}),
      jwtVerify: async () => ({ payload: { email: 'fora@example.com' } })
    }),
    { code: 'FORBIDDEN_EMAIL', status: 403 }
  );
});
