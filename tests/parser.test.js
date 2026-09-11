const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas(['apps-script/02_ParserHtml.gs']);
const xlsxGas = loadGas(['apps-script/02_ParserHtml.gs', 'apps-script/02_ParserXlsx.gs'], {
  Utilities: {
    newBlob: (bytes, contentType, name) => ({ bytes, contentType, name, files: bytes.files }),
    unzip: blob => blob.files
  }
});

function xmlBlob(name, content) {
  return {
    getName: () => name,
    getDataAsString: () => content
  };
}

function xlsxBlob(files) {
  const bytes = [0x50, 0x4b, 0x03, 0x04];
  bytes.files = files;
  return {
    getBytes: () => bytes,
    files
  };
}

test('interpreta células vazias, acentos e linhas HTML', () => {
  const html = fs.readFileSync('tests/fixtures/vencimentos.html', 'utf8');
  const rows = gas.parseTabelaHtml(html);
  assert.equal(rows[0][1], 'Código');
  assert.equal(rows[1][11], 'MUSCULAÇÃO');
});

test('mapeia os dados pelos cabeçalhos normalizados', () => {
  const html = fs.readFileSync('tests/fixtures/vencimentos.html', 'utf8');
  const rows = gas.parseTabelaHtml(html);
  const objects = gas.tabelaParaObjetos(rows, ['codigo', 'cliente', 'contrato']);
  assert.equal(objects.length, 3);
  assert.equal(objects[0].codigo, '100');
  assert.equal(objects[2].contrato, 'CONSULTORIA EM CORRIDA');
});

test('rejeita relatório sem cabeçalho obrigatório', () => {
  assert.throws(
    () => gas.tabelaParaObjetos([['Código', 'Cliente'], ['1', 'Teste']], ['codigo', 'contrato']),
    /Cabeçalhos obrigatórios/
  );
});

test('ignora a linha-resumo Total na coluna de código', () => {
  const html = fs.readFileSync('tests/fixtures/fichas.html', 'utf8');
  const objects = gas.tabelaParaObjetos(
    gas.parseTabelaHtml(html),
    ['codigo', 'data inicio', 'contato']
  );
  assert.equal(objects.length, 2);
  assert.equal(objects.some(row => row.codigo.startsWith('Total:')), false);
});

test('interpreta permanência e ignora rodapé Total sem a palavra registros', () => {
  const html = fs.readFileSync('tests/fixtures/permanencia.html', 'utf8');
  const objects = gas.tabelaParaObjetos(gas.parseTabelaHtml(html), [
    'codigo', 'cliente', 'cliente desde', 'status atual', 'continuidade (meses)', 'contratos'
  ]);
  assert.equal(objects.length, 2);
  assert.equal(objects[0]['cliente desde'], '10/01/2024');
  assert.equal(objects.some(row => row.codigo.startsWith('Total:')), false);
});

test('interpreta shared strings, texto inline e números de XLSX', () => {
  const rows = xlsxGas.parseTabelaXlsx(xlsxBlob([
    xmlBlob(
      'xl/sharedStrings.xml',
      '<sst><si><t>Código</t></si><si><t>Cliente</t></si><si><t>101</t></si></sst>'
    ),
    xmlBlob(
      'xl/worksheets/sheet1.xml',
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="inlineStr"><is><t>Ana</t></is></c><c r="C2"><v>12.5</v></c></row></sheetData></worksheet>'
    )
  ]));

  assert.deepEqual(JSON.parse(JSON.stringify(rows)), [['Código', 'Cliente'], ['101', 'Ana', '12.5']]);
});

test('converte data serial XLSX para dd/MM/yyyy', () => {
  const rows = xlsxGas.parseTabelaXlsx(xlsxBlob([
    xmlBlob('xl/styles.xml', '<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>'),
    xmlBlob(
      'xl/worksheets/sheet1.xml',
      '<worksheet><sheetData><row r="1"><c r="A1"><v>46000</v></c></row><row r="2"><c r="A2" s="1"><v>46000</v></c></row></sheetData></worksheet>'
    )
  ]));

  assert.deepEqual(JSON.parse(JSON.stringify(rows)), [['46000'], ['09/12/2025']]);
});

test('rejeita XLSX sem worksheet', () => {
  assert.throws(() => xlsxGas.parseTabelaXlsx(xlsxBlob([])), /nenhuma worksheet/);
});

test('recria o blob como ZIP antes de descompactar XLSX vindo do Drive', () => {
  let blobRecebidoPeloUnzip = null;
  const gasComBlobZip = loadGas(['apps-script/02_ParserHtml.gs', 'apps-script/02_ParserXlsx.gs'], {
    Utilities: {
      newBlob: (bytes, contentType, name) => ({ bytes, contentType, name }),
      unzip: blob => {
        blobRecebidoPeloUnzip = blob;
        return [xmlBlob('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1"><v>101</v></c></row></sheetData></worksheet>')];
      }
    }
  });

  gasComBlobZip.parseTabelaXlsx({ getBytes: () => [0x50, 0x4b, 0x03, 0x04] });

  assert.equal(blobRecebidoPeloUnzip.contentType, 'application/zip');
  assert.equal(blobRecebidoPeloUnzip.name, 'relatorio.xlsx');
  assert.deepEqual(blobRecebidoPeloUnzip.bytes, [0x50, 0x4b, 0x03, 0x04]);
});
