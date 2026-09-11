const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas([
  'apps-script/00_Config.gs',
  'apps-script/09_DashboardMetricas.gs',
  'apps-script/10_DashboardPaginas.gs'
]);
const hoje = new Date(2026, 6, 11, 12);
const alunos = [
  { id: '1', aluno: 'ALUNO A', contato: '8500000001', status: 'Ativo', data_ficha: '', data_avaliacao: new Date(2026, 6, 1) },
  { id: '2', aluno: 'ALUNO B', contato: '8500000002', status: 'Ativo', data_ficha: new Date(2026, 5, 1), data_avaliacao: '' }
];
const contratos = [
  { _chave_contrato: 'c1', id: '1', contrato_x_sem: '2X', valor: 100, vencimento: new Date(2026, 6, 10), status_contrato: 'Finalizado', polo: 'POLO A', modalidade: 'MUSCULAÇÃO' },
  { _chave_contrato: 'c2', id: '1', contrato_x_sem: '3X', valor: 200, vencimento: new Date(2026, 6, 18), status_contrato: 'Ativo', polo: 'POLO B', modalidade: 'CORRIDA' },
  { _chave_contrato: 'c3', id: '2', contrato_x_sem: '2X', valor: 300, vencimento: new Date(2026, 7, 1), status_contrato: 'Ativo', polo: 'POLO A', modalidade: 'MUSCULAÇÃO' }
];

test('vencimentos deduplica contratos e soma apenas a janela de 30 dias', () => {
  const page = gas.montarPaginaVencimentos_(alunos, contratos.concat(contratos[0]), hoje);
  assert.deepEqual(JSON.parse(JSON.stringify(page.kpis)), { vencidos: 1, ate7: 1, ate30: 2, valorAte30: 500 });
  assert.equal(page.lista[0].chave, 'c1');
  assert.equal(page.graficos.semanas.length, 6);
});

test('fichas e avaliações contam alunos, não contratos', () => {
  const fichas = gas.montarPaginaFichas_(alunos, contratos, hoje);
  const avaliacoes = gas.montarPaginaAvaliacoes_(alunos, contratos, hoje);
  assert.equal(fichas.kpis.ausentes, 1);
  assert.equal(fichas.kpis.desatualizadas, 1);
  assert.equal(avaliacoes.kpis.ausentes, 1);
  assert.equal(avaliacoes.kpis.atualizadas, 1);
  assert.ok(fichas.graficos.faixas);
  assert.ok(avaliacoes.graficos.faixas);
  assert.ok(Array.isArray(fichas.graficos.coberturaPorPolo));
  assert.ok(Array.isArray(avaliacoes.graficos.coberturaPorPolo));
});

test('planos calcula alunos, contratos, valor e ticket sem duplicar', () => {
  const page = gas.montarPaginaPlanos_(alunos, contratos.concat(contratos[0]));
  assert.deepEqual(
    JSON.parse(JSON.stringify({
      alunos: page.kpis.alunos, contratos: page.kpis.contratos,
      valor: page.kpis.valor, ticketMedio: page.kpis.ticketMedio
    })),
    { alunos: 2, contratos: 3, valor: 600, ticketMedio: 200 }
  );
  assert.deepEqual(JSON.parse(JSON.stringify(page.graficos.valorPorPolo)), { 'POLO A': 400, 'POLO B': 200 });
});

test('opções de filtro são únicas e ordenadas em pt-BR', () => {
  const polos = gas.opcoesDashboard_(
    [{ polo: 'POLO B' }, { polo: ' POLO A ' }, { polo: 'POLO B' }, { polo: '' }],
    'polo'
  );
  const statusAlunos = gas.opcoesDashboard_(
    [{ status: 'Inativo' }, { status: 'Ativo' }, { status: 'Ativo' }],
    'status'
  );

  assert.deepEqual(Array.from(polos), ['POLO A', 'POLO B']);
  assert.deepEqual(Array.from(statusAlunos), ['Ativo', 'Inativo']);
});

test('filtros restringem alunos e contratos pela interseção', () => {
  const base = {
    alunos: alunos.concat({ id: '3', aluno: 'ALUNO C', status: 'Inativo' }),
    contratos: contratos.concat({
      _chave_contrato: 'c4', id: '3', polo: 'POLO B', valor: 400
    })
  };

  const polo = gas.filtrarBaseDashboard_(base.alunos, base.contratos, { polo: 'POLO A' });
  assert.deepEqual(Array.from(polo.alunos, aluno => aluno.id), ['1', '2']);
  assert.deepEqual(Array.from(polo.contratos, contrato => contrato._chave_contrato), ['c1', 'c3']);

  const status = gas.filtrarBaseDashboard_(base.alunos, base.contratos, { statusAluno: 'Inativo' });
  assert.deepEqual(Array.from(status.alunos, aluno => aluno.id), ['3']);
  assert.deepEqual(Array.from(status.contratos, contrato => contrato._chave_contrato), ['c4']);

  const intersecao = gas.filtrarBaseDashboard_(base.alunos, base.contratos, {
    polo: 'POLO A', statusAluno: 'Inativo'
  });
  assert.deepEqual(Array.from(intersecao.alunos), []);
  assert.deepEqual(Array.from(intersecao.contratos), []);
});

test('valores de filtro desconhecidos produzem uma população vazia', () => {
  const porPolo = gas.filtrarBaseDashboard_(alunos, contratos, { polo: 'POLO INEXISTENTE' });
  const porStatus = gas.filtrarBaseDashboard_(alunos, contratos, { statusAluno: 'Desconhecido' });

  assert.deepEqual(Array.from(porPolo.alunos), []);
  assert.deepEqual(Array.from(porPolo.contratos), []);
  assert.deepEqual(Array.from(porStatus.alunos), []);
  assert.deepEqual(Array.from(porStatus.contratos), []);
  const situacaoIrrelevante = gas.filtrarBaseDashboard_(alunos, contratos, { situacao: 'desconhecida' }, hoje, 'planos');
  assert.deepEqual(Array.from(situacaoIrrelevante.alunos), []);
  assert.deepEqual(Array.from(situacaoIrrelevante.contratos), []);
});

test('ids herdados do protótipo preservam associação entre alunos e contratos', () => {
  const ids = ['toString', 'constructor', '__proto__'];
  const alunosEspeciais = ids.map((id, indice) => ({
    id, aluno: `ALUNO ${indice}`, contato: `CONTATO ${indice}`, status: 'Ativo',
    data_ficha: new Date(2026, 6, 1), data_avaliacao: new Date(2026, 6, 1)
  }));
  const contratosEspeciais = ids.map((id, indice) => ({
    _chave_contrato: `especial-${indice}`, id, contrato_x_sem: '2X', valor: 100,
    vencimento: new Date(2026, 6, 20), status_contrato: 'Ativo', polo: `POLO ${indice}`,
    modalidade: 'MUSCULAÇÃO'
  }));

  const vencimentos = gas.montarPaginaVencimentos_(alunosEspeciais, contratosEspeciais, hoje);
  const fichas = gas.montarPaginaFichas_(alunosEspeciais, contratosEspeciais, hoje);

  assert.deepEqual(vencimentos.lista.map(item => item.aluno).sort(), ['ALUNO 0', 'ALUNO 1', 'ALUNO 2']);
  assert.equal(fichas.lista.length, 3);
  assert.deepEqual(fichas.lista.map(item => item.polos[0]).sort(), ['POLO 0', 'POLO 1', 'POLO 2']);
});

test('rótulos herdados do protótipo são contados como grupos próprios', () => {
  const rotulos = ['toString', 'constructor', '__proto__'];
  const contratosEspeciais = rotulos.map((rotulo, indice) => ({
    _chave_contrato: `grupo-${indice}`, id: String(indice), contrato_x_sem: rotulo,
    valor: indice + 1, vencimento: new Date(2026, 6, 20), status_contrato: rotulo,
    polo: rotulo, modalidade: rotulo
  }));

  const page = gas.montarPaginaPlanos_([], contratosEspeciais);
  const polos = JSON.parse(JSON.stringify(page.graficos.polos));
  const valores = JSON.parse(JSON.stringify(page.graficos.valorPorPolo));

  rotulos.forEach((rotulo, indice) => {
    assert.equal(polos[rotulo], 1);
    assert.equal(valores[rotulo], indice + 1);
  });
});

test('busca e filtros completos restringem a mesma população', () => {
  const baseAlunos = alunos.concat({ id: 'ABC-3', aluno: 'MARIA SILVA', status: 'Inativo', data_ficha: '', data_avaliacao: '' });
  const baseContratos = contratos.concat({
    _chave_contrato: 'c4', id: 'ABC-3', contrato_x_sem: '5X', valor: 400,
    inicio_corrente: new Date(2026, 6, 1), vencimento: new Date(2026, 8, 1),
    status_contrato: 'Pendente', polo: 'POLO C', modalidade: 'NATAÇÃO'
  });

  const combinado = gas.filtrarBaseDashboard_(baseAlunos, baseContratos, {
    busca: 'maria', statusAluno: 'Inativo', polo: 'POLO C', frequencia: '5X',
    modalidade: 'NATAÇÃO', statusContrato: 'Pendente', periodoDias: '60'
  }, hoje, 'planos');

  assert.deepEqual(combinado.alunos.map(item => item.id), ['ABC-3']);
  assert.deepEqual(combinado.contratos.map(item => item._chave_contrato), ['c4']);
  assert.deepEqual(gas.filtrarBaseDashboard_(baseAlunos, baseContratos, { busca: 'abc-3' }, hoje, 'planos').alunos.map(item => item.id), ['ABC-3']);
  assert.deepEqual(gas.filtrarBaseDashboard_(baseAlunos, baseContratos, { modalidade: 'DESCONHECIDA' }, hoje, 'planos').alunos, []);
});

test('situação é aplicada conforme a página e período limita vencimentos futuros', () => {
  const vencidos = gas.filtrarBaseDashboard_(alunos, contratos, { situacao: 'vencido' }, hoje, 'vencimentos');
  assert.deepEqual(vencidos.contratos.map(item => item._chave_contrato), ['c1']);
  const fichasAusentes = gas.filtrarBaseDashboard_(alunos, contratos, { situacao: 'ausente' }, hoje, 'fichas');
  assert.deepEqual(fichasAusentes.alunos.map(item => item.id), ['1']);
  const trintaDias = gas.filtrarBaseDashboard_(alunos, contratos, { periodoDias: '30' }, hoje, 'planos');
  assert.deepEqual(trintaDias.contratos.map(item => item._chave_contrato), ['c2', 'c3']);
});

test('DTOs expõem todos os gráficos e campos operacionais exigidos', () => {
  const vencimentos = gas.montarPaginaVencimentos_(alunos, contratos, hoje);
  assert.ok(vencimentos.graficos.porPolo);
  assert.equal(vencimentos.lista[0].frequencia, '2X');

  for (const pagina of [gas.montarPaginaFichas_(alunos, contratos, hoje), gas.montarPaginaAvaliacoes_(alunos, contratos, hoje)]) {
    assert.ok(pagina.graficos.situacao);
    assert.ok(pagina.graficos.faixas);
    assert.ok(Array.isArray(pagina.graficos.coberturaPorPolo));
  }

  const planos = gas.montarPaginaPlanos_(alunos, contratos, hoje);
  for (const campo of ['polos', 'frequencias', 'modalidades', 'status', 'valorPorPolo']) assert.ok(planos.graficos[campo]);
  assert.deepEqual(
    ['statusAluno', 'frequencia', 'modalidade', 'polo', 'inicioCorrente', 'vencimento', 'statusContrato', 'valor'].every(campo => Object.hasOwn(planos.lista[0], campo)),
    true
  );
});

test('paginação fatia só a lista e preserva KPIs e gráficos globais', () => {
  const page = gas.montarPaginaPlanos_(alunos, contratos, hoje);
  const paginada = gas.paginarPaginaDashboard_(page, 2, 1);
  assert.equal(paginada.lista.length, 1);
  assert.equal(paginada.lista[0].vencimento, '18/07/2026');
  assert.deepEqual(JSON.parse(JSON.stringify(paginada.kpis)), JSON.parse(JSON.stringify(page.kpis)));
  assert.deepEqual(JSON.parse(JSON.stringify(paginada.graficos)), JSON.parse(JSON.stringify(page.graficos)));
  assert.deepEqual(JSON.parse(JSON.stringify(paginada.paginacao)), { pagina: 2, limite: 1, totalItens: 3, totalPaginas: 3 });
});

test('planos mantém ordenação estável por vencimento e chave', () => {
  const page = gas.montarPaginaPlanos_(alunos, [contratos[2], contratos[1], contratos[0]], hoje);
  assert.deepEqual(page.lista.map(item => item.vencimento), ['10/07/2026', '18/07/2026', '01/08/2026']);
});

test('ordenação total gera a mesma paginação para ordens físicas diferentes', () => {
  const mesmosVencimentos = [
    { _chave_contrato: 'z', id: '1', vencimento: new Date(2026, 6, 20), polo: 'P', valor: 1 },
    { _chave_contrato: 'a', id: '2', vencimento: new Date(2026, 6, 20), polo: 'P', valor: 1 }
  ];
  const vencA = gas.paginarPaginaDashboard_(gas.montarPaginaVencimentos_(alunos, mesmosVencimentos, hoje), 1, 1);
  const vencB = gas.paginarPaginaDashboard_(gas.montarPaginaVencimentos_(alunos, [...mesmosVencimentos].reverse(), hoje), 1, 1);
  assert.deepEqual(vencA.lista.map(item => item.chave), ['a']);
  assert.deepEqual(vencB.lista.map(item => item.chave), ['a']);

  const alunosEmpatados = alunos.map(item => ({ ...item, data_ficha: '' }));
  const fichasA = gas.paginarPaginaDashboard_(gas.montarPaginaFichas_(alunosEmpatados, contratos, hoje), 1, 1);
  const fichasB = gas.paginarPaginaDashboard_(gas.montarPaginaFichas_([...alunosEmpatados].reverse(), contratos, hoje), 1, 1);
  assert.deepEqual(fichasA.lista.map(item => item.id), ['1']);
  assert.deepEqual(fichasB.lista.map(item => item.id), ['1']);
});

test('paginação limita página solicitada ao total sem alterar filtros', () => {
  const page = gas.montarPaginaPlanos_(alunos, contratos, hoje);
  page.filtros = { polos: ['POLO A'] };
  const paginada = gas.paginarPaginaDashboard_(page, 99, 2);
  assert.equal(paginada.paginacao.pagina, 2);
  assert.deepEqual(paginada.lista.map(item => item.aluno), ['ALUNO B']);
  assert.deepEqual(paginada.filtros, { polos: ['POLO A'] });
});

test('DTO de planos expõe somente campos consumidos pela interface', () => {
  const row = gas.montarPaginaPlanos_(alunos, contratos, hoje).lista[0];
  assert.deepEqual(Object.keys(row).sort(), [
    'aluno', 'frequencia', 'inicioCorrente', 'modalidade', 'polo',
    'statusAluno', 'statusContrato', 'valor', 'vencimento'
  ].sort());
});

test('vencimentos expõe a janela de 11 dias e os quatro blocos fixos do mês', () => {
  const page = gas.montarPaginaVencimentos_(alunos, contratos, hoje);
  assert.equal(page.operacao.janela11Dias.length, 11);
  assert.deepEqual(
    JSON.parse(JSON.stringify(page.operacao.mapaMensal.map(item => item.chave))),
    ['1-7', '8-15', '16-23', '24-fim']
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(page.operacao.resumos.map(item => item.chave))),
    ['ultimos_5_dias', 'hoje', 'proximos_5_dias']
  );
});

test('acompanhamento agrupa contratos por aluno e soma o valor associado à prioridade', () => {
  const page = gas.montarPaginaAcompanhamento_(alunos, contratos, hoje, 'prescricoes', {
    laranja: 90, vermelho: 180, roxo: 270
  });
  const semFicha = page.lista.find(item => item.id === '1');
  assert.equal(semFicha.situacao, 'sem_ficha');
  assert.equal(semFicha.valorMensal, 300);
  assert.equal(semFicha.contratos.length, 2);
  assert.equal(page.kpis.semDado, 1);
  assert.equal(page.lista.some(item => Object.hasOwn(item, 'contato')), false);
});
