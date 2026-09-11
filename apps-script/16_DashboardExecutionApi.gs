function executarApiDashboard(request) {
  request = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
  var action = String(request.action || '');
  var payload = request.payload && typeof request.payload === 'object' && !Array.isArray(request.payload)
    ? request.payload : {};
  var handlers = {
    bootstrap: function () { return obterBootstrapDashboard(); },
    versao: function () { return obterVersaoDashboard(); },
    salvarMutacoes: function () { return salvarMutacoesDashboard(payload); },
    analiseChurn: function () { return obterAnaliseChurnsDashboard(payload); }
  };
  if (!Object.prototype.hasOwnProperty.call(handlers, action)) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Ação de dashboard inválida.' } };
  }
  try {
    var data = handlers[action]();
    return {
      ok: true,
      data: data,
      meta: { versao: data && data.versao ? String(data.versao) : '' }
    };
  } catch (erro) {
    console.error('dashboard_execution_api_error', {
      action: action,
      tipo: typeof tipoErroDashboardSeguro_ === 'function' ? tipoErroDashboardSeguro_(erro) : 'Error'
    });
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir esta solicitação.' } };
  }
}
