function segredoCompartilhadoDashboard_() {
  return String(PropertiesService.getScriptProperties()
    .getProperty('APPS_SCRIPT_SHARED_SECRET') || '').trim();
}

function respostaJsonDashboardPublica_(corpo) {
  return ContentService.createTextOutput(JSON.stringify(corpo))
    .setMimeType(ContentService.MimeType.JSON);
}

function erroApiPublicaDashboard_(code, message) {
  return respostaJsonDashboardPublica_({
    ok: false,
    error: { code: code, message: message }
  });
}

function responderApiPublicaDashboard_(evento) {
  var envelope;
  try {
    envelope = JSON.parse(String(evento && evento.postData && evento.postData.contents || ''));
  } catch (erro) {
    return erroApiPublicaDashboard_('VALIDATION_ERROR', 'Pedido inválido.');
  }

  var segredoEsperado = segredoCompartilhadoDashboard_();
  var segredoRecebido = String(envelope && envelope.sharedSecret || '');
  if (!segredoEsperado || !envelope || segredoRecebido !== segredoEsperado) {
    return erroApiPublicaDashboard_('UNAUTHORIZED', 'Não autorizado.');
  }

  return respostaJsonDashboardPublica_(executarApiDashboard({
    action: String(envelope.action || ''),
    payload: envelope.payload && typeof envelope.payload === 'object' && !Array.isArray(envelope.payload)
      ? envelope.payload
      : {}
  }));
}
