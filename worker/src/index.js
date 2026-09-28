import { apiError } from './http.js';
import { handleApiRequest } from './router.js';
import { startGoogleLogin, finishGoogleLogin, logout } from './google-oauth.js';

export async function handleRequest(request, env, context, deps = {}) {
  const pathname = new URL(request.url).pathname;
  const authFailure = (error) => new Response(error && error.status === 403 ? 'Conta sem acesso.' : 'Não foi possível entrar.', { status: error && error.status || 401, headers: { 'cache-control': 'no-store' } });
  try {
    if (pathname === '/auth/login') return request.method === 'GET' ? await (deps.startGoogleLogin || startGoogleLogin)(request, env, deps) : apiError('METHOD_NOT_ALLOWED', 'Use GET.', 405);
    if (pathname === '/auth/callback') return request.method === 'GET' ? await (deps.finishGoogleLogin || finishGoogleLogin)(request, env, deps) : apiError('METHOD_NOT_ALLOWED', 'Use GET.', 405);
    if (pathname === '/auth/logout') return request.method === 'POST' ? await (deps.logout || logout)(request, env, deps) : apiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
  } catch (error) { return authFailure(error); }
  if (pathname.startsWith('/auth/')) return apiError('NOT_FOUND', 'Rota não encontrada.', 404);
  if (pathname === '/api') return handleApiRequest(request, env, deps, context);
  if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
    return apiError('ASSETS_UNAVAILABLE', 'Aplicação indisponível.', 503);
  }
  return env.ASSETS.fetch(request);
}

export default {
  fetch(request, env, context) {
    return handleRequest(request, env, context);
  }
};
