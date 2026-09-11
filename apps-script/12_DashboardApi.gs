function hashTextoDashboard_(texto) {
  var hashA = 0;
  var hashB = 5381;
  for (var indice = 0; indice < texto.length; indice += 1) {
    var codigo = texto.charCodeAt(indice);
    hashA = ((hashA << 5) - hashA + codigo) | 0;
    hashB = (((hashB << 5) + hashB) ^ codigo) | 0;
  }
  return (hashA >>> 0).toString(36) + (hashB >>> 0).toString(36);
}

function chaveCacheDashboard_(pagina, filtros) {
  var prefixo = 'dashboard:v2:' + pagina + ':';
  var serializado = JSON.stringify(filtros || {});
  var chave = prefixo + serializado;
  if (chave.length <= 250) return chave;
  return prefixo + 'hash:' + hashTextoDashboard_(serializado) + ':' + serializado.length;
}

function normalizarFiltrosDashboard_(recebidos) {
  recebidos = objetoDashboardValido_(recebidos) ? recebidos : {};
  var filtros = {};
  ['busca', 'polo', 'statusAluno', 'situacao', 'frequencia', 'modalidade', 'statusContrato'].forEach(function (campo) {
    var valor = String(recebidos[campo] == null ? '' : recebidos[campo]).trim();
    if (valor) filtros[campo] = valor.slice(0, campo === 'busca' ? 120 : 80);
  });
  var periodo = String(recebidos.periodoDias == null ? '' : recebidos.periodoDias).trim();
  if (['30', '60', '90'].indexOf(periodo) !== -1) filtros.periodoDias = periodo;
  else if (periodo) filtros.periodoDias = '__INVALIDO__';
  var pagina = Math.floor(Number(recebidos.paginaLista));
  var limite = Math.floor(Number(recebidos.limite));
  filtros.paginaLista = isFinite(pagina) && pagina > 0 ? pagina : 1;
  filtros.limite = isFinite(limite) && limite > 0 ? Math.min(limite, 100) : 25;
  if (filtros.paginaLista === 1 && recebidos.paginaLista == null) delete filtros.paginaLista;
  if (filtros.limite === 25 && recebidos.limite == null) delete filtros.limite;
  return filtros;
}

function tipoErroDashboardSeguro_(erro) {
  var permitidos = ['Error', 'TypeError', 'RangeError', 'SyntaxError'];
  var nome = erro && erro.name ? String(erro.name) : 'Error';
  return permitidos.indexOf(nome) === -1 ? 'Error' : nome;
}

function objetoDashboardValido_(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function camposNumericosDashboardValidos_(objeto, campos) {
  return campos.every(function (campo) { return typeof objeto[campo] === 'number'; });
}

function dadosCacheDashboardValidos_(dados, pagina) {
  if (!objetoDashboardValido_(dados) || !objetoDashboardValido_(dados.kpis) ||
      !objetoDashboardValido_(dados.graficos) || !Array.isArray(dados.lista) ||
      !objetoDashboardValido_(dados.filtros) || !objetoDashboardValido_(dados.paginacao) ||
      !camposNumericosDashboardValidos_(dados.paginacao, ['pagina', 'limite', 'totalItens', 'totalPaginas']) ||
      !Array.isArray(dados.filtros.polos) ||
      !Array.isArray(dados.filtros.statusAlunos) || !Array.isArray(dados.filtros.frequencias) ||
      !Array.isArray(dados.filtros.modalidades) || !Array.isArray(dados.filtros.statusContratos)) return false;

  if (pagina === 'vencimentos') {
    return camposNumericosDashboardValidos_(dados.kpis, ['vencidos', 'ate7', 'ate30', 'valorAte30']) &&
      objetoDashboardValido_(dados.graficos.situacao) && Array.isArray(dados.graficos.semanas) &&
      objetoDashboardValido_(dados.graficos.porPolo);
  }
  if (pagina === 'fichas' || pagina === 'avaliacoes') {
    return camposNumericosDashboardValidos_(dados.kpis, ['atualizadas', 'desatualizadas', 'ausentes', 'cobertura']) &&
      objetoDashboardValido_(dados.graficos.situacao) &&
      objetoDashboardValido_(dados.graficos.faixas) &&
      Array.isArray(dados.graficos.coberturaPorPolo);
  }
  return camposNumericosDashboardValidos_(dados.kpis, ['alunos', 'contratos', 'valor', 'ticketMedio']) &&
    objetoDashboardValido_(dados.graficos.polos) &&
    objetoDashboardValido_(dados.graficos.frequencias) &&
    objetoDashboardValido_(dados.graficos.modalidades) &&
    objetoDashboardValido_(dados.graficos.status) &&
    objetoDashboardValido_(dados.graficos.valorPorPolo);
}

function formatarPartesDataAvisoDashboard_(ano, mes, dia, hora, minuto, segundo) {
  ano = Number(ano);
  mes = Number(mes);
  dia = Number(dia);
  if (hora != null && (Number(hora) < 0 || Number(hora) > 23)) return '';
  if (minuto != null && (Number(minuto) < 0 || Number(minuto) > 59)) return '';
  if (segundo != null && (Number(segundo) < 0 || Number(segundo) > 59)) return '';
  var data = new Date(ano, mes - 1, dia, 12);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return '';
  return String(dia).padStart(2, '0') + '/' +
    String(mes).padStart(2, '0') + '/' + String(ano);
}

function dataAvisoImportacaoDashboard_(valor) {
  if (Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor.getTime())) {
    return formatarPartesDataAvisoDashboard_(
      valor.getFullYear(), valor.getMonth() + 1, valor.getDate()
    );
  }
  var texto = String(valor == null ? '' : valor).trim();
  var brasileira = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(texto);
  if (brasileira) {
    return formatarPartesDataAvisoDashboard_(
      brasileira[3], brasileira[2], brasileira[1], brasileira[4], brasileira[5], brasileira[6]
    );
  }
  var iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(texto);
  if (iso) {
    return formatarPartesDataAvisoDashboard_(
      iso[1], iso[2], iso[3], iso[4], iso[5], iso[6]
    );
  }
  return '';
}

function respostaCacheDashboardValida_(resposta, pagina) {
  return objetoDashboardValido_(resposta) &&
    resposta.ok === true && resposta.pagina === pagina &&
    typeof resposta.atualizadoEm === 'string' &&
    typeof resposta.avisoImportacao === 'string' &&
    dadosCacheDashboardValidos_(resposta.dados, pagina);
}

function obterDadosPaginaDashboard(pagina, filtros) {
  var construtores = {
    vencimentos: montarPaginaVencimentos_,
    fichas: montarPaginaFichas_,
    avaliacoes: montarPaginaAvaliacoes_,
    planos: montarPaginaPlanos_
  };
  if (!Object.prototype.hasOwnProperty.call(construtores, pagina)) {
    throw new Error('Página inválida.');
  }
  filtros = normalizarFiltrosDashboard_(filtros);
  try {
    var cache = CacheService.getScriptCache();
    var chave = chaveCacheDashboard_(pagina, filtros);
    var existente = cache.get(chave);
    if (existente) {
      try {
        var respostaCache = JSON.parse(existente);
        if (respostaCacheDashboardValida_(respostaCache, pagina)) return respostaCache;
      } catch (erroJsonCache) {
        // Conteúdo inválido é apenas um cache miss; a fonte oficial será relida.
      }
    }
    var base = lerBaseDashboard_();
    var hoje = new Date();
    var opcoes = {
      polos: opcoesDashboard_(base.contratos, 'polo'),
      statusAlunos: opcoesDashboard_(base.alunos, 'status'),
      frequencias: opcoesDashboard_(base.contratos, 'contrato_x_sem'),
      modalidades: opcoesDashboard_(base.contratos, 'modalidade'),
      statusContratos: opcoesDashboard_(base.contratos, 'status_contrato')
    };
    var filtrada = filtrarBaseDashboard_(base.alunos, base.contratos, filtros, hoje, pagina);
    var dados = construtores[pagina](filtrada.alunos, filtrada.contratos, hoje);
    dados.filtros = opcoes;
    dados = paginarPaginaDashboard_(dados, filtros.paginaLista || 1, filtros.limite || 25);
    var erroPosterior = base.ultimaImportacao && base.ultimaTentativa &&
      base.ultimaTentativa.status === 'ERRO' &&
      base.ultimaTentativa.linha > base.ultimaImportacao.linha;
    var dataAviso = erroPosterior
      ? dataAvisoImportacaoDashboard_(base.ultimaTentativa.concluidaEm || base.ultimaTentativa.dataReferencia)
      : '';
    var aviso = erroPosterior
      ? 'A última tentativa de atualização falhou' + (dataAviso ? ' em ' + dataAviso : '') +
        '. Exibindo a última base válida.'
      : '';
    var resposta = {
      ok: true,
      pagina: pagina,
      atualizadoEm: base.ultimaImportacao ? base.ultimaImportacao.concluidaEm : '',
      avisoImportacao: aviso,
      dados: dados
    };
    try {
      cache.put(chave, JSON.stringify(resposta), CONFIG.dashboard.cacheSegundos);
    } catch (erroCache) {
      // Cache é uma otimização: falhas de capacidade não invalidam os dados calculados.
    }
    return resposta;
  } catch (erro) {
    console.error('dashboard_error', {
      pagina: pagina,
      tipo: tipoErroDashboardSeguro_(erro)
    });
    throw new Error('Não foi possível carregar o dashboard.');
  }
}

function assinaturaAbaFluxoDashboard_(planilha, nomeAba, cabecalhos) {
  var aba = planilha.getSheetByName(nomeAba);
  if (!aba) return nomeAba + ':ausente';
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 1) return nomeAba + ':vazia';
  var valores = aba.getRange(1, 1, ultimaLinha, cabecalhos.length).getDisplayValues();
  return nomeAba + ':' + ultimaLinha + ':' + hashTextoDashboard_(JSON.stringify(valores));
}

function assinaturaFluxoDashboard_(planilha) {
  return assinaturaAbaFluxoDashboard_(planilha, CONFIG.abas.fluxoLeads, CONFIG.cabecalhos.fluxoLeads) + '|' +
    assinaturaAbaFluxoDashboard_(planilha, CONFIG.abas.fluxoChurns, CONFIG.cabecalhos.fluxoChurns);
}

function versaoBootstrapDashboard_(ultimaImportacao, assinaturaFluxo) {
  var importacao = ultimaImportacao && ultimaImportacao.execucaoId ? ultimaImportacao.execucaoId : 'sem-importacao';
  return 'importacao:' + importacao + '|config:' + obterVersaoDashboard_() + '|fluxo:' + (assinaturaFluxo || 'sem-fluxo');
}

function chaveBootstrapDashboard_(versao) {
  return 'dashboard:bootstrap:v2:' + hashTextoDashboard_(versao);
}

function obterCacheDashboard_() {
  try {
    return CacheService.getScriptCache();
  } catch (erro) {
    return null;
  }
}

function respostaBootstrapDashboardValida_(resposta, versao) {
  return objetoDashboardValido_(resposta) && resposta.versao === versao &&
    typeof resposta.atualizadoEm === 'string' && objetoDashboardValido_(resposta.filtrosPadrao) &&
    objetoDashboardValido_(resposta.configuracao) && Array.isArray(resposta.alunos) &&
    Array.isArray(resposta.contratos) && Array.isArray(resposta.permanencia) &&
    Array.isArray(resposta.eventosPermanencia) && Array.isArray(resposta.perfisAlunos) &&
    Array.isArray(resposta.catalogoPerfisAlunos) && objetoDashboardValido_(resposta.fluxo) &&
    Array.isArray(resposta.fluxo.leads) && Array.isArray(resposta.fluxo.churns);
}

function normalizarPoloDashboard_(valor) {
  return String(valor == null ? '' : valor).trim().toLocaleLowerCase('pt-BR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function resolverPoloPadraoDashboard_(poloPadrao, contratos) {
  var procurado = normalizarPoloDashboard_(poloPadrao);
  if (!procurado) return '';
  var polos = Array.from(new Set((contratos || []).map(function (contrato) {
    return String(contrato.polo || '').trim();
  }).filter(Boolean)));
  var exato = polos.filter(function (polo) { return normalizarPoloDashboard_(polo) === procurado; })[0];
  if (exato) return exato;
  var parcial = polos.filter(function (polo) {
    var normalizado = normalizarPoloDashboard_(polo);
    return normalizado.indexOf(procurado) !== -1 || procurado.indexOf(normalizado) !== -1;
  })[0];
  return parcial || '';
}

function montarBootstrapDashboard_(base, configuracao, versao) {
  var filtrosPadrao = {
    status: configuracao.filtrosPadrao.status,
    polo: resolverPoloPadraoDashboard_(configuracao.filtrosPadrao.polo, base.contratos)
  };
  return {
    versao: versao,
    atualizadoEm: base.ultimaImportacao ? base.ultimaImportacao.concluidaEm : '',
    filtrosPadrao: filtrosPadrao,
    configuracao: {
      homeCards: configuracao.homeCards,
      alertas: configuracao.alertas,
      perfisPagamento: configuracao.perfisPagamento,
      opcoesPerfilPagamento: DASHBOARD_CONFIGURACAO_PADRAO.perfisPagamento
    },
    alunos: base.alunos.map(alunoSeguroParaDashboard_),
    contratos: base.contratos.map(contratoSeguroParaDashboard_),
    permanencia: base.permanencia.map(permanenciaSeguraParaDashboard_),
    eventosPermanencia: base.eventosPermanencia.map(eventoPermanenciaSeguroParaDashboard_),
    perfisAlunos: lerPerfisAlunosDashboard_(base.planilha),
    catalogoPerfisAlunos: lerCatalogoPerfisAlunosDashboard_(base.planilha),
    fluxo: lerFluxoDashboardDaPlanilha_(base.planilha)
  };
}

function obterBootstrapDashboard() {
  try {
    var base = lerBaseDashboard_();
    var versao = versaoBootstrapDashboard_(base.ultimaImportacao, assinaturaFluxoDashboard_(base.planilha));
    var cache = obterCacheDashboard_();
    var chave = chaveBootstrapDashboard_(versao);
    if (cache) {
      var existente = cache.get(chave);
      if (existente) {
        try {
          var respostaCache = JSON.parse(existente);
          if (respostaBootstrapDashboardValida_(respostaCache, versao)) return respostaCache;
        } catch (erroCache) {
          // Um cache descartável inválido nunca impede a leitura da fonte oficial.
        }
      }
    }
    var resposta = montarBootstrapDashboard_(
      base,
      lerConfiguracaoDashboardPersistente_(base.planilha),
      versao
    );
    if (cache) {
      try { cache.put(chave, JSON.stringify(resposta), CONFIG.dashboard.cacheSegundos); } catch (erroGravacaoCache) {
        // Cache é apenas uma otimização.
      }
    }
    return resposta;
  } catch (erro) {
    console.error('dashboard_bootstrap_error', { tipo: tipoErroDashboardSeguro_(erro) });
    throw new Error('Não foi possível carregar o dashboard.');
  }
}

function obterVersaoDashboard() {
  try {
    var planilha = obterPlanilhaMestre_();
    var ultimaImportacao = obterUltimaImportacaoDashboard_(planilha);
    return {
      versao: versaoBootstrapDashboard_(ultimaImportacao, assinaturaFluxoDashboard_(planilha)),
      atualizadoEm: ultimaImportacao ? ultimaImportacao.concluidaEm : '',
      capacidades: { perfilAluno: true }
    };
  } catch (erro) {
    console.error('dashboard_version_error', { tipo: tipoErroDashboardSeguro_(erro) });
    throw new Error('Não foi possível verificar a atualização do dashboard.');
  }
}

function dataFiltroAnaliseChurns_(valor) {
  var texto = String(valor == null ? '' : valor).trim();
  var data = inicioDiaDashboard_(texto);
  return data && formatarDataDashboard_(data) === texto ? texto : '';
}

function mesFiltroAnaliseChurns_(valor) {
  var texto = String(valor == null ? '' : valor).trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(texto) ? texto : '';
}

function normalizarFiltrosAnaliseChurns_(recebidos) {
  recebidos = objetoDashboardValido_(recebidos) ? recebidos : {};
  return {
    mesInicio: mesFiltroAnaliseChurns_(recebidos.mesInicio),
    mesFim: mesFiltroAnaliseChurns_(recebidos.mesFim),
    semanaInicio: dataFiltroAnaliseChurns_(recebidos.semanaInicio),
    semanaFim: dataFiltroAnaliseChurns_(recebidos.semanaFim)
  };
}

function limitesSemanaisPadraoChurns_(filtros) {
  var hoje = inicioDiaDashboard_(new Date());
  var inicioDaSemana = inicioSemanaChurnFluxo_(hoje);
  var fimDaSemana = new Date(
    inicioDaSemana.getFullYear(), inicioDaSemana.getMonth(), inicioDaSemana.getDate() + 6, 12
  );
  var fim = filtros.semanaFim ? inicioDiaDashboard_(filtros.semanaFim) : fimDaSemana;
  var inicio = filtros.semanaInicio ? inicioDiaDashboard_(filtros.semanaInicio) :
    new Date(inicioSemanaChurnFluxo_(fim).getFullYear(), inicioSemanaChurnFluxo_(fim).getMonth(), inicioSemanaChurnFluxo_(fim).getDate() - (25 * 7), 12);
  return { inicio: formatarDataDashboard_(inicio), fim: formatarDataDashboard_(fim) };
}

function chaveCacheAnaliseChurns_(filtros, versaoChurn) {
  return 'dashboard:churn:analytics:v1:' + hashTextoDashboard_(
    String(versaoChurn) + '|' + JSON.stringify(filtros)
  );
}

function obterAnaliseChurnsDashboard(filtros) {
  try {
    filtros = normalizarFiltrosAnaliseChurns_(filtros);
    var limitesSemana = limitesSemanaisPadraoChurns_(filtros);
    filtros.semanaInicio = limitesSemana.inicio;
    filtros.semanaFim = limitesSemana.fim;
    var cache = obterCacheDashboard_();
    var chave = chaveCacheAnaliseChurns_(filtros, obterVersaoChurnDashboard_());
    if (cache) {
      try {
        var existente = cache.get(chave);
        if (existente) return JSON.parse(existente);
      } catch (erroCacheLeitura) {
        // Cache descartável inválido nunca impede a análise da fonte oficial.
      }
    }
    var planilha = obterPlanilhaMestre_();
    var analise = analiseChurnFluxo_(
      filtrarChurnsFluxoParaDashboard_(lerChurnsDashboardDaPlanilha_(planilha)), filtros
    );
    if (cache) {
      try { cache.put(chave, JSON.stringify(analise), CONFIG.dashboard.cacheSegundos); } catch (erroCacheGravacao) {
        // Cache é apenas uma otimização.
      }
    }
    return analise;
  } catch (erro) {
    console.error('dashboard_churn_analytics_error', { tipo: tipoErroDashboardSeguro_(erro) });
    throw new Error('Não foi possível carregar a análise de churns.');
  }
}
