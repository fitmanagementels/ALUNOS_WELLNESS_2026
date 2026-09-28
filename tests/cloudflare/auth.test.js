const test = require('node:test');
const assert = require('node:assert/strict');

const env = {
  SESSION_SECRET: 'session-secret-for-tests-only',
  ALLOWED_EMAILS: 'fitmanagement.els@gmail.com,elohimlima15@gmail.com'
};

function request(token = 'token-valido') {
  return new Request('https://xsteam-gestao.example/api', {
    headers: { cookie: `xsteam_session=${token}` }
  });
}

test('autentica somente e-mail permitido por sessão assinada', async () => {
  const { authenticate } = await import('../../worker/src/auth.js');
  const identity = await authenticate(request(), env, {
    jwtVerify: async (_token, secret, options) => {
      assert.ok(secret instanceof Uint8Array);
      assert.equal(options.algorithms[0], 'HS256');
      return { payload: { email: 'ELOHIMLIMA15@GMAIL.COM', exp: Math.floor(Date.now() / 1000) + 60 } };
    }
  });
  assert.deepEqual(identity, { email: 'elohimlima15@gmail.com' });
});

test('rejeita requisição sem sessão, sessão inválida e e-mail externo', async () => {
  const { authenticate } = await import('../../worker/src/auth.js');
  await assert.rejects(
    () => authenticate(new Request('https://xsteam-gestao.example/api'), env),
    { code: 'AUTH_REQUIRED', status: 401 }
  );
  await assert.rejects(
    () => authenticate(request(), env, {
      jwtVerify: async () => { throw new Error('assinatura inválida'); }
    }),
    { code: 'AUTH_INVALID', status: 401 }
  );
  await assert.rejects(
    () => authenticate(request(), env, {
      jwtVerify: async () => ({ payload: { email: 'fora@example.com' } })
    }),
    { code: 'FORBIDDEN_EMAIL', status: 403 }
  );
});
