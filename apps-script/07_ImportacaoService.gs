function executarImportacaoComDependencias_(deps) {
  var lock = deps.adquirirLock();
  var execucaoId = null;
  var arquivos = [];
  var lote = null;
  var referenciasLog = null;
  var backup = null;
  var substituiuDados = false;
  var tabelas = null;

  try {
    execucaoId = deps.gerarExecucaoId();
    arquivos = deps.descobrirArquivos();
    if (deps.filtrarArquivosEntrada) {
      arquivos = deps.filtrarArquivosEntrada(arquivos);
    }
    lote = deps.agruparLote(arquivos);
    deps.verificarReprocessamento(lote);
    referenciasLog = deps.iniciarLog(lote.arquivos, execucaoId);
    tabelas = deps.lerTabelas(lote);
    var estadoPermanencia = deps.lerEstadoPermanencia();
    var atualizacaoPermanencia = deps.transformarPermanencia(
      tabelas.permanencia,
      estadoPermanencia.base,
      estadoPermanencia.historico,
      {
        dataReferencia: lote.dataReferencia,
        revisao: lote.revisao,
        importacaoId: execucaoId,
        registradoEm: deps.agora(),
        cargaInicial: estadoPermanencia.base.length === 0
      }
    );
    var dados = deps.transformar(
      tabelas.vencimentos,
      tabelas.fichas,
      tabelas.avaliacao_fisica,
      atualizacaoPermanencia.porId,
      execucaoId
    );
    dados.basePermanencia = atualizacaoPermanencia.base;
    dados.historicoPermanencia = atualizacaoPermanencia.historico;
    dados.avisos = dados.avisos.concat(atualizacaoPermanencia.avisos);
    backup = deps.backup();
    deps.substituir(dados);
    substituiuDados = true;
    deps.moverProcessados(lote);
    deps.incrementarVersaoDashboard();
    deps.finalizarLog(referenciasLog, {
      status: 'SUCESSO',
      mensagem: dados.avisos.length ? dados.avisos.join(' | ') : 'Base atualizada',
      contagens: tabelas.contagens
    });
    return {
      ok: true,
      execucaoId: execucaoId,
      dataReferencia: lote.dataReferencia,
      revisao: 'r' + lote.revisao,
      alunos: dados.alunos.length,
      contratos: dados.contratos.length,
      permanencia: dados.basePermanencia.length,
      eventosPermanencia: dados.historicoPermanencia.length,
      avisos: dados.avisos,
      concluidoEm: deps.agoraIso()
    };
  } catch (erro) {
    if (!referenciasLog && arquivos.length && deps.enriquecerArquivos) {
      try {
        referenciasLog = deps.iniciarLog(deps.enriquecerArquivos(arquivos), execucaoId);
      } catch (erroLogInicial) {
        console.error('Não foi possível iniciar o log do erro: ' + erroLogInicial);
      }
    }
    if (substituiuDados && backup) {
      try { deps.restaurar(backup); } catch (erroRestauracao) {
        console.error('Falha ao restaurar backup: ' + erroRestauracao);
      }
    }
    if (lote) {
      try { deps.moverRejeitados(lote); } catch (erroMovimentacao) {
        console.error('Falha ao mover lote rejeitado: ' + erroMovimentacao);
      }
    }
    if (referenciasLog) {
      try {
        deps.finalizarLog(referenciasLog, {
          status: 'ERRO',
          mensagem: String(erro.message || erro),
          contagens: tabelas ? tabelas.contagens : {}
        });
      } catch (erroLogFinal) {
        console.error('Não foi possível finalizar o log do erro: ' + erroLogFinal);
      }
    }
    throw erro;
  } finally {
    lock.releaseLock();
  }
}

function adquirirLockImportacao_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    throw new Error('Já existe uma importação em andamento. Aguarde e tente novamente.');
  }
  return lock;
}

function formatarAgoraIso_() {
  return Utilities.formatDate(new Date(), CONFIG.fusoHorario, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function criarDependenciasImportacao_() {
  return {
    adquirirLock: adquirirLockImportacao_,
    gerarExecucaoId: function () { return Utilities.getUuid(); },
    descobrirArquivos: listarArquivosEntrada,
    filtrarArquivosEntrada: filtrarArquivosOperacionaisEntrada_,
    agruparLote: agruparLote,
    enriquecerArquivos: enriquecerArquivosReconhecidos_,
    verificarReprocessamento: verificarLoteJaRegistrado,
    iniciarLog: function (arquivos, execucaoId) {
      return iniciarLogImportacao(obterAbaImportacoes_(), arquivos, execucaoId, new Date());
    },
    lerTabelas: lerTabelasDoLote,
    lerEstadoPermanencia: lerEstadoPermanencia_,
    transformarPermanencia: construirAtualizacaoPermanencia_,
    transformar: construirDadosMestre,
    backup: criarBackupAbasGerenciadas,
    substituir: substituirAbasGerenciadas,
    moverProcessados: moverLoteParaProcessados,
    moverRejeitados: moverLoteParaRejeitados,
    restaurar: restaurarBackupAbasGerenciadas,
    incrementarVersaoDashboard: incrementarVersaoDashboard_,
    finalizarLog: function (referencias, resultado) {
      return finalizarLogImportacao(obterAbaImportacoes_(), referencias, resultado, new Date());
    },
    agoraIso: formatarAgoraIso_,
    agora: function () { return new Date(); }
  };
}

function executarImportacaoBackend_() {
  garantirEstruturaPlanilha();
  return executarImportacaoComDependencias_(criarDependenciasImportacao_());
}
