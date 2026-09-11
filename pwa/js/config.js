(function () {
  var value = window.XSTEAM_RUNTIME_CONFIG || {};
  window.XsteamConfig = Object.freeze({
    workerUrl: String(value.workerUrl || '').replace(/\/$/, '')
  });
}());
