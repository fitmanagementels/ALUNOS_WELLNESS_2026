import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose';
import { allowedEmails, readCookie, sessionKey } from './auth.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS = new URL('https://www.googleapis.com/oauth2/v3/certs');

function authError(code, message, status) { return Object.assign(new Error(message), { code, status }); }
function base64url(bytes) {
  const values = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  values.forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function randomBytes(size, deps) {
  if (deps.randomBytes) return deps.randomBytes(size);
  const values = new Uint8Array(size); crypto.getRandomValues(values); return values;
}
async function digestSha256(text) { return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))); }
function cookie(name, value, maxAge) { return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
function clearCookie(name) { return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
async function sign(payload, secret, expiresIn) { return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(expiresIn).sign(sessionKey(secret)); }
async function verify(token, secret, deps) { return (deps.verifyOauthToken || jwtVerify)(token, sessionKey(secret), { algorithms: ['HS256'] }); }
function config(env) {
  if (!env || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.SESSION_SECRET) throw authError('AUTH_UNAVAILABLE', 'Login indisponível no momento.', 503);
}
async function exchangeCode(code, redirectUri, verifier, env, deps) {
  if (deps.exchangeCode) return deps.exchangeCode(code, redirectUri, verifier, env);
  const body = new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier });
  const response = await fetch(GOOGLE_TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  if (!response.ok) throw authError('AUTH_INVALID', 'Não foi possível validar o acesso.', 401);
  const tokens = await response.json();
  if (!tokens || !tokens.id_token) throw authError('AUTH_INVALID', 'Não foi possível validar o acesso.', 401);
  return tokens;
}

export async function startGoogleLogin(request, env, deps = {}) {
  config(env);
  const origin = new URL(request.url).origin;
  const state = base64url(randomBytes(24, deps));
  const nonce = base64url(randomBytes(24, deps));
  const verifier = base64url(randomBytes(48, deps));
  const challenge = base64url(await digestSha256(verifier));
  const oauth = await sign({ state, nonce, verifier }, env.SESSION_SECRET, '10m');
  const query = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: `${origin}/auth/callback`, response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' });
  return new Response(null, { status: 302, headers: { location: `${GOOGLE_AUTH_URL}?${query}`, 'set-cookie': cookie('xsteam_oauth', oauth, 600), 'cache-control': 'no-store' } });
}

export async function finishGoogleLogin(request, env, deps = {}) {
  config(env);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthToken = readCookie(request.headers.get('cookie'), 'xsteam_oauth');
  if (!code || !state || !oauthToken) throw authError('AUTH_REQUIRED', 'Autenticação necessária.', 401);
  let oauth;
  try { oauth = (await verify(oauthToken, env.SESSION_SECRET, deps)).payload; } catch (_) { throw authError('AUTH_INVALID', 'Não foi possível validar o acesso.', 401); }
  if (oauth.state !== state || !oauth.nonce || !oauth.verifier) throw authError('AUTH_INVALID', 'Não foi possível validar o acesso.', 401);
  const tokens = await exchangeCode(code, `${url.origin}/auth/callback`, oauth.verifier, env, deps);
  try {
    const remoteJwks = deps.createRemoteJWKSet || createRemoteJWKSet;
    const verifyGoogleToken = deps.verifyGoogleToken || jwtVerify;
    const { payload } = await verifyGoogleToken(tokens.id_token, remoteJwks(GOOGLE_JWKS), { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: env.GOOGLE_CLIENT_ID });
    const email = String(payload.email || '').trim().toLowerCase();
    if (payload.nonce !== oauth.nonce || payload.email_verified !== true) throw authError('AUTH_INVALID', 'Não foi possível validar o acesso.', 401);
    if (!allowedEmails(env.ALLOWED_EMAILS).includes(email)) throw authError('FORBIDDEN_EMAIL', 'Conta sem acesso.', 403);
    const session = await sign({ email }, env.SESSION_SECRET, '8h');
    const headers = new Headers({ location: '/', 'cache-control': 'no-store' });
    headers.append('set-cookie', cookie('xsteam_session', session, 28800));
    headers.append('set-cookie', clearCookie('xsteam_oauth'));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    if (error && (error.code === 'FORBIDDEN_EMAIL' || error.code === 'AUTH_INVALID')) throw error;
    throw authError('AUTH_INVALID', 'Não foi possível validar o acesso.', 401);
  }
}

export function logout() { return new Response(null, { status: 204, headers: { 'set-cookie': clearCookie('xsteam_session'), 'cache-control': 'no-store' } }); }
