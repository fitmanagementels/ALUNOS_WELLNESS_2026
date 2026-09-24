import { createRemoteJWKSet, jwtVerify } from 'jose';

function authError(code, message, status) {
  return Object.assign(new Error(message), { code, status });
}

function accessIssuer(teamDomain) {
  const team = String(teamDomain || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  return team ? `https://${team}` : '';
}

function allowedEmails(value) {
  return String(value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function authenticate(request, env, deps = {}) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw authError('AUTH_REQUIRED', 'Autenticação necessária.', 401);

  const issuer = accessIssuer(env && env.ACCESS_TEAM_DOMAIN);
  const audience = String(env && env.ACCESS_AUD || '').trim();
  if (!issuer || !audience) throw authError('AUTH_INVALID', 'Configuração de acesso indisponível.', 401);

  try {
    const verify = deps.jwtVerify || jwtVerify;
    const remoteJwks = deps.createRemoteJWKSet || createRemoteJWKSet;
    const { payload } = await verify(
      token,
      remoteJwks(new URL(`${issuer}/cdn-cgi/access/certs`)),
      { issuer, audience }
    );
    const email = String(payload && payload.email || '').trim().toLowerCase();
    if (!allowedEmails(env.ALLOWED_EMAILS).includes(email)) {
      throw authError('FORBIDDEN_EMAIL', 'Conta sem acesso.', 403);
    }
    return { email };
  } catch (error) {
    if (error && error.code === 'FORBIDDEN_EMAIL') throw error;
    throw authError('AUTH_INVALID', 'Não foi possível validar o acesso.', 401);
  }
}
