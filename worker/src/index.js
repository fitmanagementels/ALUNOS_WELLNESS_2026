import { apiError } from './http.js';
import { handleApiRequest } from './router.js';

export async function handleRequest(request, env, context, deps = {}) {
  if (new URL(request.url).pathname === '/api') return handleApiRequest(request, env, deps, context);
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
