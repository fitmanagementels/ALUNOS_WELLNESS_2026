const ALLOWED_ORIGIN = 'https://fitmanagementels.github.io';
const ACTIONS = new Set(['bootstrap', 'versao', 'salvarMutacoes', 'analiseChurn']);
const MAX_REQUESTS_PER_MINUTE = 120;
const rateBuckets = new Map();

function json(body, status, origin) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  };
  if (origin === ALLOWED_ORIGIN) headers['access-control-allow-origin'] = ALLOWED_ORIGIN;
  return new Response(JSON.stringify(body), { status: status || 200, headers });
}

function erro(code, message) {
  return { ok: false, error: { code, message } };
}

function registrarErroUpstream(runtime, reason, upstream) {
  const logger = runtime && runtime.logger ? runtime.logger : console;
  if (!logger || typeof logger.error !== 'function') return;
  logger.error({
    event: 'apps_script_upstream_error',
    reason,
    upstreamStatus: upstream ? upstream.status : 0,
    contentType: upstream ? (upstream.headers.get('content-type') || '') : ''
  });
}

function origemPermitida(origin) {
  return origin === ALLOWED_ORIGIN;
}

function dentroDoLimite(request) {
  const ip = request.headers.get('cf-connecting-ip') || 'sem-ip';
  const agora = Date.now();
  const inicio = agora - 60 * 1000;
  const registros = (rateBuckets.get(ip) || []).filter(tempo => tempo >= inicio);
  if (registros.length >= MAX_REQUESTS_PER_MINUTE) return false;
  registros.push(agora);
  rateBuckets.set(ip, registros);
  return true;
}

function respostaPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': ALLOWED_ORIGIN,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
      vary: 'Origin'
    }
  });
}

export async function handleRequest(request, env, runtime) {
  const origin = request.headers.get('origin') || '';
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return origemPermitida(origin)
      ? respostaPreflight()
      : json(erro('FORBIDDEN', 'Origem não permitida.'), 403);
  }
  if (url.pathname !== '/api') return json(erro('NOT_FOUND', 'Rota não encontrada.'), 404, origin);
  if (request.method !== 'POST') return json(erro('METHOD_NOT_ALLOWED', 'Use POST.'), 405, origin);
  if (!origemPermitida(origin)) return json(erro('FORBIDDEN', 'Origem não permitida.'), 403);
  if (!dentroDoLimite(request)) return json(erro('RATE_LIMITED', 'Muitas solicitações. Tente novamente em instantes.'), 429, origin);

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json(erro('VALIDATION_ERROR', 'Pedido inválido.'), 400, origin);
  }

  const action = String(body && body.action || '');
  if (!ACTIONS.has(action)) return json(erro('VALIDATION_ERROR', 'Ação inválida.'), 400, origin);
  if (!env || !env.APPS_SCRIPT_WEBAPP_URL || !env.APPS_SCRIPT_SHARED_SECRET) {
    return json(erro('SERVICE_UNAVAILABLE', 'Serviço indisponível.'), 503, origin);
  }

  const fetcher = runtime && runtime.fetch ? runtime.fetch : fetch;
  let upstream;
  try {
    upstream = await fetcher(env.APPS_SCRIPT_WEBAPP_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        sharedSecret: env.APPS_SCRIPT_SHARED_SECRET,
        action,
        payload: body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload) ? body.payload : {}
      })
    });
  } catch (_) {
    registrarErroUpstream(runtime, 'fetch_failed');
    return json(erro('UPSTREAM_ERROR', 'Serviço indisponível.'), 502, origin);
  }

  let result;
  try {
    result = await upstream.json();
  } catch (_) {
    registrarErroUpstream(runtime, 'invalid_json', upstream);
    return json(erro('UPSTREAM_ERROR', 'Serviço indisponível.'), 502, origin);
  }
  if (!upstream.ok || !result || typeof result !== 'object') {
    registrarErroUpstream(runtime, !upstream.ok ? 'http_error' : 'invalid_payload', upstream);
    return json(erro('UPSTREAM_ERROR', 'Serviço indisponível.'), 502, origin);
  }
  return json(result, 200, origin);
}

export default {
  fetch(request, env, context) {
    return handleRequest(request, env, context);
  }
};
