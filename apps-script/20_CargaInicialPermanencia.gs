var CARGA_INICIAL_PERMANENCIA = Object.freeze({
  dataReferencia: '2026-08-07',
  revisao: '01',
  nomeCanonico: 'permanencia_2026-08-07_r01.xls',
  nomeLegado: 'clientes por permanencia (07_08).xls'
});

function localizarArquivoCargaInicialPermanencia_() {
  var nomesAceitos = [
    CARGA_INICIAL_PERMANENCIA.nomeCanonico,
    CARGA_INICIAL_PERMANENCIA.nomeLegado
  ].map(function (nome) { return nome.toLowerCase(); });
  var encontrados = listarArquivosEntrada().filter(function (entrada) {
    return nomesAceitos.indexOf(String(entrada.nome || '').toLowerCase()) !== -1;
  });
  if (encontrados.length > 1) {
    throw new Error('Há mais de um arquivo disponível para a carga inicial de permanência.');
  }
  if (!encontrados.length) return null;
  return Object.assign({}, encontrados[0], {
    tipo: 'permanencia',
    dataReferencia: CARGA_INICIAL_PERMANENCIA.dataReferencia,
    revisao: CARGA_INICIAL_PERMANENCIA.revisao,
    nomeCanonico: CARGA_INICIAL_PERMANENCIA.nomeCanonico
  });
}

function moverArquivoCargaInicialPermanencia_(arquivo, destino) {
  var lote = {
    dataReferencia: CARGA_INICIAL_PERMANENCIA.dataReferencia,
    revisao: CARGA_INICIAL_PERMANENCIA.revisao,
    arquivos: [arquivo]
  };
  return destino === 'rejeitado'
    ? moverLoteParaRejeitados(lote)
    : moverLoteParaProcessados(lote);
}

function registrarCargaInicialPermanencia_(arquivo, execucaoId, quantidade, agora) {
  var entradaLog = Object.assign({}, arquivo, {
    tipo: 'permanencia',
    nome: CARGA_INICIAL_PERMANENCIA.nomeCanonico,
    dataReferencia: CARGA_INICIAL_PERMANENCIA.dataReferencia,
    revisao: CARGA_INICIAL_PERMANENCIA.revisao
  });
  var aba = obterAbaImportacoes_();
  var referencias = iniciarLogImportacao(aba, [entradaLog], execucaoId, agora);
  finalizarLogImportacao(aba, referencias, {
    status: 'SUCESSO',
    mensagem: 'Carga inicial de permanência concluída',
    contagens: {
      permanencia: { lidas: quantidade, validas: quantidade, rejeitadas: 0 }
    }
  }, agora);
}

function executarCargaInicialPermanenciaComDependencias_(deps) {
  var lock = deps.adquirirLock();
  var arquivo = null;
  var backup = null;
  var substituiu = false;
  try {
    var execucaoId = deps.gerarExecucaoId();
    var estado = deps.lerEstado();
    if (estado.base.length) {
      throw new Error('A carga inicial de permanência já foi carregada.');
    }
    arquivo = deps.localizarArquivo();
    if (!arquivo) {
      throw new Error('Arquivo da carga inicial de permanência não encontrado em 01_ENTRADA.');
    }
    var linhas = deps.lerArquivo(arquivo);
    var agora = deps.agora();
    var atualizacao = deps.transformarPermanencia(
      linhas,
      estado.base,
      estado.historico,
      {
        dataReferencia: CARGA_INICIAL_PERMANENCIA.dataReferencia,
        revisao: CARGA_INICIAL_PERMANENCIA.revisao,
        importacaoId: execucaoId,
        registradoEm: agora,
        cargaInicial: true
      }
    );
    var operacionais = deps.enriquecerOperacional(
      deps.lerOperacional(), atualizacao.porId
    );
    operacionais.basePermanencia = atualizacao.base;
    operacionais.historicoPermanencia = atualizacao.historico;
    operacionais.avisos = atualizacao.avisos;
    var idsOperacionais = (operacionais.alunos || []).reduce(function (mapa, linha) {
      var id = normalizarId(linha[0]);
      if (id) mapa[id] = true;
      return mapa;
    }, Object.create(null));
    var associadosOperacao = atualizacao.base.filter(function (item) {
      return idsOperacionais[String(item.id || '')];
    }).length;

    backup = deps.backup();
    deps.substituir(operacionais);
    substituiu = true;
    deps.moverProcessado(arquivo);
    deps.incrementarVersao();
    deps.registrarSucesso(arquivo, execucaoId, linhas.length, agora);
    return {
      ok: true,
      execucaoId: execucaoId,
      dataReferencia: CARGA_INICIAL_PERMANENCIA.dataReferencia,
      registros: atualizacao.base.length,
      eventos: atualizacao.historico.length,
      associadosOperacao: associadosOperacao,
      somenteHistorico: atualizacao.base.length - associadosOperacao,
      avisos: atualizacao.avisos
    };
  } catch (erro) {
    if (substituiu && backup) {
      try { deps.restaurar(backup); } catch (erroRestauracao) {
        console.error('Falha ao restaurar carga inicial: ' + erroRestauracao);
      }
      if (arquivo && deps.moverRejeitado) {
        try { deps.moverRejeitado(arquivo); } catch (erroMovimentacao) {
          console.error('Falha ao rejeitar arquivo da carga inicial: ' + erroMovimentacao);
        }
      }
    }
    throw erro;
  } finally {
    lock.releaseLock();
  }
}

function criarDependenciasCargaInicialPermanencia_() {
  return {
    adquirirLock: adquirirLockImportacao_,
    gerarExecucaoId: function () { return Utilities.getUuid(); },
    localizarArquivo: localizarArquivoCargaInicialPermanencia_,
    lerArquivo: function (entrada) { return lerTabelaArquivo_(entrada, 'permanencia').linhas; },
    lerEstado: lerEstadoPermanencia_,
    lerOperacional: lerDadosOperacionaisAtuais_,
    transformarPermanencia: construirAtualizacaoPermanencia_,
    enriquecerOperacional: enriquecerDadosOperacionaisComPermanencia_,
    backup: criarBackupAbasGerenciadas,
    substituir: substituirAbasGerenciadas,
    moverProcessado: function (arquivo) {
      return moverArquivoCargaInicialPermanencia_(arquivo, 'processado');
    },
    moverRejeitado: function (arquivo) {
      return moverArquivoCargaInicialPermanencia_(arquivo, 'rejeitado');
    },
    restaurar: restaurarBackupAbasGerenciadas,
    incrementarVersao: incrementarVersaoDashboard_,
    registrarSucesso: registrarCargaInicialPermanencia_,
    agora: function () { return new Date(); }
  };
}

function executarCargaInicialPermanencia() {
  garantirEstruturaPlanilha();
  return executarCargaInicialPermanenciaComDependencias_(
    criarDependenciasCargaInicialPermanencia_()
  );
}
