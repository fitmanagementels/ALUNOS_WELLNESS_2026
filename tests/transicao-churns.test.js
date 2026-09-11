const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas([
  'apps-script/00_Config.gs',
  'apps-script/21_TransicaoChurns.gs'
]);

function json(value) { return JSON.parse(JSON.stringify(value)); }

const fonteOficialTeste = [
  ['', 'Código', 'Cliente', 'Contrato', 'Valor', 'Início', 'Vencimento', 'Professor', 'Modalidade'],
  ['', '42.0', 'NOME OFICIAL', '2X', 765, '01/06/2026', '30/07/2026', 'Ruan', 'Musculação']
];

test('consolida cada ID pelo maior vencimento oficial', () => {
  const previa = gas.construirPreviaTransicaoChurns_([
    ['', 'Código', 'Cliente', 'Contrato', 'Valor', 'Início', 'Vencimento', 'Professor', 'Modalidade'],
    ['', '42.0', 'ALUNO A', '2X', 765, '01/06/2026', '30/06/2026', 'Xico', 'Musculação'],
    ['', '42', 'ALUNO A', '3X', 1000, '01/07/2026', '30/07/2026', 'Ruan', 'Musculação']
  ], []);

  assert.equal(previa.linhas.length, 1);
  assert.equal(previa.linhas[0].grupo, 'Migrará sem dados manuais anteriores');
  assert.equal(previa.linhas[0].alunoId, '42');
  assert.equal(previa.linhas[0].planoOficial, '3X');
  assert.equal(previa.linhas[0].vencimentoOficial, '30/07/2026');
});

test('preserva somente telefone e campos manuais pelo ID', () => {
  const antiga = [[
    'old-1', '42', 'NOME ANTIGO', '85999999999', '01/01/2026',
    'Elohim', 'Xico', 'Horário', 'Mudança de rotina', 'Ligação feita', 'criado', 'atualizado'
  ]];
  const previa = gas.construirPreviaTransicaoChurns_(fonteOficialTeste, antiga);
  const linha = previa.linhas[0];

  assert.equal(linha.grupo, 'Migrará com dados manuais preservados');
  assert.equal(linha.nomeOficial, 'NOME OFICIAL');
  assert.equal(linha.nomeAnterior, 'NOME ANTIGO');
  assert.equal(linha.vencimentoOficial, '30/07/2026');
  assert.equal(linha.telefonePreservado, '85999999999');
  assert.equal(linha.profissionalResponsavel, 'Elohim');
  assert.equal(linha.ultimoPersonal, 'Xico');
  assert.equal(linha.motivoSaida, 'Horário');
  assert.equal(linha.sinaisContexto, 'Mudança de rotina');
  assert.equal(linha.acaoRetencao, 'Ligação feita');
});

test('classifica antigo sem fonte e novo sem dados manuais', () => {
  const fonteComIdNovo = [
    ['Código', 'Cliente', 'Contrato', 'Valor', 'Início', 'Vencimento', 'Professor', 'Modalidade'],
    ['77', 'NOME NOVO', '2X', 765, '01/06/2026', '30/06/2026', 'Ruan', 'Musculação']
  ];
  const churnsComIdLegado = [[
    'old-99', '99', 'NOME LEGADO', '', '01/01/2026', '', '', 'Motivo', '', '', '', ''
  ]];
  const previa = gas.construirPreviaTransicaoChurns_(fonteComIdNovo, churnsComIdLegado);

  assert.deepEqual(json(previa.resumo), {
    migraraComDadosManuais: 0,
    migraraSemDadosManuais: 1,
    antigoSemCorrespondenteOficial: 1,
    divergenciaParaRevisao: 0
  });
  assert.deepEqual(json(previa.linhas.map(linha => linha.grupo)), [
    'Migrará sem dados manuais anteriores',
    'Registro antigo sem correspondente oficial'
  ]);
});

test('não transfere automaticamente em empate oficial ou duplicidade manual', () => {
  const fonteComEmpate = [
    ['Código', 'Cliente', 'Contrato', 'Valor', 'Início', 'Vencimento', 'Professor', 'Modalidade'],
    ['42', 'NOME OFICIAL', '2X', 765, '01/06/2026', '30/07/2026', 'Ruan', 'Musculação'],
    ['42', 'NOME OFICIAL', '3X', 1000, '01/07/2026', '30/07/2026', 'Xico', 'Musculação'],
    ['43', 'OUTRO OFICIAL', '2X', 765, '01/06/2026', '30/07/2026', 'Ruan', 'Musculação']
  ];
  const churnsComDoisManuaisMesmoId = [
    ['old-1', '43', 'OUTRO ANTIGO', '', '01/01/2026', 'Elohim', '', '', '', '', '', ''],
    ['old-2', '43', 'OUTRO ANTIGO', '', '02/01/2026', '', 'Xico', '', '', '', '', '']
  ];
  const previa = gas.construirPreviaTransicaoChurns_(fonteComEmpate, churnsComDoisManuaisMesmoId);
  const divergencias = previa.linhas.filter(linha => linha.grupo === 'Divergência para revisão');

  assert.equal(divergencias.length, 2);
  assert.deepEqual(json(divergencias.map(linha => linha.detalheRevisao).sort()), [
    'Empate no maior vencimento oficial',
    'Mais de um registro manual para o ID'
  ]);
  assert.ok(divergencias.every(linha => !linha.telefonePreservado && !linha.motivoSaida));
});
