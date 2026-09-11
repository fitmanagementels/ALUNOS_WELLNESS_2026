const fs = require('node:fs');
const path = require('node:path');

function required(name, env) {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`Variável pública ausente: ${name}`);
  return value;
}

function gerarRuntimeConfig(env = process.env) {
  for (const name of Object.keys(env)) {
    if (/secret|password|refresh_token/i.test(name)) throw new Error(`Variável não permitida na configuração pública: ${name}`);
  }
  return 'window.XSTEAM_RUNTIME_CONFIG = ' + JSON.stringify({
    workerUrl: required('PUBLIC_WORKER_URL', env).replace(/\/$/, '')
  }, null, 2) + ';\n';
}

if (require.main === module) {
  fs.writeFileSync(path.join(__dirname, '..', 'pwa', 'runtime-config.js'), gerarRuntimeConfig({
    PUBLIC_WORKER_URL: process.env.PUBLIC_WORKER_URL
  }));
}

module.exports = { gerarRuntimeConfig };
