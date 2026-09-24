import { authenticate as authenticateAccess } from './auth.js';
import { buildBootstrap as buildDashboardBootstrap } from './services/bootstrap-service.js';
import { saveMutations as saveDashboardMutations } from './services/mutation-service.js';
import { analyzeChurn as analyzeDashboardChurn } from './services/churn-analysis-service.js';
import { apiError, json } from './http.js';

const MAX_JSON_BYTES = 1024 * 1024;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function parseBody(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_JSON_BYTES) throw Object.assign(new Error('Pedido muito grande.'), { code: 'PAYLOAD_TOO_LARGE', status: 413 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES) {
    throw Object.assign(new Error('Pedido muito grande.'), { code: 'PAYLOAD_TOO_LARGE', status: 413 });
  }
  try { return JSON.parse(raw); } catch (_) {
    throw Object.assign(new Error('Pedido inválido.'), { code: 'VALIDATION_ERROR', status: 400 });
  }
}

export async function handleApiRequest(request, env, deps = {}, context) {
  const url = new URL(request.url);
  if (url.pathname !== '/api') return apiError('NOT_FOUND', 'Rota não encontrada.', 404);
  if (request.method !== 'POST') return apiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);

  let actor;
  try {
    actor = await (deps.authenticate || authenticateAccess)(request, env, {}, context);
  } catch (error) {
    return apiError(error.code || 'AUTH_INVALID', error.message || 'Não foi possível validar o acesso.', error.status || 401);
  }

  let body;
  try { body = await parseBody(request); } catch (error) {
    return apiError(error.code || 'VALIDATION_ERROR', error.message || 'Pedido inválido.', error.status || 400);
  }
  const action = String(body && body.action || '');
  const payload = isObject(body && body.payload) ? body.payload : {};
  const buildBootstrap = deps.buildBootstrap || buildDashboardBootstrap;
  const saveMutations = deps.saveMutations || saveDashboardMutations;
  const analyzeChurn = deps.analyzeChurn || analyzeDashboardChurn;

  try {
    if (action === 'bootstrap') {
      const data = await buildBootstrap(env.DB);
      return json({ ok: true, data, meta: { versao: data.versao } });
    }
    if (action === 'versao') {
      const data = await buildBootstrap(env.DB);
      return json({ ok: true, data: { versao: data.versao }, meta: { versao: data.versao } });
    }
    if (action === 'salvarMutacoes') {
      const data = await saveMutations(env.DB, actor, payload);
      return json({ ok: true, data });
    }
    if (action === 'analiseChurn') {
      const data = await analyzeChurn(env.DB, payload);
      return json({ ok: true, data });
    }
    return apiError('VALIDATION_ERROR', 'Ação inválida.', 400);
  } catch (error) {
    console.error({ event: 'dashboard_api_error', action, actor: actor.email, code: error && error.code || 'INTERNAL_ERROR' });
    return apiError('SERVICE_UNAVAILABLE', 'Serviço indisponível.', 503);
  }
}
