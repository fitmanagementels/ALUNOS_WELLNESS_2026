(function () {
  function error(message, code) {
    var value = new Error(message);
    value.code = code || 'API_ERROR';
    return value;
  }

  async function call(action, payload) {
    var response;
    try {
      response = await fetch('/api', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: action, payload: payload || {} })
      });
    } catch (_) {
      throw error('Não foi possível comunicar com o dashboard.', 'NETWORK_ERROR');
    }
    var body;
    try { body = await response.json(); } catch (_) { body = {}; }
    if (!response.ok || body.ok !== true) {
      throw error(
        body && body.error && body.error.message || 'Não foi possível comunicar com o dashboard.',
        body && body.error && body.error.code
      );
    }
    return body.data;
  }

  window.XsteamApi = { call: call };
}());
