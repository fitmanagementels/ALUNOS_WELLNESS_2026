const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas(['apps-script/00_Config.gs', 'apps-script/05_DriveRepositorio.gs']);
const leitorGas = loadGas([
  'apps-script/00_Config.gs',
  'apps-script/02_ParserHtml.gs',
  'apps-script/02_ParserXlsx.gs',
  'apps-script/05_DriveRepositorio.gs'
], {
  Utilities: {
    newBlob: (bytes, contentType, name) => ({ bytes, contentType, name, files: bytes.files }),
    unzip: blob => blob.files
  }
});

function file(name, id = name) {
  return { nome: name, id };
}

function loteValido(data = '2026-08-21', revisao = '01') {
  return [
    file(`vencimentos_${data}_r${revisao}.xls`),
    file(`fichas_${data}_r${revisao}.xls`),
    file(`avaliacao_fisica_${data}_r${revisao}.xls`),
    file(`permanencia_${data}_r${revisao}.xls`)
  ];
}

function xmlBlob(name, content) {
  return { getName: () => name, getDataAsString: () => content };
}

function xlsxBlob(files) {
  const bytes = [0x50, 0x4b, 0x03, 0x04];
  bytes.files = files;
  return {
    getBytes: () => bytes,
    files,
    getDataAsString: () => ''
  };
}

function htmlBlob(html) {
  return {
    getBytes: () => [0x3c, 0x68, 0x74, 0x6d],
    getDataAsString: () => html
  };
}

function arquivo(blob) {
  return { getBlob: () => blob };
}

function tabelaHtml(cabecalhos, valores) {
  return '<table><tr>' + cabecalhos.map(cabecalho => '<th>' + cabecalho + '</th>').join('') + '</tr><tr>' +
    valores.map(valor => '<td>' + valor + '</td>').join('') + '</tr></table>';
}

function celulaInline(coluna, linha, valor) {
  return '<c r="' + coluna + linha + '" t="inlineStr"><is><t>' + valor + '</t></is></c>';
}

function vencimentosXlsx() {
  var cabecalhos = ['Código', 'Cliente', 'Status Cliente', 'Contrato', 'Valor', 'Início', 'Vencimento', 'Status Contrato', 'Modalidade'];
  var valores = ['101', 'Ana', 'Ativo', '2X - Polo - Personal', '100,00', '01/07/2026', '01/08/2026', 'Ativo', 'Personal'];
  var colunas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  var cabecalhoXml = cabecalhos.map((valor, indice) => celulaInline(colunas[indice], 1, valor)).join('');
  var valoresXml = valores.map((valor, indice) => celulaInline(colunas[indice], 2, valor)).join('');
  return xlsxBlob([
    xmlBlob('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1">' + cabecalhoXml + '</row><row r="2">' + valoresXml + '</row></sheetData></worksheet>')
  ]);
}

test('aceita datas com hífen ou sublinhado e normaliza', () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(gas.parseNomeArquivo('fichas_2026_07_08_r01.xls'))),
    {
      tipo: 'fichas', dataReferencia: '2026-07-08', revisao: '01', extensaoRecebida: 'xls',
      nomeCanonico: 'fichas_2026-07-08_r01.xls'
    }
  );
  assert.equal(gas.parseNomeArquivo('vencimentos_2026-07-08_r01.xls').dataReferencia, '2026-07-08');
});

test('aceita XLSX e preserva a extensão recebida no metadado', () => {
  const parsed = gas.parseNomeArquivo('vencimentos_2026-07-25_r01.xlsx');
  assert.equal(parsed.extensaoRecebida, 'xlsx');
  assert.equal(parsed.nomeCanonico, 'vencimentos_2026-07-25_r01.xlsx');
});

test('detecta XLSX pelo cabeçalho ZIP mesmo quando o nome termina em XLS', () => {
  const blob = { getBytes: () => [0x50, 0x4b, 0x03, 0x04] };
  assert.deepEqual(
    JSON.parse(JSON.stringify(gas.detectarFormatoArquivo(blob))),
    { formato: 'xlsx', extensaoCanonica: 'xlsx' }
  );
});

test('exige exatamente os quatro tipos no mesmo lote', () => {
  assert.equal(gas.agruparLote(loteValido()).arquivos.length, 4);
  assert.throws(() => gas.agruparLote(loteValido().slice(0, 3)), /Lote incompleto.*permanencia/);
  assert.throws(
    () => gas.agruparLote([file('fichas_2026-07-08_r01.xls'), file('vencimentos_2026-07-08_r01.xls')]),
    /Lote incompleto/
  );
  assert.throws(
    () => gas.agruparLote([
      file('fichas_2026-07-08_r01.xls'),
      file('vencimentos_2026-07-08_r01.xls'),
      file('avaliacao_fisica_2026-07-08_r02.xls')
    ]),
    /mesma data e revisão/
  );
});

test('rejeita arquivo extra e tipo repetido', () => {
  assert.throws(() => gas.agruparLote([
    file('fichas_2026-07-08_r01.xls'),
    file('vencimentos_2026-07-08_r01.xls'),
    file('avaliacao_fisica_2026-07-08_r01.xls'),
    file('notas.txt')
  ]), /Arquivo inválido/);
  assert.throws(() => gas.agruparLote([
    file('fichas_2026-07-08_r01.xls', '1'),
    file('fichas_2026-07-08_r01.xls', '2'),
    file('vencimentos_2026-07-08_r01.xls'),
    file('avaliacao_fisica_2026-07-08_r01.xls')
  ]), /Tipo repetido/);
});

test('ignora apenas o POP reservado ao validar o lote de entrada', () => {
  const lote = gas.agruparLote(gas.filtrarArquivosOperacionaisEntrada_([
    file('LEIA-ME_POP_01_ENTRADA.pdf'),
    file('fichas_2026-07-19_r01.xls'),
    file('vencimentos_2026-07-19_r01.xls'),
    file('avaliacao_fisica_2026-07-19_r01.xls'),
    file('permanencia_2026-07-19_r01.xls')
  ]));

  assert.equal(lote.arquivos.length, 4);
  assert.throws(() => gas.agruparLote(gas.filtrarArquivosOperacionaisEntrada_([
    file('leia-me_pop_01_entrada.pdf'),
    file('notas.txt'),
    file('fichas_2026-07-19_r01.xls'),
    file('vencimentos_2026-07-19_r01.xls'),
    file('avaliacao_fisica_2026-07-19_r01.xls'),
    file('permanencia_2026-07-19_r01.xls')
  ])), /Arquivo inválido/);
});

test('usa leitor XLSX e corrige o nome canônico de XLSX renomeado como XLS', () => {
  const lote = leitorGas.agruparLote([
    { nome: 'vencimentos_2026-07-25_r01.xls', arquivo: arquivo(vencimentosXlsx()) },
    {
      nome: 'fichas_2026-07-25_r01.xlsx',
      arquivo: arquivo(htmlBlob(tabelaHtml(['Código', 'Data Início', 'Contato'], ['101', '01/07/2026', '9999'])))
    },
    {
      nome: 'avaliacao_fisica_2026-07-25_r01.xls',
      arquivo: arquivo(htmlBlob(tabelaHtml(['Código', 'Data da Avaliação'], ['101', '02/07/2026'])))
    },
    {
      nome: 'permanencia_2026-07-25_r01.xls',
      arquivo: arquivo(htmlBlob(tabelaHtml(
        ['Código', 'Cliente', 'Cliente desde', 'Status atual', 'Continuidade (meses)', 'Contratos'],
        ['101', 'ALUNO TESTE', '01/01/2024', 'Ativo', '30', '3']
      )))
    }
  ]);

  const dados = leitorGas.lerTabelasDoLote(lote);

  assert.equal(lote.arquivosPorTipo.vencimentos.nomeCanonico, 'vencimentos_2026-07-25_r01.xlsx');
  assert.equal(lote.arquivosPorTipo.fichas.nomeCanonico, 'fichas_2026-07-25_r01.xls');
  assert.equal(dados.vencimentos[0].codigo, '101');
});

test('rejeita conteúdo que não seja tabela HTML nem XLSX', () => {
  const lote = leitorGas.agruparLote([
    { nome: 'vencimentos_2026-07-25_r02.xls', arquivo: arquivo({ getBytes: () => [1, 2, 3], getDataAsString: () => 'arquivo inválido' }) },
    { nome: 'fichas_2026-07-25_r02.xls', arquivo: arquivo(htmlBlob(tabelaHtml(['Código', 'Data Início', 'Contato'], ['101', '01/07/2026', '9999']))) },
    { nome: 'avaliacao_fisica_2026-07-25_r02.xls', arquivo: arquivo(htmlBlob(tabelaHtml(['Código', 'Data da Avaliação'], ['101', '02/07/2026']))) },
    { nome: 'permanencia_2026-07-25_r02.xls', arquivo: arquivo(htmlBlob(tabelaHtml(['Código', 'Cliente', 'Cliente desde', 'Status atual', 'Continuidade (meses)', 'Contratos'], ['101', 'ALUNO TESTE', '01/01/2024', 'Ativo', '30', '3']))) }
  ]);

  assert.throws(() => leitorGas.lerTabelasDoLote(lote), /Formato de arquivo inválido/);
});
