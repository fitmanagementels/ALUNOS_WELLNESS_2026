var STATUS_LEADS_FLUXO = Object.freeze([
  'Novo', 'Em contato', 'Esfriando', 'Experimental agendado',
  'Experimental realizado', 'Convertido', 'Perdido'
]);

var PLANOS_LEADS_FLUXO = Object.freeze([
  'Pacote 5x', 'Pacote 10x', '1x/sem', '2x/sem', '3x/sem', '4x/sem', '5x/sem', '6x/sem'
]);

var RESPONSAVEIS_CHURN_FLUXO = Object.freeze(['Elohim', 'Xico', 'Cadu', 'Ruan', 'Iranildo']);
var PERSONAIS_CHURN_FLUXO = Object.freeze(RESPONSAVEIS_CHURN_FLUXO.concat([
  'Wallyson', 'Genuca', 'Yasmin', 'Wanderson Fabrício', 'Leonardo', 'Jackson', 'Vitória',
  'Maria', 'Clara', 'Thomas', 'Max', 'Sávio', 'Cristian', 'Rafael'
]));

var STATUS_EM_ACAO_FLUXO = Object.freeze([
  'Novo', 'Em contato', 'Esfriando', 'Experimental agendado', 'Experimental realizado'
]);

var MESES_FLUXO = Object.freeze([
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
]);

function textoFluxo_(valor, limite) {
  return String(valor == null ? '' : valor).trim().slice(0, limite || 2000);
}

function leadSeguroParaDashboard_(lead) {
  return {
    id: textoFluxo_(lead.lead_id, 120),
    nome: textoFluxo_(lead.nome, 200),
    telefone: textoFluxo_(lead.telefone, 60),
    origem: textoFluxo_(lead.origem, 160),
    indicacao: textoFluxo_(lead.indicacao, 300),
    primeiroContato: formatarDataDashboard_(lead.primeiro_contato),
    experimental: formatarDataDashboard_(lead.experimental),
    professorExperimental: textoFluxo_(lead.professor_experimental, 200),
    entradaComoCliente: formatarDataDashboard_(lead.entrada_como_cliente),
    status: textoFluxo_(lead.status, 80),
    planoContratado: textoFluxo_(lead.plano_contratado, 80),
    valorPacote: Number(lead.valor_pacote) || 0,
    minirrelatorioVenda: textoFluxo_(lead.minirrelatorio_venda, 3000),
    criadoEm: textoFluxo_(lead.criado_em, 40),
    atualizadoEm: textoFluxo_(lead.atualizado_em, 40)
  };
}

function churnSeguroParaDashboard_(churn) {
  return {
    id: textoFluxo_(churn.churn_id, 120),
    alunoId: textoFluxo_(churn.aluno_id, 100),
    nome: textoFluxo_(churn.nome, 200),
    telefone: textoFluxo_(churn.telefone, 60),
    dataSaida: formatarDataDashboard_(churn.data_saida),
    profissionalResponsavel: textoFluxo_(churn.profissional_responsavel, 120),
    ultimoPersonal: textoFluxo_(churn.ultimo_personal, 120),
    motivoSaida: textoFluxo_(churn.motivo_saida, 2000),
    sinaisContexto: textoFluxo_(churn.sinais_contexto, 3000),
    acaoRetencao: textoFluxo_(churn.acao_retencao, 3000),
    criadoEm: textoFluxo_(churn.criado_em, 40),
    atualizadoEm: textoFluxo_(churn.atualizado_em, 40)
  };
}

function filtrarChurnsFluxoParaDashboard_(churns) {
  return (churns || []).slice();
}

function lerFluxoDashboardDaPlanilha_(planilha) {
  var leads = lerTabelaDashboardDaPlanilha_(
    planilha, CONFIG.abas.fluxoLeads, CONFIG.cabecalhos.fluxoLeads
  ).map(leadSeguroParaDashboard_);
  var churns = lerChurnsDashboardDaPlanilha_(planilha);

  return { leads: leads, churns: filtrarChurnsFluxoParaDashboard_(churns) };
}

function lerChurnsDashboardDaPlanilha_(planilha) {
  return lerTabelaDashboardDaPlanilha_(
    planilha, CONFIG.abas.fluxoChurns, CONFIG.cabecalhos.fluxoChurns
  ).map(churnSeguroParaDashboard_);
}

function dentroDoPeriodoFluxo_(valor, inicio, fim) {
  var data = inicioDiaDashboard_(valor);
  if (!data) return false;
  return data.getTime() >= inicioDiaDashboard_(inicio).getTime() &&
    data.getTime() <= inicioDiaDashboard_(fim).getTime();
}

function serieMensalFluxo_(linhas, campo, inicio, fim) {
  var grupos = Object.create(null);
  (linhas || []).forEach(function (linha) {
    if (!dentroDoPeriodoFluxo_(linha[campo], inicio, fim)) return;
    var data = inicioDiaDashboard_(linha[campo]);
    var chave = data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0');
    if (!grupos[chave]) {
      grupos[chave] = { chave: chave, label: MESES_FLUXO[data.getMonth()] + '/' + data.getFullYear(), valor: 0 };
    }
    grupos[chave].valor += 1;
  });
  return Object.keys(grupos).sort().map(function (chave) { return grupos[chave]; });
}

function dataMesChurnFluxo_(valor) {
  var texto = textoFluxo_(valor, 20);
  var partes = /^(\d{4})-(\d{2})$/.exec(texto);
  if (!partes) return null;
  var data = new Date(Number(partes[1]), Number(partes[2]) - 1, 1, 12);
  return data.getFullYear() === Number(partes[1]) && data.getMonth() === Number(partes[2]) - 1 ? data : null;
}

function inicioMesChurnFluxo_(valor) {
  var data = inicioDiaDashboard_(valor);
  return data ? new Date(data.getFullYear(), data.getMonth(), 1, 12) : null;
}

function chaveMesChurnFluxo_(data) {
  return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0');
}

function limitesMensaisChurnFluxo_(churns, inicioMes, fimMes) {
  var datas = (churns || []).map(function (churn) {
    return inicioMesChurnFluxo_(churn.dataSaida);
  }).filter(Boolean).sort(function (a, b) { return a.getTime() - b.getTime(); });
  var inicio = dataMesChurnFluxo_(inicioMes) || datas[0] || null;
  var fim = dataMesChurnFluxo_(fimMes) || datas[datas.length - 1] || null;
  if (!inicio || !fim || inicio.getTime() > fim.getTime()) return null;
  return { inicio: inicio, fim: fim };
}

function serieMensalChurnFluxo_(churns, inicioMes, fimMes) {
  churns = churns || [];
  var limitesCompletos = limitesMensaisChurnFluxo_(churns, '', '');
  var limites = limitesMensaisChurnFluxo_(churns, inicioMes, fimMes);
  if (!limitesCompletos || !limites) return [];
  var contagens = Object.create(null);
  churns.forEach(function (churn) {
    var data = inicioMesChurnFluxo_(churn.dataSaida);
    if (data) contagens[chaveMesChurnFluxo_(data)] = (contagens[chaveMesChurnFluxo_(data)] || 0) + 1;
  });
  var completa = [];
  for (var data = new Date(limitesCompletos.inicio.getTime()); data.getTime() <= limitesCompletos.fim.getTime(); data.setMonth(data.getMonth() + 1)) {
    var chave = chaveMesChurnFluxo_(data);
    completa.push({
      chave: chave,
      label: MESES_FLUXO[data.getMonth()] + '/' + data.getFullYear(),
      valor: contagens[chave] || 0
    });
  }
  completa.forEach(function (item, indice) {
    var anterior = indice ? completa[indice - 1].valor : null;
    item.variacaoAbsoluta = anterior == null ? null : item.valor - anterior;
    item.variacaoPercentual = anterior == null || anterior === 0 ? null :
      Math.round(((item.valor - anterior) / anterior) * 1000) / 10;
  });
  return completa.filter(function (item) {
    return item.chave >= chaveMesChurnFluxo_(limites.inicio) && item.chave <= chaveMesChurnFluxo_(limites.fim);
  });
}

function inicioSemanaChurnFluxo_(valor) {
  var data = inicioDiaDashboard_(valor);
  if (!data) return null;
  data.setDate(data.getDate() - ((data.getDay() + 6) % 7));
  return data;
}

function chaveSemanaChurnFluxo_(data) {
  return data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0') + '-' + String(data.getDate()).padStart(2, '0');
}

function serieSemanalChurnFluxo_(churns, inicio, fim) {
  churns = churns || [];
  var inicioSemana = inicioSemanaChurnFluxo_(inicio);
  var fimSemana = inicioSemanaChurnFluxo_(fim);
  if (!inicioSemana || !fimSemana || inicioSemana.getTime() > fimSemana.getTime()) return [];
  var contagens = Object.create(null);
  churns.forEach(function (churn) {
    var data = inicioSemanaChurnFluxo_(churn.dataSaida);
    if (data) contagens[chaveSemanaChurnFluxo_(data)] = (contagens[chaveSemanaChurnFluxo_(data)] || 0) + 1;
  });
  var serie = [];
  for (var data = new Date(inicioSemana.getTime()); data.getTime() <= fimSemana.getTime(); data.setDate(data.getDate() + 7)) {
    var chave = chaveSemanaChurnFluxo_(data);
    var fimDaSemana = new Date(data.getFullYear(), data.getMonth(), data.getDate() + 6, 12);
    serie.push({
      chave: chave,
      label: formatarDataDashboard_(data) + '–' + formatarDataDashboard_(fimDaSemana),
      inicio: formatarDataDashboard_(data),
      fim: formatarDataDashboard_(fimDaSemana),
      valor: contagens[chave] || 0
    });
  }
  return serie;
}

function agruparChurnFluxo_(churns, seletor, incluirVazio) {
  var grupos = Object.create(null);
  (churns || []).forEach(function (churn) {
    var chave = textoFluxo_(seletor(churn), 200);
    if (!chave && !incluirVazio) return;
    chave = chave || 'Não informado';
    grupos[chave] = (grupos[chave] || 0) + 1;
  });
  return Object.keys(grupos).map(function (chave) {
    return { chave: chave, valor: grupos[chave] };
  }).sort(function (a, b) {
    return b.valor - a.valor || a.chave.localeCompare(b.chave, 'pt-BR');
  });
}

function diagnosticosChurnFluxo_(churns) {
  churns = churns || [];
  var comAcao = churns.filter(function (churn) {
    return Boolean(textoFluxo_(churn.acaoRetencao, 3000));
  }).length;
  return {
    motivos: agruparChurnFluxo_(churns, function (churn) { return churn.motivoSaida; }, false),
    responsaveis: agruparChurnFluxo_(churns, function (churn) {
      return churn.profissionalResponsavel || 'Não informado';
    }, true),
    retencao: {
      comAcao: comAcao,
      semAcao: churns.length - comAcao,
      coberturaPercentual: churns.length ? Math.round((comAcao / churns.length) * 1000) / 10 : 0
    }
  };
}

function analiseChurnFluxo_(churns, filtros) {
  filtros = filtros || {};
  return {
    mensal: serieMensalChurnFluxo_(churns, filtros.mesInicio, filtros.mesFim),
    semanal: serieSemanalChurnFluxo_(churns, filtros.semanaInicio, filtros.semanaFim),
    diagnosticos: diagnosticosChurnFluxo_(churns)
  };
}

function resumoLeadsFluxo_(leads, inicio, fim) {
  leads = leads || [];
  var novosLeads = leads.filter(function (lead) {
    return dentroDoPeriodoFluxo_(lead.primeiroContato, inicio, fim);
  });
  var entradas = leads.filter(function (lead) {
    return dentroDoPeriodoFluxo_(lead.entradaComoCliente, inicio, fim);
  });
  var funil = leads.reduce(function (acumulado, lead) {
    var status = textoFluxo_(lead.status, 80) || 'Não informado';
    acumulado[status] = (acumulado[status] || 0) + 1;
    return acumulado;
  }, Object.create(null));
  var emAcao = leads.filter(function (lead) {
    return STATUS_EM_ACAO_FLUXO.indexOf(textoFluxo_(lead.status, 80)) !== -1;
  });
  return {
    kpis: {
      novosLeads: novosLeads.length,
      entradasComoCliente: entradas.length,
      conversaoPeriodo: novosLeads.length ? Math.round((entradas.length / novosLeads.length) * 1000) / 10 : 0,
      emAcao: emAcao.length
    },
    funil: funil,
    primeiroContatoPorMes: serieMensalFluxo_(leads, 'primeiroContato', inicio, fim),
    entradasPorMes: serieMensalFluxo_(leads, 'entradaComoCliente', inicio, fim),
    inconsistenciasEntrada: leads.filter(function (lead) {
      return Boolean(inicioDiaDashboard_(lead.entradaComoCliente)) && textoFluxo_(lead.status, 80) !== 'Convertido';
    })
  };
}

function resumoChurnsFluxo_(churns, inicio, fim) {
  var selecionados = (churns || []).filter(function (churn) {
    return dentroDoPeriodoFluxo_(churn.dataSaida, inicio, fim);
  });
  return {
    kpis: {
      saidas: selecionados.length,
      comMotivo: selecionados.filter(function (churn) { return Boolean(textoFluxo_(churn.motivoSaida, 2000)); }).length,
      comAcaoRetencao: selecionados.filter(function (churn) { return Boolean(textoFluxo_(churn.acaoRetencao, 3000)); }).length
    },
    serieTemporal: serieMensalFluxo_(selecionados, 'dataSaida', inicio, fim)
  };
}
