var GRUPOS_PREVIA_TRANSICAO_CHURNS = Object.freeze({
  comDadosManuais: 'Migrará com dados manuais preservados',
  semDadosManuais: 'Migrará sem dados manuais anteriores',
  antigoSemOficial: 'Registro antigo sem correspondente oficial',
  divergencia: 'Divergência para revisão'
});

var CAMPOS_MANUAIS_TRANSICAO_CHURNS = Object.freeze([
  'telefone', 'profissional_responsavel', 'ultimo_personal', 'motivo_saida',
  'sinais_contexto', 'acao_retencao'
]);

function textoTransicaoChurn_(valor) {
  return String(valor == null ? '' : valor).trim();
}

function normalizarCabecalhoTransicaoChurn_(valor) {
  return textoTransicaoChurn_(valor).normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function normalizarIdTransicaoChurn_(valor) {
  var texto = textoTransicaoChurn_(valor);
  if (!texto) return '';
  return /^\d+\.0+$/.test(texto) ? texto.replace(/\.0+$/, '') : texto;
}

function dataTransicaoChurn_(valor) {
  if (Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor.getTime())) {
    return [
      String(valor.getDate()).padStart(2, '0'),
      String(valor.getMonth() + 1).padStart(2, '0'),
      String(valor.getFullYear())
    ].join('/');
  }
  var texto = textoTransicaoChurn_(valor);
  var brasileira = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (brasileira) {
    var dataBrasileira = new Date(Number(brasileira[3]), Number(brasileira[2]) - 1, Number(brasileira[1]), 12);
    if (dataBrasileira.getFullYear() === Number(brasileira[3]) &&
        dataBrasileira.getMonth() === Number(brasileira[2]) - 1 &&
        dataBrasileira.getDate() === Number(brasileira[1])) return texto;
  }
  var iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (iso) return dataTransicaoChurn_(iso[3] + '/' + iso[2] + '/' + iso[1]);
  return '';
}

function chaveDataTransicaoChurn_(valor) {
  var data = dataTransicaoChurn_(valor);
  if (!data) return '';
  var partes = data.split('/');
  return partes[2] + partes[1] + partes[0];
}

function mapaCabecalhosTransicaoChurn_(cabecalhos) {
  return (cabecalhos || []).reduce(function (mapa, valor, indice) {
    var chave = normalizarCabecalhoTransicaoChurn_(valor);
    if (chave && !Object.prototype.hasOwnProperty.call(mapa, chave)) mapa[chave] = indice;
    return mapa;
  }, {});
}

function linhaPorCabecalhosTransicaoChurn_(linha, mapa) {
  return Object.keys(mapa).reduce(function (objeto, chave) {
    objeto[chave] = linha[mapa[chave]];
    return objeto;
  }, {});
}

function localizarCabecalhosOficiaisTransicaoChurn_(linhas) {
  var obrigatorios = ['codigo', 'cliente', 'contrato', 'valor', 'inicio', 'vencimento', 'professor', 'modalidade'];
  var indice = -1;
  var mapa = null;
  (linhas || []).some(function (linha, posicao) {
    var candidato = mapaCabecalhosTransicaoChurn_(linha);
    if (!obrigatorios.every(function (campo) { return Object.prototype.hasOwnProperty.call(candidato, campo); })) return false;
    indice = posicao;
    mapa = candidato;
    return true;
  });
  if (indice === -1) throw new Error('Fonte oficial de Churns sem cabeçalhos obrigatórios.');
  return { indice: indice, mapa: mapa };
}

function registroPreviaTransicaoChurn_(valores) {
  return {
    grupo: valores.grupo || '',
    alunoId: valores.alunoId || '',
    nomeOficial: valores.nomeOficial || '',
    nomeAnterior: valores.nomeAnterior || '',
    inicioOficial: valores.inicioOficial || '',
    vencimentoOficial: valores.vencimentoOficial || '',
    planoOficial: valores.planoOficial || '',
    valorOficial: valores.valorOficial === '' || valores.valorOficial == null ? '' : valores.valorOficial,
    professorOficial: valores.professorOficial || '',
    modalidadeOficial: valores.modalidadeOficial || '',
    telefonePreservado: valores.telefonePreservado || '',
    profissionalResponsavel: valores.profissionalResponsavel || '',
    ultimoPersonal: valores.ultimoPersonal || '',
    motivoSaida: valores.motivoSaida || '',
    sinaisContexto: valores.sinaisContexto || '',
    acaoRetencao: valores.acaoRetencao || '',
    detalheRevisao: valores.detalheRevisao || ''
  };
}

function lerOficiaisTransicaoChurn_(linhas) {
  var estrutura = localizarCabecalhosOficiaisTransicaoChurn_(linhas);
  var validos = [];
  var divergencias = [];
  linhas.slice(estrutura.indice + 1).forEach(function (linha) {
    var origem = linhaPorCabecalhosTransicaoChurn_(linha, estrutura.mapa);
    var alunoId = normalizarIdTransicaoChurn_(origem.codigo);
    var vencimento = dataTransicaoChurn_(origem.vencimento);
    var possuiAlgumDado = Object.keys(origem).some(function (campo) { return textoTransicaoChurn_(origem[campo]); });
    if (!possuiAlgumDado) return;
    var base = {
      alunoId: alunoId,
      nomeOficial: textoTransicaoChurn_(origem.cliente),
      inicioOficial: dataTransicaoChurn_(origem.inicio),
      vencimentoOficial: vencimento,
      planoOficial: textoTransicaoChurn_(origem.contrato),
      valorOficial: origem.valor === '' || origem.valor == null ? '' : origem.valor,
      professorOficial: textoTransicaoChurn_(origem.professor),
      modalidadeOficial: textoTransicaoChurn_(origem.modalidade)
    };
    if (!alunoId || !vencimento) {
      divergencias.push(registroPreviaTransicaoChurn_(Object.assign(base, {
        grupo: GRUPOS_PREVIA_TRANSICAO_CHURNS.divergencia,
        detalheRevisao: !alunoId ? 'ID ausente na fonte oficial' : 'Vencimento ausente ou inválido na fonte oficial'
      })));
      return;
    }
    validos.push(base);
  });
  return { validos: validos, divergencias: divergencias };
}

function indiceChurnsAntigosTransicao_(churnsAtuais) {
  var cabecalhos = CONFIG.cabecalhos.fluxoChurns;
  return (churnsAtuais || []).reduce(function (indice, linha) {
    var item = cabecalhos.reduce(function (objeto, campo, posicao) {
      objeto[campo] = linha[posicao];
      return objeto;
    }, {});
    var alunoId = normalizarIdTransicaoChurn_(item.aluno_id);
    if (!alunoId) {
      indice.semId.push(item);
      return indice;
    }
    (indice.porId[alunoId] || (indice.porId[alunoId] = [])).push(item);
    return indice;
  }, { porId: {}, semId: [] });
}

function possuiDadosManuaisTransicaoChurn_(item) {
  return CAMPOS_MANUAIS_TRANSICAO_CHURNS.some(function (campo) {
    return Boolean(textoTransicaoChurn_(item[campo]));
  });
}

function dadosManuaisTransicaoChurn_(item) {
  return {
    telefonePreservado: textoTransicaoChurn_(item.telefone),
    profissionalResponsavel: textoTransicaoChurn_(item.profissional_responsavel),
    ultimoPersonal: textoTransicaoChurn_(item.ultimo_personal),
    motivoSaida: textoTransicaoChurn_(item.motivo_saida),
    sinaisContexto: textoTransicaoChurn_(item.sinais_contexto),
    acaoRetencao: textoTransicaoChurn_(item.acao_retencao)
  };
}

function consolidarOficiaisTransicaoChurn_(oficiais) {
  return (oficiais || []).reduce(function (indice, item) {
    var atual = indice[item.alunoId];
    if (!atual) {
      indice[item.alunoId] = { item: item, empate: false };
      return indice;
    }
    var chaveAtual = chaveDataTransicaoChurn_(atual.item.vencimentoOficial);
    var chaveNova = chaveDataTransicaoChurn_(item.vencimentoOficial);
    if (chaveNova > chaveAtual) indice[item.alunoId] = { item: item, empate: false };
    else if (chaveNova === chaveAtual) atual.empate = true;
    return indice;
  }, {});
}

function grupoParaResumoTransicaoChurn_(grupo) {
  if (grupo === GRUPOS_PREVIA_TRANSICAO_CHURNS.comDadosManuais) return 'migraraComDadosManuais';
  if (grupo === GRUPOS_PREVIA_TRANSICAO_CHURNS.semDadosManuais) return 'migraraSemDadosManuais';
  if (grupo === GRUPOS_PREVIA_TRANSICAO_CHURNS.antigoSemOficial) return 'antigoSemCorrespondenteOficial';
  return 'divergenciaParaRevisao';
}

function construirPreviaTransicaoChurns_(linhasOficiais, churnsAtuais) {
  var oficiais = lerOficiaisTransicaoChurn_(linhasOficiais);
  var antigos = indiceChurnsAntigosTransicao_(churnsAtuais);
  var consolidados = consolidarOficiaisTransicaoChurn_(oficiais.validos);
  var linhas = oficiais.divergencias.slice();
  var idsOficiais = Object.keys(consolidados);

  idsOficiais.forEach(function (alunoId) {
    var consolidado = consolidados[alunoId];
    var antigosDoId = antigos.porId[alunoId] || [];
    var manuais = antigosDoId.filter(possuiDadosManuaisTransicaoChurn_);
    var referenciaAntiga = antigosDoId[0] || {};
    var base = registroPreviaTransicaoChurn_(Object.assign({}, consolidado.item, {
      nomeAnterior: textoTransicaoChurn_(referenciaAntiga.nome)
    }));
    if (consolidado.empate) {
      linhas.push(registroPreviaTransicaoChurn_(Object.assign(base, {
        grupo: GRUPOS_PREVIA_TRANSICAO_CHURNS.divergencia,
        detalheRevisao: 'Empate no maior vencimento oficial'
      })));
      return;
    }
    if (manuais.length > 1) {
      linhas.push(registroPreviaTransicaoChurn_(Object.assign(base, {
        grupo: GRUPOS_PREVIA_TRANSICAO_CHURNS.divergencia,
        detalheRevisao: 'Mais de um registro manual para o ID'
      })));
      return;
    }
    linhas.push(registroPreviaTransicaoChurn_(Object.assign(base,
      manuais.length ? dadosManuaisTransicaoChurn_(manuais[0]) : {}, {
        grupo: manuais.length ? GRUPOS_PREVIA_TRANSICAO_CHURNS.comDadosManuais : GRUPOS_PREVIA_TRANSICAO_CHURNS.semDadosManuais
      }
    )));
  });

  antigos.semId.forEach(function (item) {
    linhas.push(registroPreviaTransicaoChurn_({
      grupo: GRUPOS_PREVIA_TRANSICAO_CHURNS.divergencia,
      nomeAnterior: textoTransicaoChurn_(item.nome),
      detalheRevisao: 'ID ausente na lista antiga'
    }));
  });
  Object.keys(antigos.porId).filter(function (alunoId) {
    return idsOficiais.indexOf(alunoId) === -1;
  }).forEach(function (alunoId) {
    var item = antigos.porId[alunoId][0];
    linhas.push(registroPreviaTransicaoChurn_({
      grupo: GRUPOS_PREVIA_TRANSICAO_CHURNS.antigoSemOficial,
      alunoId: alunoId,
      nomeAnterior: textoTransicaoChurn_(item.nome)
    }));
  });

  var ordem = [
    GRUPOS_PREVIA_TRANSICAO_CHURNS.comDadosManuais,
    GRUPOS_PREVIA_TRANSICAO_CHURNS.semDadosManuais,
    GRUPOS_PREVIA_TRANSICAO_CHURNS.antigoSemOficial,
    GRUPOS_PREVIA_TRANSICAO_CHURNS.divergencia
  ];
  linhas.sort(function (a, b) {
    var grupo = ordem.indexOf(a.grupo) - ordem.indexOf(b.grupo);
    return grupo || a.alunoId.localeCompare(b.alunoId, 'pt-BR', { numeric: true }) ||
      a.nomeOficial.localeCompare(b.nomeOficial, 'pt-BR');
  });
  var resumo = {
    migraraComDadosManuais: 0,
    migraraSemDadosManuais: 0,
    antigoSemCorrespondenteOficial: 0,
    divergenciaParaRevisao: 0
  };
  linhas.forEach(function (linha) { resumo[grupoParaResumoTransicaoChurn_(linha.grupo)] += 1; });
  return { linhas: linhas, resumo: resumo };
}
