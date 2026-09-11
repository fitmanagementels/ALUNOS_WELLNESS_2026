function contarPorDashboard_(linhas, campo) {
  return (linhas || []).reduce(function (acc, linha) {
    var chave = String(linha[campo] || 'Não informado');
    acc[chave] = (acc[chave] || 0) + 1;
    return acc;
  }, Object.create(null));
}

function opcoesDashboard_(linhas, campo) {
  return Array.from(new Set((linhas || []).map(function (linha) {
    return String(linha[campo] || '').trim();
  }).filter(Boolean))).sort(function (a, b) {
    return a.localeCompare(b, 'pt-BR');
  });
}

function filtrarBaseDashboard_(alunos, contratos, filtros, hoje, pagina) {
  filtros = filtros || {};
  hoje = hoje || new Date();
  var busca = String(filtros.busca || '').toLocaleLowerCase('pt-BR');
  var alunosFiltrados = (alunos || []).filter(function (aluno) {
    var correspondeBusca = !busca || String(aluno.aluno || '').toLocaleLowerCase('pt-BR').indexOf(busca) !== -1 ||
      String(aluno.id || '').toLocaleLowerCase('pt-BR').indexOf(busca) !== -1;
    var correspondeSituacao = true;
    if (filtros.situacao && (pagina === 'fichas' || pagina === 'avaliacoes')) {
      var campo = pagina === 'fichas' ? 'data_ficha' : 'data_avaliacao';
      var limite = pagina === 'fichas' ? CONFIG.dashboard.diasFicha : CONFIG.dashboard.diasAvaliacao;
      correspondeSituacao = classificarAtualizacao_(aluno[campo], hoje, limite) === filtros.situacao;
    }
    return correspondeBusca && correspondeSituacao &&
      (!filtros.statusAluno || String(aluno.status || '') === filtros.statusAluno);
  });
  var idsPermitidos = alunosFiltrados.reduce(function (acc, aluno) {
    acc[String(aluno.id)] = true;
    return acc;
  }, Object.create(null));
  var contratosFiltrados = (contratos || []).filter(function (contrato) {
    var dias = diasEntreDashboard_(hoje, contrato.vencimento);
    var correspondePeriodo = !filtros.periodoDias ||
      (dias != null && dias >= 0 && dias <= Number(filtros.periodoDias));
    var correspondeSituacao = !filtros.situacao || pagina === 'fichas' || pagina === 'avaliacoes';
    if (filtros.situacao && pagina === 'vencimentos') {
      correspondeSituacao = classificarVencimento_(contrato.vencimento, hoje) === filtros.situacao;
    }
    return idsPermitidos[String(contrato.id)] &&
      correspondePeriodo && correspondeSituacao &&
      (!filtros.polo || String(contrato.polo || '') === filtros.polo) &&
      (!filtros.frequencia || String(contrato.contrato_x_sem || '') === filtros.frequencia) &&
      (!filtros.modalidade || String(contrato.modalidade || '') === filtros.modalidade) &&
      (!filtros.statusContrato || String(contrato.status_contrato || '') === filtros.statusContrato);
  });
  if (filtros.polo || filtros.periodoDias || filtros.frequencia || filtros.modalidade ||
      filtros.statusContrato || (filtros.situacao && pagina !== 'fichas' && pagina !== 'avaliacoes')) {
    var idsComContrato = contratosFiltrados.reduce(function (acc, contrato) {
      acc[String(contrato.id)] = true;
      return acc;
    }, Object.create(null));
    alunosFiltrados = alunosFiltrados.filter(function (aluno) {
      return idsComContrato[String(aluno.id)];
    });
  }
  return { alunos: alunosFiltrados, contratos: contratosFiltrados };
}

function mapaAlunosDashboard_(alunos) {
  return unicosPor_(alunos, 'id').reduce(function (acc, aluno) {
    acc[String(aluno.id)] = aluno;
    return acc;
  }, Object.create(null));
}

function polosPorAlunoDashboard_(contratos) {
  return (contratos || []).reduce(function (acc, contrato) {
    var id = String(contrato.id || '');
    var polo = String(contrato.polo || 'Não informado');
    if (!acc[id]) acc[id] = [];
    if (acc[id].indexOf(polo) === -1) acc[id].push(polo);
    return acc;
  }, Object.create(null));
}

function vencimentosPorSemanaDashboard_(linhas, hoje) {
  var semanas = [0, 1, 2, 3, 4, 5].map(function (indice) {
    var inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + indice * 7, 12);
    var fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6, 12);
    return { chave: String(indice), label: formatarDataDashboard_(inicio) + '–' + formatarDataDashboard_(fim), valor: 0 };
  });
  linhas.forEach(function (linha) {
    if (linha.diasParaVencer == null || linha.diasParaVencer < 0) return;
    var indice = Math.floor(linha.diasParaVencer / 7);
    if (semanas[indice]) semanas[indice].valor += 1;
  });
  return semanas;
}

function faixasAtualizacaoDashboard_(lista) {
  return lista.reduce(function (acc, linha) {
    var dias = linha.diasSemAtualizacao;
    var faixa = linha.situacao === 'ausente' ? 'Sem data'
      : dias <= 30 ? '0–30 dias'
      : dias <= 60 ? '31–60 dias'
      : dias <= 90 ? '61–90 dias' : 'Mais de 90 dias';
    acc[faixa] = (acc[faixa] || 0) + 1;
    return acc;
  }, Object.create(null));
}

function coberturaPorPoloDashboard_(lista) {
  var grupos = Object.create(null);
  lista.forEach(function (linha) {
    (linha.polos || ['Não informado']).forEach(function (polo) {
      if (!grupos[polo]) grupos[polo] = { total: 0, cobertos: 0 };
      grupos[polo].total += 1;
      if (linha.situacao !== 'ausente') grupos[polo].cobertos += 1;
    });
  });
  return Object.keys(grupos).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).map(function (polo) {
    return { polo: polo, cobertura: Math.round((grupos[polo].cobertos / grupos[polo].total) * 1000) / 10 };
  });
}

function somarPorDashboard_(linhas, grupo, valor) {
  return (linhas || []).reduce(function (acc, linha) {
    var chave = String(linha[grupo] || 'Não informado');
    acc[chave] = (acc[chave] || 0) + (Number(linha[valor]) || 0);
    return acc;
  }, Object.create(null));
}

function linhaContratoDashboard_(contrato, aluno, hoje) {
  return {
    chave: contrato._chave_contrato,
    id: String(contrato.id || ''),
    aluno: aluno ? aluno.aluno : '',
    statusAluno: aluno ? aluno.status : '',
    frequencia: contrato.contrato_x_sem || '',
    modalidade: contrato.modalidade || '',
    polo: contrato.polo || 'Não informado',
    inicioCorrente: formatarDataDashboard_(contrato.inicio_corrente),
    vencimento: formatarDataDashboard_(contrato.vencimento),
    diasParaVencer: diasEntreDashboard_(hoje, contrato.vencimento),
    situacao: classificarVencimento_(contrato.vencimento, hoje),
    statusContrato: contrato.status_contrato || '',
    valor: Number(contrato.valor) || 0
  };
}

function montarPaginaVencimentos_(alunos, contratos, hoje) {
  var unicos = unicosPor_(contratos, '_chave_contrato');
  var mapa = mapaAlunosDashboard_(alunos);
  var lista = unicos.map(function (contrato) {
    return linhaContratoDashboard_(contrato, mapa[String(contrato.id)], hoje);
  }).sort(function (a, b) {
    var da = a.diasParaVencer == null ? 999999 : a.diasParaVencer;
    var db = b.diasParaVencer == null ? 999999 : b.diasParaVencer;
    return da - db || String(a.chave || '').localeCompare(String(b.chave || ''), 'pt-BR');
  });
  var kpis = { vencidos: 0, ate7: 0, ate30: 0, valorAte30: 0 };
  lista.forEach(function (linha) {
    if (linha.situacao === 'vencido') kpis.vencidos += 1;
    if (linha.situacao === 'ate7') kpis.ate7 += 1;
    if (linha.diasParaVencer != null && linha.diasParaVencer >= 0 && linha.diasParaVencer <= 30) {
      kpis.ate30 += 1;
      kpis.valorAte30 += linha.valor;
    }
  });
  return {
    kpis: kpis,
    operacao: montarOperacaoVencimentosDashboard_(lista, hoje),
    graficos: {
      situacao: contarPorDashboard_(lista, 'situacao'),
      semanas: vencimentosPorSemanaDashboard_(lista, hoje),
      porPolo: contarPorDashboard_(lista, 'polo')
    },
    lista: lista,
    filtros: {}
  };
}

function resumoVencimentosDashboard_(linhas, chave, titulo, corresponde) {
  var contratos = linhas.filter(corresponde);
  return {
    chave: chave,
    titulo: titulo,
    alunos: unicosPor_(contratos, 'id').length,
    contratos: contratos.length,
    valor: contratos.reduce(function (soma, contrato) { return soma + contrato.valor; }, 0)
  };
}

function montarOperacaoVencimentosDashboard_(lista, hoje) {
  var janela11Dias = [];
  for (var deslocamento = -5; deslocamento <= 5; deslocamento += 1) {
    var data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + deslocamento, 12);
    var contratosDia = lista.filter(function (linha) { return linha.diasParaVencer === deslocamento; });
    janela11Dias.push({
      deslocamento: deslocamento,
      data: formatarDataDashboard_(data),
      hoje: deslocamento === 0,
      alunos: unicosPor_(contratosDia, 'id').length,
      contratos: contratosDia.length,
      valor: contratosDia.reduce(function (soma, contrato) { return soma + contrato.valor; }, 0)
    });
  }
  var blocos = [
    { chave: '1-7', titulo: '1–7', inicio: 1, fim: 7 },
    { chave: '8-15', titulo: '8–15', inicio: 8, fim: 15 },
    { chave: '16-23', titulo: '16–23', inicio: 16, fim: 23 },
    { chave: '24-fim', titulo: '24–fim', inicio: 24, fim: 31 }
  ];
  var mapaMensal = blocos.map(function (bloco) {
    var contratosBloco = lista.filter(function (linha) {
      var data = paraDataDashboard_(linha.vencimento);
      return data && data.getFullYear() === hoje.getFullYear() && data.getMonth() === hoje.getMonth() &&
        data.getDate() >= bloco.inicio && data.getDate() <= bloco.fim;
    });
    return {
      chave: bloco.chave,
      titulo: bloco.titulo,
      alunos: unicosPor_(contratosBloco, 'id').length,
      contratos: contratosBloco.length,
      valor: contratosBloco.reduce(function (soma, contrato) { return soma + contrato.valor; }, 0)
    };
  });
  return {
    resumos: [
      resumoVencimentosDashboard_(lista, 'ultimos_5_dias', 'Venceram nos últimos 5 dias', function (linha) {
        return linha.diasParaVencer >= -5 && linha.diasParaVencer <= -1;
      }),
      resumoVencimentosDashboard_(lista, 'hoje', 'Vencem hoje', function (linha) {
        return linha.diasParaVencer === 0;
      }),
      resumoVencimentosDashboard_(lista, 'proximos_5_dias', 'Vencem nos próximos 5 dias', function (linha) {
        return linha.diasParaVencer >= 1 && linha.diasParaVencer <= 5;
      })
    ],
    janela11Dias: janela11Dias,
    mapaMensal: mapaMensal
  };
}

function contratosPorAlunoDashboard_(contratos) {
  return unicosPor_(contratos, '_chave_contrato').reduce(function (mapa, contrato) {
    var id = String(contrato.id == null ? '' : contrato.id);
    if (!mapa[id]) mapa[id] = [];
    mapa[id].push(contrato);
    return mapa;
  }, Object.create(null));
}

function linhaAcompanhamentoDashboard_(aluno, contratos, classificacao, campoData) {
  var contratosSeguros = (contratos || []).map(function (contrato) {
    return {
      chave: String(contrato._chave_contrato || ''),
      contrato: String(contrato.contrato_completo || ''),
      frequencia: String(contrato.contrato_x_sem || ''),
      polo: String(contrato.polo || 'Não informado'),
      valor: Number(contrato.valor) || 0,
      vencimento: formatarDataDashboard_(contrato.vencimento)
    };
  });
  return {
    id: String(aluno.id || ''),
    aluno: String(aluno.aluno || ''),
    situacao: classificacao.situacao,
    prioridade: classificacao.prioridade,
    dias: classificacao.dias,
    data: formatarDataDashboard_(aluno[campoData]),
    valorMensal: contratosSeguros.reduce(function (soma, contrato) { return soma + contrato.valor; }, 0),
    contratos: contratosSeguros
  };
}

function montarPaginaAcompanhamento_(alunos, contratos, hoje, tipo, regras) {
  var campo = tipo === 'avaliacoes' ? 'data_avaliacao' : 'data_ficha';
  var classificar = tipo === 'avaliacoes' ? classificarAvaliacao_ : classificarPrescricao_;
  var porAluno = contratosPorAlunoDashboard_(contratos);
  var lista = unicosPor_(alunos, 'id').map(function (aluno) {
    return linhaAcompanhamentoDashboard_(aluno, porAluno[String(aluno.id)] || [], classificar(aluno[campo], hoje, regras), campo);
  }).sort(function (a, b) {
    return a.prioridade - b.prioridade || b.valorMensal - a.valorMensal ||
      a.aluno.localeCompare(b.aluno, 'pt-BR') || a.id.localeCompare(b.id, 'pt-BR');
  });
  var porSituacao = contarPorDashboard_(lista, 'situacao');
  var semDado = tipo === 'avaliacoes' ? (porSituacao.sem_avaliacao || 0) : (porSituacao.sem_ficha || 0);
  var criticos = (porSituacao.vermelho || 0) + (porSituacao.roxo || 0) + (porSituacao.falha_critica || 0);
  var emAtencao = lista.filter(function (linha) { return linha.situacao !== 'verde'; });
  return {
    tipo: tipo,
    kpis: {
      verde: porSituacao.verde || 0,
      laranja: porSituacao.laranja || 0,
      criticos: criticos,
      semDado: semDado,
      valorEmAtencao: emAtencao.reduce(function (soma, linha) { return soma + linha.valorMensal; }, 0)
    },
    graficos: { situacoes: porSituacao },
    lista: lista
  };
}

function montarHomeDashboard_(alunos, contratos, hoje, regras, cartoes) {
  regras = regras || {};
  cartoes = cartoes || [];
  var prescricoes = montarPaginaAcompanhamento_(alunos, contratos, hoje, 'prescricoes', regras.prescricoes);
  var avaliacoes = montarPaginaAcompanhamento_(alunos, contratos, hoje, 'avaliacoes', regras.avaliacoes);
  var vencimentos = montarPaginaVencimentos_(alunos, contratos, hoje);
  var catalogo = {
    prescricoes_criticas: prescricoes.lista.filter(function (linha) { return linha.situacao !== 'verde'; }),
    avaliacoes_criticas: avaliacoes.lista.filter(function (linha) { return linha.situacao !== 'verde'; }),
    vencidos_5_dias: vencimentos.lista.filter(function (linha) { return linha.diasParaVencer >= -5 && linha.diasParaVencer <= -1; }),
    vencem_hoje: vencimentos.lista.filter(function (linha) { return linha.diasParaVencer === 0; }),
    vencem_5_dias: vencimentos.lista.filter(function (linha) { return linha.diasParaVencer >= 1 && linha.diasParaVencer <= 5; })
  };
  return {
    cartoes: cartoes.filter(function (cartao) { return cartao.ativo; }).sort(function (a, b) { return a.ordem - b.ordem; }).map(function (cartao) {
      var lista = catalogo[cartao.chave] || [];
      return { chave: cartao.chave, titulo: cartao.titulo, total: lista.length, lista: lista };
    }),
    positivos: {
      prescricoesVerdes: prescricoes.kpis.verde,
      avaliacoesVerdes: avaliacoes.kpis.verde
    }
  };
}

function montarPaginaAtualizacao_(alunos, contratos, hoje, campo, limiteDias) {
  var polos = polosPorAlunoDashboard_(contratos);
  var lista = unicosPor_(alunos, 'id').map(function (aluno) {
    var situacao = classificarAtualizacao_(aluno[campo], hoje, limiteDias);
    return {
      id: String(aluno.id || ''), aluno: aluno.aluno || '', contato: aluno.contato || '',
      polos: polos[String(aluno.id)] || ['Não informado'], situacao: situacao,
      data: formatarDataDashboard_(aluno[campo]), diasSemAtualizacao: diasEntreDashboard_(aluno[campo], hoje)
    };
  }).sort(function (a, b) {
    var peso = { ausente: 0, desatualizada: 1, atualizada: 2 };
    return peso[a.situacao] - peso[b.situacao] ||
      (b.diasSemAtualizacao || 0) - (a.diasSemAtualizacao || 0) ||
      String(a.id || '').localeCompare(String(b.id || ''), 'pt-BR');
  });
  var contagem = contarPorDashboard_(lista, 'situacao');
  var total = lista.length;
  return {
    kpis: {
      atualizadas: contagem.atualizada || 0,
      desatualizadas: contagem.desatualizada || 0,
      ausentes: contagem.ausente || 0,
      cobertura: total ? Math.round(((total - (contagem.ausente || 0)) / total) * 1000) / 10 : 0
    },
    graficos: {
      situacao: contagem,
      faixas: faixasAtualizacaoDashboard_(lista),
      coberturaPorPolo: coberturaPorPoloDashboard_(lista)
    },
    lista: lista,
    filtros: {}
  };
}

function montarPaginaFichas_(alunos, contratos, hoje) {
  return montarPaginaAtualizacao_(alunos, contratos, hoje, 'data_ficha', CONFIG.dashboard.diasFicha);
}

function montarPaginaAvaliacoes_(alunos, contratos, hoje) {
  return montarPaginaAtualizacao_(alunos, contratos, hoje, 'data_avaliacao', CONFIG.dashboard.diasAvaliacao);
}

function montarPaginaPlanos_(alunos, contratos, hoje) {
  var unicos = unicosPor_(contratos, '_chave_contrato');
  var mapa = mapaAlunosDashboard_(alunos);
  var valor = unicos.reduce(function (soma, contrato) { return soma + (Number(contrato.valor) || 0); }, 0);
  var lista = unicos.map(function (contrato) {
    var aluno = mapa[String(contrato.id)];
    return {
      chaveOrdenacao: String(contrato._chave_contrato || ''),
      linha: {
        aluno: aluno ? aluno.aluno : '',
        statusAluno: aluno ? aluno.status : '',
        frequencia: contrato.contrato_x_sem || '',
        modalidade: contrato.modalidade || '',
        polo: contrato.polo || 'Não informado',
        inicioCorrente: formatarDataDashboard_(contrato.inicio_corrente),
        vencimento: formatarDataDashboard_(contrato.vencimento),
        statusContrato: contrato.status_contrato || '',
        valor: Number(contrato.valor) || 0
      }
    };
  }).sort(function (a, b) {
    var da = paraDataDashboard_(a.linha.vencimento);
    var db = paraDataDashboard_(b.linha.vencimento);
    var diferenca = (da ? da.getTime() : Infinity) - (db ? db.getTime() : Infinity);
    return diferenca || a.chaveOrdenacao.localeCompare(b.chaveOrdenacao, 'pt-BR');
  }).map(function (item) {
    return item.linha;
  });
  var quantidadeAlunos = unicosPor_(alunos, 'id').length;
  return {
    kpis: {
      alunos: quantidadeAlunos,
      contratos: unicos.length,
      valor: valor,
      ticketMedio: unicos.length ? valor / unicos.length : 0,
      ticketPorAluno: quantidadeAlunos ? valor / quantidadeAlunos : 0,
      valorPorAulaMedio: unicos.length ? unicos.reduce(function (soma, contrato) {
        return soma + calcularValorPorAula_(contrato.valor, contrato.contrato_x_sem);
      }, 0) / unicos.length : 0
    },
    graficos: {
      polos: contarPorDashboard_(unicos, 'polo'), frequencias: contarPorDashboard_(unicos, 'contrato_x_sem'),
      modalidades: contarPorDashboard_(unicos, 'modalidade'), status: contarPorDashboard_(unicos, 'status_contrato'),
      valorPorPolo: somarPorDashboard_(unicos, 'polo', 'valor')
    },
    lista: lista, filtros: {}
  };
}

function paginarPaginaDashboard_(dados, pagina, limite) {
  var totalItens = dados.lista.length;
  var totalPaginas = totalItens ? Math.ceil(totalItens / limite) : 0;
  pagina = totalPaginas ? Math.min(pagina, totalPaginas) : 1;
  var inicio = (pagina - 1) * limite;
  return {
    kpis: dados.kpis,
    graficos: dados.graficos,
    lista: dados.lista.slice(inicio, inicio + limite),
    filtros: dados.filtros,
    paginacao: { pagina: pagina, limite: limite, totalItens: totalItens, totalPaginas: totalPaginas }
  };
}
