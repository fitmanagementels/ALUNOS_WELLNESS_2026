const fs = require('node:fs');
const { loadGas } = require('../tests/helpers/load-gas');

const paths = process.argv.slice(2);
if (paths.length !== 1) {
  throw new Error('Uso: npm run validate:permanence -- <permanencia.xls>');
}

const gas = loadGas([
  'apps-script/00_Config.gs',
  'apps-script/01_Normalizacao.gs',
  'apps-script/02_ParserHtml.gs',
  'apps-script/03_Permanencia.gs'
]);
const html = fs.readFileSync(paths[0], 'utf8');
const linhas = gas.tabelaParaObjetos(
  gas.parseTabelaHtml(html),
  Array.from(gas.CABECALHOS_ORIGEM.permanencia)
);
const resultado = gas.construirAtualizacaoPermanencia_(linhas, [], [], {
  dataReferencia: '2026-08-07', revisao: '01', importacaoId: 'auditoria-local',
  registradoEm: new Date(), cargaInicial: true
});

console.log(JSON.stringify({
  linhasFonte: linhas.length,
  idsUnicos: new Set(linhas.map(item => item.codigo)).size,
  datasValidas: resultado.base.filter(item =>
    item.cliente_desde && typeof item.cliente_desde.getTime === 'function' &&
    !isNaN(item.cliente_desde.getTime())
  ).length,
  eventosIniciais: resultado.historico.length,
  status: resultado.base.reduce(function (acc, item) {
    const key = String(item.status_permanencia || 'Não informado');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})
}, null, 2));
