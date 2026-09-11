function lerTabelaDashboard_(nomeAba, cabecalhos) {
  return lerTabelaDashboardDaPlanilha_(obterPlanilhaMestre_(), nomeAba, cabecalhos);
}

function validarCabecalhosDashboard_(recebidos, cabecalhos) {
  cabecalhos.forEach(function (cabecalho, indice) {
    if (String(recebidos[indice]) !== cabecalho) {
      throw new Error('Estrutura de dados incompatível.');
    }
  });
}

function lerTabelaDashboardDaPlanilha_(planilha, nomeAba, cabecalhos) {
  var aba = planilha.getSheetByName(nomeAba);
  if (!aba) throw new Error('Aba necessária não encontrada.');
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 1) throw new Error('Estrutura de dados incompatível.');
  var valores = aba.getRange(1, 1, ultimaLinha, cabecalhos.length).getValues();
  validarCabecalhosDashboard_(valores[0], cabecalhos);
  if (ultimaLinha < 2) return [];
  return valores.slice(1).filter(function (linha) {
    return linha.some(function (valor) { return valor !== '' && valor != null; });
  }).map(function (linha) {
    return cabecalhos.reduce(function (objeto, cabecalho, indice) {
      objeto[cabecalho] = linha[indice];
      return objeto;
    }, {});
  });
}

function obterUltimaImportacaoDashboard_(planilha) {
  var aba = planilha.getSheetByName(CONFIG.abas.importacoes);
  if (!aba) throw new Error('Aba necessária não encontrada.');
  var cabecalhos = CONFIG.cabecalhos.importacoes;
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 1) throw new Error('Estrutura de dados incompatível.');
  var recebidos = aba.getRange(1, 1, 1, cabecalhos.length).getValues()[0];
  validarCabecalhosDashboard_(recebidos, cabecalhos);
  if (ultimaLinha < 2) return null;

  var tamanhoChunk = 200;
  var fim = ultimaLinha;
  while (fim >= 2) {
    var inicio = Math.max(2, fim - tamanhoChunk + 1);
    var valores = aba.getRange(inicio, 1, fim - inicio + 1, cabecalhos.length).getDisplayValues();
    for (var indice = valores.length - 1; indice >= 0; indice -= 1) {
      if (valores[indice][11] === 'SUCESSO') {
        return {
          execucaoId: valores[indice][0],
          concluidaEm: valores[indice][2],
          dataReferencia: valores[indice][6],
          revisao: valores[indice][7],
          linha: inicio + indice
        };
      }
    }
    fim = inicio - 1;
  }
  return null;
}

function obterUltimoRegistroImportacaoDashboard_(planilha) {
  var aba = planilha
    ? planilha.getSheetByName(CONFIG.abas.importacoes)
    : obterAbaImportacoes_();
  if (!aba) throw new Error('Aba necessária não encontrada.');
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return null;
  var linha = aba.getRange(
    ultimaLinha, 1, 1, CONFIG.cabecalhos.importacoes.length
  ).getDisplayValues()[0];
  return {
    concluidaEm: linha[2],
    dataReferencia: linha[6],
    status: linha[11],
    linha: ultimaLinha
  };
}

function lerBaseDashboard_() {
  var planilha = obterPlanilhaMestre_();
  return {
    planilha: planilha,
    alunos: lerTabelaDashboardDaPlanilha_(planilha, CONFIG.abas.alunos, CONFIG.cabecalhos.alunos),
    contratos: lerTabelaDashboardDaPlanilha_(planilha, CONFIG.abas.contratos, CONFIG.cabecalhos.contratos),
    permanencia: lerTabelaDashboardDaPlanilha_(
      planilha, CONFIG.abas.basePermanencia, CONFIG.cabecalhos.basePermanencia
    ),
    eventosPermanencia: lerTabelaDashboardDaPlanilha_(
      planilha, CONFIG.abas.historicoPermanencia, CONFIG.cabecalhos.historicoPermanencia
    ),
    ultimaImportacao: obterUltimaImportacaoDashboard_(planilha),
    ultimaTentativa: obterUltimoRegistroImportacaoDashboard_(planilha)
  };
}

function jsonDashboardSeguro_(valor, fallback) {
  try {
    var convertido = JSON.parse(String(valor == null ? '' : valor));
    return convertido && typeof convertido === 'object' ? convertido : fallback;
  } catch (erro) {
    return fallback;
  }
}

function configuracaoAlertaPadraoDashboard_() {
  return {
    prescricoes: { laranja: 90, vermelho: 180, roxo: 270 },
    avaliacoes: { laranja: 90, vermelho: 120, roxo: 180, critico: 270 }
  };
}

function lerConfiguracaoDashboardPersistente_(planilha) {
  var linhasDashboard = lerTabelaDashboardDaPlanilha_(
    planilha, CONFIG.abas.configDashboard, CONFIG.cabecalhos.configDashboard
  );
  var linhasAlertas = lerTabelaDashboardDaPlanilha_(
    planilha, CONFIG.abas.configAlertas, CONFIG.cabecalhos.configAlertas
  );
  var linhasPagamentos = lerTabelaDashboardDaPlanilha_(
    planilha, CONFIG.abas.gestaoPagamentos, CONFIG.cabecalhos.gestaoPagamentos
  );
  var filtrosPadrao = { status: '__matriculados__', polo: 'XSTEAM WELLNESS CLUB' };
  var linhaFiltros = linhasDashboard.filter(function (linha) {
    return linha.tipo === 'filtros' && linha.chave === 'globais';
  })[0];
  if (linhaFiltros) {
    var filtrosLidos = jsonDashboardSeguro_(linhaFiltros.valor, {});
    if (String(filtrosLidos.status || '').trim()) filtrosPadrao.status = String(filtrosLidos.status).trim();
    if (String(filtrosLidos.polo || '').trim()) filtrosPadrao.polo = String(filtrosLidos.polo).trim();
  }
  if (filtrosPadrao.status === 'Ativo') filtrosPadrao.status = '__matriculados__';
  var alertas = configuracaoAlertaPadraoDashboard_();
  linhasAlertas.forEach(function (linha) {
    if (!Object.prototype.hasOwnProperty.call(alertas, linha.chave)) return;
    var limites = jsonDashboardSeguro_(linha.valor, null);
    if (limites) alertas[linha.chave] = limites;
  });
  return {
    filtrosPadrao: filtrosPadrao,
    homeCards: linhasDashboard.filter(function (linha) { return linha.tipo === 'home_card'; }).map(function (linha) {
      return {
        chave: String(linha.chave || ''),
        ativo: linha.ativo === true || String(linha.ativo).toLowerCase() === 'true',
        ordem: Number(linha.ordem) || 0,
        titulo: String(linha.titulo || ''),
        estados: Array.isArray(jsonDashboardSeguro_(linha.estados, [])) ? jsonDashboardSeguro_(linha.estados, []) : []
      };
    }).sort(function (a, b) { return a.ordem - b.ordem || a.chave.localeCompare(b.chave, 'pt-BR'); }),
    alertas: alertas,
    perfisPagamento: linhasPagamentos.map(function (linha) {
      return {
        id: String(linha.id || ''),
        aluno: String(linha.aluno || ''),
        perfilPagamento: String(linha.perfil_pagamento || 'Sem histórico'),
        observacao: String(linha.observacao || ''),
        atualizadoEm: String(linha.atualizado_em || '')
      };
    })
  };
}

function alunoSeguroParaDashboard_(aluno) {
  return {
    id: String(aluno.id || ''),
    aluno: String(aluno.aluno || ''),
    contato: String(aluno.contato || ''),
    status: String(aluno.status || ''),
    dataFicha: formatarDataDashboard_(aluno.data_ficha),
    dataAvaliacao: formatarDataDashboard_(aluno.data_avaliacao)
  };
}

function contratoSeguroParaDashboard_(contrato) {
  return {
    chave: String(contrato._chave_contrato || ''),
    id: String(contrato.id || ''),
    contrato: String(contrato.contrato_completo || ''),
    frequencia: String(contrato.contrato_x_sem || ''),
    valor: Number(contrato.valor) || 0,
    inicioCorrente: formatarDataDashboard_(contrato.inicio_corrente),
    vencimento: formatarDataDashboard_(contrato.vencimento),
    statusContrato: String(contrato.status_contrato || ''),
    polo: String(contrato.polo || ''),
    modalidade: String(contrato.modalidade || '')
  };
}

function permanenciaSeguraParaDashboard_(item) {
  return {
    id: String(item.id || ''),
    aluno: String(item.aluno || ''),
    clienteDesde: formatarDataDashboard_(item.cliente_desde),
    status: String(item.status_permanencia || ''),
    continuidadeMeses: Number(item.continuidade_meses_origem) || 0,
    quantidadeContratos: Number(item.quantidade_contratos_origem) || 0,
    presenteUltimoLote: item.presente_ultimo_lote === true ||
      String(item.presente_ultimo_lote).toLowerCase() === 'true'
  };
}

function eventoPermanenciaSeguroParaDashboard_(item) {
  return {
    id: String(item.id || ''),
    dataReferencia: formatarDataDashboard_(item.data_referencia),
    tipo: String(item.tipo_evento || '')
  };
}
