const fs = require('node:fs');
const path = require('node:path');

const origem = process.argv[2];
const destino = process.argv[3];
if (!origem || !destino) throw new Error('Uso: node scripts/preparar-cancelados.js <origem.xls> <destino.xls>');

const polos = [
  'XSTEAM WELLNESS CLUB', 'GREENLIFE RIOMAR', 'GREENLIFE ALDEOTA', 'GREENLIFE CT',
  'GREENLIFE', 'CB', 'PACOTE', 'FISIOTERAPIA'
];

function limparHtml(texto) {
  return String(texto).replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').trim();
}

function separarContrato(contrato) {
  const texto = limparHtml(contrato).replace(/\s+/g, ' ').trim();
  const frequencia = /^([0-9]+X)\b/i.exec(texto);
  if (!frequencia) return { frequencia: '', polo: '' };
  const restante = texto.slice(frequencia[0].length).replace(/^\s*-\s*/, '').toUpperCase();
  const polo = polos.find(item => restante === item || restante.startsWith(`${item} -`)) || '';
  return { frequencia: frequencia[1].toUpperCase(), polo };
}

let html = fs.readFileSync(origem, 'utf8');
html = html.replace(/(<th class='text-center'>Contrato<\/th>)/i, '$1<th class="text-center">Contrato (vezes/semana)</th><th class="text-center">Polo</th>');
html = html.replace(/<tr>([\s\S]*?)<\/tr>/gi, (linha, conteudo) => {
  const celulas = [...conteudo.matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/gi)];
  if (celulas.length !== 7) return linha;
  const contrato = separarContrato(celulas[4][0]);
  return `<tr>${conteudo.slice(0, celulas[4].index + celulas[4][0].length)}<td class='text-center'>${contrato.frequencia}</td><td class='text-center'>${contrato.polo}</td>${conteudo.slice(celulas[4].index + celulas[4][0].length)}</tr>`;
});
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, html, 'utf8');
