function statusMatriculadoPermanencia_(valor) {
  var status = String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
  return ['ativo', 'bloqueado', 'licenca', 'em licenca'].indexOf(status) !== -1;
}

function inteiroNaoNegativoPermanencia_(valor, campo, id) {
  var texto = String(valor == null ? '' : valor).trim();
  if (!/^\d+$/.test(texto)) throw new Error(campo + ' inválido para o ID ' + id + '.');
  return Number(texto);
}

function eventoIdPermanencia_(contexto, id, tipo, campo) {
  return [contexto.dataReferencia, 'r' + contexto.revisao, id, tipo, campo || 'geral'].join('|');
}

function criarEventoPermanencia_(contexto, id, tipo, campo, anterior, novo) {
  return {
    evento_id: eventoIdPermanencia_(contexto, id, tipo, campo),
    id: id,
    data_referencia: contexto.dataReferencia,
    tipo_evento: tipo,
    campo: campo || '',
    valor_anterior: anterior == null ? '' : anterior,
    valor_novo: novo == null ? '' : novo,
    importacao_id: contexto.importacaoId,
    registrado_em: contexto.registradoEm
  };
}

function objetosPorIdPermanencia_(linhas) {
  return (linhas || []).reduce(function (mapa, linha) {
    mapa[String(linha.id || '')] = Object.assign({}, linha);
    return mapa;
  }, Object.create(null));
}

function serializarObjetosPermanencia_(objetos, cabecalhos) {
  return (objetos || []).map(function (objeto) {
    return cabecalhos.map(function (cabecalho) { return objeto[cabecalho]; });
  });
}

function parseDataPermanencia_(valor) {
  if (valor && typeof valor.getTime === 'function' && !isNaN(valor.getTime())) {
    return new Date(valor.getTime());
  }
  return parseDataBr(valor);
}

function construirAtualizacaoPermanencia_(linhas, baseAnterior, historicoAnterior, contexto) {
  linhas = linhas || [];
  baseAnterior = baseAnterior || [];
  historicoAnterior = historicoAnterior || [];
  var avisos = [];
  var fontes = [];
  var idsFonte = Object.create(null);

  linhas.forEach(function (linha) {
    var id = normalizarId(linha.codigo);
    if (!id) throw new Error('Código vazio no relatório de permanência.');
    if (idsFonte[id]) throw new Error('Código duplicado na permanência: ' + id);
    idsFonte[id] = true;
    var clienteDesde = '';
    try {
      clienteDesde = parseDataPermanencia_(linha['cliente desde']);
    } catch (erroData) {
      avisos.push('ID ' + id + ': data inválida; valor anterior preservado.');
    }
    fontes.push({
      id: id,
      aluno: String(linha.cliente || '').trim(),
      clienteDesde: clienteDesde,
      status: String(linha['status atual'] || '').trim(),
      continuidade: inteiroNaoNegativoPermanencia_(linha['continuidade (meses)'], 'Continuidade', id),
      contratos: inteiroNaoNegativoPermanencia_(linha.contratos, 'Contratos', id)
    });
  });

  if (baseAnterior.length && !contexto.permitirLoteVazioEmTeste) {
    if (fontes.length < Math.ceil(baseAnterior.length * 0.8)) {
      throw new Error('Relatório de permanência com redução superior a 20%.');
    }
    var possuiaHistorico = baseAnterior.some(function (item) {
      return !statusMatriculadoPermanencia_(item.status_permanencia);
    });
    if (possuiaHistorico && fontes.length && fontes.every(function (item) {
      return statusMatriculadoPermanencia_(item.status);
    })) {
      throw new Error('Relatório de permanência contém somente ativos/matriculados.');
    }
  }

  var basePorId = objetosPorIdPermanencia_(baseAnterior);
  var eventos = historicoAnterior.map(function (item) { return Object.assign({}, item); });
  var eventosPorId = eventos.reduce(function (mapa, evento) {
    mapa[String(evento.evento_id || '')] = true;
    return mapa;
  }, Object.create(null));

  function adicionarEvento(id, tipo, campo, anterior, novo) {
    var evento = criarEventoPermanencia_(contexto, id, tipo, campo, anterior, novo);
    if (!eventosPorId[evento.evento_id]) {
      eventos.push(evento);
      eventosPorId[evento.evento_id] = true;
    }
  }

  fontes.forEach(function (fonte) {
    var anterior = basePorId[fonte.id] || null;
    var dataAnterior = anterior && anterior.cliente_desde ? parseDataPermanencia_(anterior.cliente_desde) : '';
    var dataFinal = dataAnterior || fonte.clienteDesde || '';
    if (fonte.clienteDesde && dataAnterior) {
      if (fonte.clienteDesde.getTime() < dataAnterior.getTime()) {
        dataFinal = fonte.clienteDesde;
        adicionarEvento(
          fonte.id, 'CORRECAO_CLIENTE_DESDE', 'cliente_desde',
          formatarDataIso(dataAnterior), formatarDataIso(fonte.clienteDesde)
        );
      } else if (fonte.clienteDesde.getTime() > dataAnterior.getTime()) {
        avisos.push('ID ' + fonte.id + ': data posterior preservada sem substituir a primeira entrada.');
      }
    }

    if (!anterior) {
      adicionarEvento(
        fonte.id, contexto.cargaInicial ? 'CARGA_INICIAL' : 'NOVO_ALUNO', '', '', ''
      );
    } else {
      if (String(anterior.status_permanencia || '') !== fonte.status) {
        adicionarEvento(
          fonte.id, 'ALTERACAO_STATUS', 'status_permanencia',
          anterior.status_permanencia, fonte.status
        );
      }
      if (Number(anterior.continuidade_meses_origem) !== fonte.continuidade) {
        adicionarEvento(
          fonte.id, 'ALTERACAO_CONTINUIDADE', 'continuidade_meses_origem',
          anterior.continuidade_meses_origem, fonte.continuidade
        );
      }
      if (Number(anterior.quantidade_contratos_origem) !== fonte.contratos) {
        adicionarEvento(
          fonte.id, 'ALTERACAO_CONTRATOS', 'quantidade_contratos_origem',
          anterior.quantidade_contratos_origem, fonte.contratos
        );
      }
      if (anterior.presente_ultimo_lote === false || String(anterior.presente_ultimo_lote).toLowerCase() === 'false') {
        adicionarEvento(fonte.id, 'REAPARECIMENTO', 'presente_ultimo_lote', false, true);
      }
    }

    basePorId[fonte.id] = {
      id: fonte.id,
      aluno: fonte.aluno || (anterior ? anterior.aluno : ''),
      cliente_desde: dataFinal,
      status_permanencia: fonte.status,
      continuidade_meses_origem: fonte.continuidade,
      quantidade_contratos_origem: fonte.contratos,
      primeira_observacao_em: anterior ? anterior.primeira_observacao_em : contexto.dataReferencia,
      ultima_observacao_em: contexto.dataReferencia,
      presente_ultimo_lote: true,
      importacao_id: contexto.importacaoId
    };
  });

  Object.keys(basePorId).forEach(function (id) {
    if (idsFonte[id]) return;
    var anterior = basePorId[id];
    if (anterior.presente_ultimo_lote === true || String(anterior.presente_ultimo_lote).toLowerCase() === 'true') {
      adicionarEvento(id, 'AUSENTE_NO_LOTE', 'presente_ultimo_lote', true, false);
    }
    basePorId[id] = Object.assign({}, anterior, { presente_ultimo_lote: false });
  });

  var base = Object.keys(basePorId).sort(function (a, b) {
    return Number(a) - Number(b);
  }).map(function (id) { return basePorId[id]; });
  return {
    base: base,
    historico: eventos,
    porId: objetosPorIdPermanencia_(base),
    avisos: avisos,
    resumo: { recebidos: fontes.length, conhecidos: base.length, eventos: eventos.length }
  };
}
