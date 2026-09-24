import { apiError } from './http.js';
import { handleApiRequest } from './router.js';
import { createBackup as createD1Backup } from './services/backup-service.js';

export async function handleRequest(request, env, context, deps = {}) {
  if (new URL(request.url).pathname === '/api') return handleApiRequest(request, env, deps, context);
  if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
    return apiError('ASSETS_UNAVAILABLE', 'Aplicação indisponível.', 503);
  }
  return env.ASSETS.fetch(request);
}

export function handleScheduled(controller, env, context, deps = {}) {
  const createBackup = deps.createBackup || createD1Backup;
  const pending = createBackup(env.DB, env.FILES, new Date(controller.scheduledTime));
  if (context && typeof context.waitUntil === 'function') context.waitUntil(pending);
  return pending;
}

export default {
  fetch(request, env, context) {
    return handleRequest(request, env, context);
  },
  scheduled(controller, env, context) {
    return handleScheduled(controller, env, context);
  }
};
