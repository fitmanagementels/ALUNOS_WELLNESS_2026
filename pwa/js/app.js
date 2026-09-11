(function () {
  function mostrarFalha(message) {
    var loading = document.getElementById('loading-screen');
    var text = document.getElementById('loading-message');
    if (loading) loading.hidden = false;
    if (text) text.textContent = message;
  }

  function iniciar() {
    var app = document.getElementById('app');
    var loading = document.getElementById('loading-screen');
    if (app) app.hidden = false;
    if (loading) loading.hidden = false;
    var script = document.createElement('script');
    script.src = './js/dashboard.js';
    script.onload = function () { window.iniciarDashboardPwa(); };
    script.onerror = function () { mostrarFalha('Não foi possível preparar o dashboard.'); };
    document.body.appendChild(script);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () {}); });
  }
}());
