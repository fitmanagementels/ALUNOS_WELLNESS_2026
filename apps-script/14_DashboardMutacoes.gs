var CHAVE_SOLICITACOES_DASHBOARD = 'tecnofit.dashboard.solicitacoes';
var CARTOES_HOME_DASHBOARD = Object.freeze([
  'fila_prescricoes', 'fila_avaliacoes', 'agenda_financeira',
  'dados_ausentes', 'prescricoes_criticas', 'avaliacoes_criticas',
  'vencidos_5_dias', 'vencem_hoje', 'vencem_5_dias',
  'operacao_prescricoes_em_dia', 'operacao_avaliacoes_em_dia', 'radar_valor_em_atencao'
]);

function planilhaMutacoesDashboard_() {
  return SpreadsheetApp.openById(CONFIG.planilhaId);
}

function lerTabelaMutacoesDashboard_(planilha, nomeAba, cabecalhos) {
  var aba = planilha.getSheetByName(nomeAba);
  if (!aba) throw new Error('Aba de configuração não encontrada.');
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 1) throw new Error('Estrutura de configuração incompatível.');
  var valores = aba.getRange(1, 1, ultimaLinha, cabecalhos.length).getValues();
  cabecalhos.forEach(function (cabecalho, indice) {
    if (String(valores[0][indice]) !== cabecalho) throw new Error('Estrutura de configuração incompatível.');
  });
  return valores.slice(1).filter(function (linha) {
    return linha.some(function (valor) { return valor !== '' && valor != null; });
  });
}

function escreverTabelaMutacoesDashboard_(aba, cabecalhos, linhas) {
  aba.clearContents();
  aba.getRange(1, 1, linhas.length + 1, cabecalhos.length).setValues([cabecalhos].concat(linhas));
}

function textoMutacaoDashboard_(valor, limite) {
  return String(valor == null ? '' : valor).trim().slice(0, limite || 500);
}

function boolMutacaoDashboard_(valor) {
  return valor === true || String(valor).toLowerCase() === 'true';
}

function validarLimitesMutacaoDashboard_(chave, limites) {
  if (!limites || typeof limites !== 'object' || Array.isArray(limites)) {
    throw new Error('Limites de alerta inválidos.');
  }
  var campos = chave === 'avaliacoes'
    ? ['laranja', 'vermelho', 'roxo', 'critico']
    : ['laranja', 'vermelho', 'roxo'];
  var anterior = 0;
  var normalizados = {};
  campos.forEach(function (campo) {
    var valor = Number(limites[campo]);
    if (!Number.isInteger(valor) || valor <= anterior) {
      throw new Error('Os limites de alerta devem ser inteiros positivos e crescentes.');
    }
    normalizados[campo] = valor;
    anterior = valor;
  });
  return normalizados;
}

function normalizarCartoesHomeMutacao_(cartoes) {
  if (!Array.isArray(cartoes)) throw new Error('Cartões da Home inválidos.');
  var vistos = Object.create(null);
  return cartoes.map(function (cartao) {
    var chave = textoMutacaoDashboard_(cartao.chave, 80);
    if (CARTOES_HOME_DASHBOARD.indexOf(chave) === -1 || vistos[chave]) {
      throw new Error('Cartão da Home inválido.');
    }
    vistos[chave] = true;
    var ordem = Number(cartao.ordem);
    if (!Number.isInteger(ordem) || ordem < 1) throw new Error('Ordem de cartão inválida.');
    var estados = Array.isArray(cartao.estados) ? cartao.estados.map(function (estado) {
      return textoMutacaoDashboard_(estado, 80);
    }).filter(Boolean) : [];
    return {
      chave: chave,
      ativo: boolMutacaoDashboard_(cartao.ativo),
      ordem: ordem,
      titulo: textoMutacaoDashboard_(cartao.titulo || chave, 120),
      estados: estados
    };
  });
}

function atualizarLinhasDashboardMutacao_(linhas, valores) {
  var outras = linhas.filter(function (linha) { return String(linha[0]) !== 'filtros' && String(linha[0]) !== 'home_card'; });
  var linhaAnteriorFiltros = linhas.filter(function (linha) {
    return String(linha[0]) === 'filtros' && String(linha[1]) === 'globais';
  })[0];
  var filtrosExistentes = {};
  try { filtrosExistentes = JSON.parse(String(linhaAnteriorFiltros ? linhaAnteriorFiltros[4] : '{}')); } catch (erro) {}
  var filtros = valores.filtrosPadrao || filtrosExistentes;
  var status = textoMutacaoDashboard_(filtros.status, 80);
  var polo = textoMutacaoDashboard_(filtros.polo, 80);
  if (!status || !polo) throw new Error('Os filtros padrão são obrigatórios.');
  var resultado = outras.concat([[
    'filtros', 'globais', true, 0, JSON.stringify({ status: status, polo: polo }), 'Filtros padrão', ''
  ]]);
  if (valores.homeCards) {
    normalizarCartoesHomeMutacao_(valores.homeCards).forEach(function (cartao) {
      resultado.push([
        'home_card', cartao.chave, cartao.ativo, cartao.ordem, '', cartao.titulo, JSON.stringify(cartao.estados)
      ]);
    });
  } else {
    linhas.filter(function (linha) { return String(linha[0]) === 'home_card'; }).forEach(function (linha) {
      resultado.push(linha);
    });
  }
  return resultado;
}

function atualizarLinhasAlertasMutacao_(linhas, valores) {
  var atualizadas = linhas.map(function (linha) { return linha.slice(); });
  ['prescricoes', 'avaliacoes'].forEach(function (chave) {
    if (!Object.prototype.hasOwnProperty.call(valores, chave)) return;
    var limites = validarLimitesMutacaoDashboard_(chave, valores[chave]);
    var indice = atualizadas.findIndex(function (linha) { return String(linha[1]) === chave; });
    var nova = ['alertas', chave, true, chave === 'prescricoes' ? 10 : 20, JSON.stringify(limites),
      chave === 'prescricoes' ? 'Prescrições' : 'Avaliações', ''];
    if (indice === -1) atualizadas.push(nova);
    else atualizadas[indice] = nova;
  });
  return atualizadas;
}

function atualizarLinhasPagamentosMutacao_(linhas, valores) {
  var id = textoMutacaoDashboard_(valores.id, 100);
  var aluno = textoMutacaoDashboard_(valores.aluno, 200);
  var perfil = textoMutacaoDashboard_(valores.perfilPagamento, 100);
  var observacao = textoMutacaoDashboard_(valores.observacao, 1000);
  if (!id || !aluno || DASHBOARD_CONFIGURACAO_PADRAO.perfisPagamento.indexOf(perfil) === -1) {
    throw new Error('Perfil de pagamento inválido.');
  }
  var agora = Utilities.formatDate(new Date(), CONFIG.fusoHorario, 'dd/MM/yyyy HH:mm');
  var nova = [id, aluno, perfil, observacao, agora];
  var encontrou = false;
  return linhas.filter(function (linha) {
    if (String(linha[0]) !== id) return true;
    if (!encontrou) {
      encontrou = true;
      return false;
    }
    return false;
  }).concat([nova]);
}

function dataFluxoMutacao_(valor) {
  var texto = textoMutacaoDashboard_(valor, 20);
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) return '';
  var partes = texto.split('/').map(Number);
  var data = new Date(partes[2], partes[1] - 1, partes[0], 12);
  return data.getFullYear() === partes[2] && data.getMonth() === partes[1] - 1 && data.getDate() === partes[0] ? texto : '';
}

function agoraFluxoMutacao_() {
  return Utilities.formatDate(new Date(), CONFIG.fusoHorario, 'dd/MM/yyyy HH:mm');
}

function idFluxoMutacao_(valor) {
  var id = textoMutacaoDashboard_(valor, 120);
  return id || Utilities.getUuid();
}

function linhaLeadFluxoMutacao_(valores, existente) {
  valores = valores || {};
  var nome = textoMutacaoDashboard_(valores.nome, 200);
  var telefone = textoMutacaoDashboard_(valores.telefone, 60);
  var primeiroContato = dataFluxoMutacao_(valores.primeiroContato);
  var status = textoMutacaoDashboard_(valores.status, 80);
  var experimental = valores.experimental ? dataFluxoMutacao_(valores.experimental) : '';
  var entrada = valores.entradaComoCliente ? dataFluxoMutacao_(valores.entradaComoCliente) : '';
  var plano = textoMutacaoDashboard_(valores.planoContratado, 80);
  var valor = valores.valorPacote === '' || valores.valorPacote == null ? '' : Number(valores.valorPacote);
  if (!nome || !telefone || !primeiroContato || STATUS_LEADS_FLUXO.indexOf(status) === -1 ||
      (valores.experimental && !experimental) || (valores.entradaComoCliente && !entrada) ||
      (plano && PLANOS_LEADS_FLUXO.indexOf(plano) === -1) || (valor !== '' && (!isFinite(valor) || valor < 0))) {
    throw new Error('Lead inválido.');
  }
  var agora = agoraFluxoMutacao_();
  return [
    idFluxoMutacao_(valores.id || (existente && existente[0])), nome, telefone,
    textoMutacaoDashboard_(valores.origem, 160), textoMutacaoDashboard_(valores.indicacao, 300),
    primeiroContato, experimental, textoMutacaoDashboard_(valores.professorExperimental, 200), entrada,
    status, plano, valor, textoMutacaoDashboard_(valores.minirrelatorioVenda, 3000),
    existente ? existente[13] : agora, agora
  ];
}

function linhaChurnFluxoMutacao_(valores, existente) {
  valores = valores || {};
  var alunoId = textoMutacaoDashboard_(valores.alunoId, 100);
  var nome = textoMutacaoDashboard_(valores.nome, 200);
  var dataSaida = dataFluxoMutacao_(valores.dataSaida);
  var profissionalResponsavel = textoMutacaoDashboard_(valores.profissionalResponsavel, 120);
  var ultimoPersonal = textoMutacaoDashboard_(valores.ultimoPersonal, 120);
  if (!alunoId || !nome || !dataSaida ||
      (profissionalResponsavel && RESPONSAVEIS_CHURN_FLUXO.indexOf(profissionalResponsavel) === -1) ||
      (ultimoPersonal && PERSONAIS_CHURN_FLUXO.indexOf(ultimoPersonal) === -1)) {
    throw new Error('Churn inválido.');
  }
  var agora = agoraFluxoMutacao_();
  return [
    idFluxoMutacao_(valores.id || (existente && existente[0])), alunoId, nome,
    textoMutacaoDashboard_(valores.telefone, 60), dataSaida, profissionalResponsavel, ultimoPersonal,
    textoMutacaoDashboard_(valores.motivoSaida, 2000), textoMutacaoDashboard_(valores.sinaisContexto, 3000),
    textoMutacaoDashboard_(valores.acaoRetencao, 3000), existente ? existente[10] : agora, agora
  ];
}

function atualizarLinhaFluxoMutacao_(linhas, valores, criarLinha) {
  var id = textoMutacaoDashboard_(valores && valores.id, 120);
  var indice = id ? linhas.findIndex(function (linha) { return String(linha[0]) === id; }) : -1;
  if (id && indice === -1 && !valores.criar) throw new Error('Registro de Fluxo inválido.');
  var nova = criarLinha(valores, indice === -1 ? null : linhas[indice]);
  if (indice === -1) return linhas.concat([nova]);
  var atualizadas = linhas.map(function (linha) { return linha.slice(); });
  atualizadas[indice] = nova;
  return atualizadas;
}

function excluirChurnFluxoMutacao_(linhas, valores) {
  var id = textoMutacaoDashboard_(valores && valores.id, 120);
  var restantes = linhas.filter(function (linha) { return String(linha[0]) !== id; });
  if (!id || restantes.length === linhas.length) throw new Error('Churn inválido.');
  return restantes;
}

function lerSolicitacoesProcessadasDashboard_() {
  try {
    var texto = PropertiesService.getDocumentProperties().getProperty(CHAVE_SOLICITACOES_DASHBOARD);
    var lista = JSON.parse(texto || '[]');
    return Array.isArray(lista) ? lista.filter(function (id) { return typeof id === 'string'; }).slice(-50) : [];
  } catch (erro) {
    return [];
  }
}

function registrarSolicitacaoProcessadaDashboard_(requestId) {
  var props = PropertiesService.getDocumentProperties();
  var lista = lerSolicitacoesProcessadasDashboard_();
  lista.push(requestId);
  props.setProperty(CHAVE_SOLICITACOES_DASHBOARD, JSON.stringify(lista.slice(-50)));
}

function salvarMutacoesDashboard(lote) {
  lote = lote && typeof lote === 'object' && !Array.isArray(lote) ? lote : null;
  var requestId = textoMutacaoDashboard_(lote && lote.requestId, 120);
  var patches = lote && Array.isArray(lote.patches) ? lote.patches : [];
  if (!requestId || !patches.length || patches.length > 20) throw new Error('Solicitação de configuração inválida.');
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    if (lerSolicitacoesProcessadasDashboard_().indexOf(requestId) !== -1) {
      return { ok: true, requestId: requestId, idempotente: true, versao: obterVersaoDashboard_() };
    }
    var precisaDashboard = patches.some(function (patch) { return patch && patch.tipo === 'configDashboard'; });
    var precisaAlertas = patches.some(function (patch) { return patch && patch.tipo === 'configAlertas'; });
    var precisaPagamentos = patches.some(function (patch) { return patch && patch.tipo === 'perfilPagamento'; });
    var precisaPerfilAluno = patches.some(function (patch) { return patch && patch.tipo === 'perfilAluno'; });
    var precisaLeads = patches.some(function (patch) { return patch && patch.tipo === 'fluxoLead'; });
    var precisaChurns = patches.some(function (patch) { return patch && (patch.tipo === 'fluxoChurn' || patch.tipo === 'excluirFluxoChurn'); });
    var planilha = planilhaMutacoesDashboard_();
    if (precisaPerfilAluno && (
      !planilha.getSheetByName(CONFIG.abas.perfisAlunos) ||
      !planilha.getSheetByName(CONFIG.abas.configPerfisAlunos)
    )) garantirPerfisAlunosNaPlanilha_(planilha);
    var abaDashboard = precisaDashboard ? planilha.getSheetByName(CONFIG.abas.configDashboard) : null;
    var abaAlertas = precisaAlertas ? planilha.getSheetByName(CONFIG.abas.configAlertas) : null;
    var abaPagamentos = precisaPagamentos ? planilha.getSheetByName(CONFIG.abas.gestaoPagamentos) : null;
    var abaPerfisAlunos = precisaPerfilAluno ? planilha.getSheetByName(CONFIG.abas.perfisAlunos) : null;
    var abaLeads = precisaLeads ? planilha.getSheetByName(CONFIG.abas.fluxoLeads) : null;
    var abaChurns = precisaChurns ? planilha.getSheetByName(CONFIG.abas.fluxoChurns) : null;
    var linhasDashboard = precisaDashboard ? lerTabelaMutacoesDashboard_(planilha, CONFIG.abas.configDashboard, CONFIG.cabecalhos.configDashboard) : [];
    var linhasAlertas = precisaAlertas ? lerTabelaMutacoesDashboard_(planilha, CONFIG.abas.configAlertas, CONFIG.cabecalhos.configAlertas) : [];
    var linhasPagamentos = precisaPagamentos ? lerTabelaMutacoesDashboard_(planilha, CONFIG.abas.gestaoPagamentos, CONFIG.cabecalhos.gestaoPagamentos) : [];
    var linhasPerfisAlunos = precisaPerfilAluno ? lerTabelaMutacoesDashboard_(planilha, CONFIG.abas.perfisAlunos, CONFIG.cabecalhos.perfisAlunos) : [];
    var catalogoPerfisAlunos = precisaPerfilAluno ? lerCatalogoPerfisAlunosDashboard_(planilha) : [];
    var alunosPerfil = precisaPerfilAluno ? lerTabelaDashboardDaPlanilha_(planilha, CONFIG.abas.alunos, CONFIG.cabecalhos.alunos) : [];
    var linhasLeads = precisaLeads ? lerTabelaMutacoesDashboard_(planilha, CONFIG.abas.fluxoLeads, CONFIG.cabecalhos.fluxoLeads) : [];
    var linhasChurns = precisaChurns ? lerTabelaMutacoesDashboard_(planilha, CONFIG.abas.fluxoChurns, CONFIG.cabecalhos.fluxoChurns) : [];
    var alterouDashboard = false;
    var alterouAlertas = false;
    var alterouPagamentos = false;
    var alterouPerfilAluno = false;
    var alterouLeads = false;
    var alterouChurns = false;
    patches.forEach(function (patch) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Alteração inválida.');
      if (patch.tipo === 'configDashboard') {
        linhasDashboard = atualizarLinhasDashboardMutacao_(linhasDashboard, patch.valores || {});
        alterouDashboard = true;
      } else if (patch.tipo === 'configAlertas') {
        linhasAlertas = atualizarLinhasAlertasMutacao_(linhasAlertas, patch.valores || {});
        alterouAlertas = true;
      } else if (patch.tipo === 'perfilPagamento') {
        linhasPagamentos = atualizarLinhasPagamentosMutacao_(linhasPagamentos, patch.valores || {});
        alterouPagamentos = true;
      } else if (patch.tipo === 'perfilAluno') {
        linhasPerfisAlunos = atualizarLinhasPerfilAlunoMutacao_(
          linhasPerfisAlunos, patch.valores || {}, catalogoPerfisAlunos, alunosPerfil
        );
        alterouPerfilAluno = true;
      } else if (patch.tipo === 'fluxoLead') {
        linhasLeads = atualizarLinhaFluxoMutacao_(linhasLeads, patch.valores || {}, linhaLeadFluxoMutacao_);
        alterouLeads = true;
      } else if (patch.tipo === 'fluxoChurn') {
        linhasChurns = atualizarLinhaFluxoMutacao_(linhasChurns, patch.valores || {}, linhaChurnFluxoMutacao_);
        alterouChurns = true;
      } else if (patch.tipo === 'excluirFluxoChurn') {
        linhasChurns = excluirChurnFluxoMutacao_(linhasChurns, patch.valores || {});
        alterouChurns = true;
      } else {
        throw new Error('Tipo de alteração inválido.');
      }
    });
    if (alterouDashboard) escreverTabelaMutacoesDashboard_(abaDashboard, CONFIG.cabecalhos.configDashboard, linhasDashboard);
    if (alterouAlertas) escreverTabelaMutacoesDashboard_(abaAlertas, CONFIG.cabecalhos.configAlertas, linhasAlertas);
    if (alterouPagamentos) escreverTabelaMutacoesDashboard_(abaPagamentos, CONFIG.cabecalhos.gestaoPagamentos, linhasPagamentos);
    if (alterouPerfilAluno) escreverTabelaMutacoesDashboard_(abaPerfisAlunos, CONFIG.cabecalhos.perfisAlunos, linhasPerfisAlunos);
    if (alterouLeads) escreverTabelaMutacoesDashboard_(abaLeads, CONFIG.cabecalhos.fluxoLeads, linhasLeads);
    if (alterouChurns) escreverTabelaMutacoesDashboard_(abaChurns, CONFIG.cabecalhos.fluxoChurns, linhasChurns);
    SpreadsheetApp.flush();
    var versao = incrementarVersaoDashboard_();
    if (alterouChurns) incrementarVersaoChurnDashboard_();
    registrarSolicitacaoProcessadaDashboard_(requestId);
    return { ok: true, requestId: requestId, idempotente: false, versao: versao };
  } finally {
    lock.releaseLock();
  }
}
