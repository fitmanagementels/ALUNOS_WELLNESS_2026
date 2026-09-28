import { jwtVerify } from 'jose';

function authError(code, message, status) {
  return Object.assign(new Error(message), { code, status });
}

export function allowedEmails(value) {
  return String(value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function readCookie(header, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`).exec(String(header || ''));
  return match ? decodeURIComponent(match[1]) : '';
}

export function sessionKey(secret) {
  const value = String(secret || '');
  if (!value) throw authError('AUTH_INVALID', 'Configuração de acesso indisponível.', 401);
  return new TextEncoder().encode(value);
}

export async function authenticate(request, env, deps = {}) {
  const token = readCookie(request.headers.get('cookie'), 'xsteam_session');
  if (!token) throw authError('AUTH_REQUIRED', 'Autenticação necessária.', 401);
  try {
    const verify = deps.jwtVerify || jwtVerify;
    const { payload } = await verify(token, sessionKey(env && env.SESSION_SECRET), { algorithms: ['HS256'] });
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
