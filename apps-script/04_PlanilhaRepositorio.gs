function obterPlanilhaMestre_() {
  return SpreadsheetApp.openById(CONFIG.planilhaId);
}

function obterAbaImportacoes_() {
  var aba = obterPlanilhaMestre_().getSheetByName(CONFIG.abas.importacoes);
  if (!aba) throw new Error('Aba IMPORTACOES não encontrada.');
  return aba;
}

var CHAVES_ABAS_GERENCIADAS = Object.freeze([
  'alunos', 'contratos', 'visaoMestre', 'basePermanencia', 'historicoPermanencia'
]);

function garantirEstruturaPlanilha() {
  var planilha = obterPlanilhaMestre_();
  Object.keys(CONFIG.abas).forEach(function (chave) {
    var nome = CONFIG.abas[chave];
    var cabecalhos = CONFIG.cabecalhos[chave];
    var aba = planilha.getSheetByName(nome) || planilha.insertSheet(nome);
    if (aba.getMaxColumns() < cabecalhos.length) {
      aba.insertColumnsAfter(aba.getMaxColumns(), cabecalhos.length - aba.getMaxColumns());
    }
    aba.getRange(1, 1, 1, cabecalhos.length)
      .setValues([cabecalhos])
      .setFontWeight('bold')
      .setBackground('#14324A')
      .setFontColor('#FFFFFF');
    aba.setFrozenRows(1);

    var protecoes = aba.getProtections(SpreadsheetApp.ProtectionType.RANGE).filter(function (protecao) {
      return protecao.getDescription() === 'TecnoFit - cabeçalho';
    });
    if (!protecoes.length) {
      aba.getRange(1, 1, 1, cabecalhos.length)
        .protect()
        .setDescription('TecnoFit - cabeçalho')
        .setWarningOnly(true);
    }
  });
  planilha.getSheetByName(CONFIG.abas.visaoMestre).hideColumns(13);
  if (typeof garantirConfiguracoesDashboardNaPlanilha_ === 'function') {
    garantirConfiguracoesDashboardNaPlanilha_(planilha);
  }
  SpreadsheetApp.flush();
}

function validarLarguras_(linhas, largura, nomeAba) {
  linhas.forEach(function (linha, indice) {
    if (!Array.isArray(linha) || linha.length !== largura) {
      throw new Error(nomeAba + ': largura inválida na linha ' + (indice + 2) + '.');
    }
  });
}

function escreverAbaGerenciada_(aba, cabecalhos, linhas) {
  aba.clearContents();
  aba.getRange(1, 1, 1, cabecalhos.length)
    .setValues([cabecalhos])
    .setFontWeight('bold')
    .setBackground('#14324A')
    .setFontColor('#FFFFFF');
  if (linhas.length) {
    aba.getRange(2, 1, linhas.length, cabecalhos.length).setValues(linhas);
  }
  aba.setFrozenRows(1);
  var filtro = aba.getFilter();
  if (filtro) filtro.remove();
  aba.getRange(1, 1, Math.max(linhas.length + 1, 2), cabecalhos.length).createFilter();
}

function lerLinhasAbaGerenciada_(chave) {
  var planilha = obterPlanilhaMestre_();
  var aba = planilha.getSheetByName(CONFIG.abas[chave]);
  var cabecalhos = CONFIG.cabecalhos[chave];
  if (!aba || aba.getLastRow() < 1) throw new Error('Aba gerenciada ausente: ' + chave);
  var valores = aba.getRange(1, 1, aba.getLastRow(), cabecalhos.length).getValues();
  cabecalhos.forEach(function (cabecalho, indice) {
    if (String(valores[0][indice]) !== cabecalho) throw new Error('Estrutura incompatível: ' + chave);
  });
  return valores.slice(1).filter(function (linha) {
    return linha.some(function (valor) { return valor !== '' && valor != null; });
  });
}

function lerObjetosAbaGerenciada_(chave) {
  var cabecalhos = CONFIG.cabecalhos[chave];
  return lerLinhasAbaGerenciada_(chave).map(function (linha) {
    return cabecalhos.reduce(function (objeto, cabecalho, indice) {
      objeto[cabecalho] = linha[indice];
      return objeto;
    }, {});
  });
}

function lerDadosOperacionaisAtuais_() {
  return {
    alunos: lerLinhasAbaGerenciada_('alunos'),
    contratos: lerLinhasAbaGerenciada_('contratos'),
    visaoMestre: lerLinhasAbaGerenciada_('visaoMestre')
  };
}

function lerEstadoPermanencia_() {
  return {
    base: lerObjetosAbaGerenciada_('basePermanencia'),
    historico: lerObjetosAbaGerenciada_('historicoPermanencia')
  };
}

function substituirAbasGerenciadas(dados) {
  var linhasPorChave = {
    alunos: dados.alunos || [],
    contratos: dados.contratos || [],
    visaoMestre: dados.visaoMestre || [],
    basePermanencia: serializarObjetosPermanencia_(
      dados.basePermanencia || [], CONFIG.cabecalhos.basePermanencia
    ),
    historicoPermanencia: serializarObjetosPermanencia_(
      dados.historicoPermanencia || [], CONFIG.cabecalhos.historicoPermanencia
    )
  };

  CHAVES_ABAS_GERENCIADAS.forEach(function (chave) {
    validarLarguras_(linhasPorChave[chave], CONFIG.cabecalhos[chave].length, CONFIG.abas[chave]);
  });

  var planilha = obterPlanilhaMestre_();
  var abas = CHAVES_ABAS_GERENCIADAS.reduce(function (mapa, chave) {
    var aba = planilha.getSheetByName(CONFIG.abas[chave]);
    if (!aba) throw new Error('Aba gerenciada não configurada: ' + CONFIG.abas[chave]);
    mapa[chave] = aba;
    return mapa;
  }, {});

  CHAVES_ABAS_GERENCIADAS.forEach(function (chave) {
    escreverAbaGerenciada_(abas[chave], CONFIG.cabecalhos[chave], linhasPorChave[chave]);
  });

  var linhasAlunos = Math.max(linhasPorChave.alunos.length, 1);
  var linhasContratos = Math.max(linhasPorChave.contratos.length, 1);
  var linhasVisao = Math.max(linhasPorChave.visaoMestre.length, 1);
  var linhasBasePermanencia = Math.max(linhasPorChave.basePermanencia.length, 1);
  var linhasHistoricoPermanencia = Math.max(linhasPorChave.historicoPermanencia.length, 1);
  abas.alunos.getRange(2, 5, linhasAlunos, 3).setNumberFormat('dd/MM/yyyy');
  abas.contratos.getRange(2, 5, linhasContratos, 1).setNumberFormat('R$ #,##0.00');
  abas.contratos.getRange(2, 6, linhasContratos, 2).setNumberFormat('dd/MM/yyyy');
  abas.visaoMestre.getRange(2, 6, linhasVisao, 1).setNumberFormat('R$ #,##0.00');
  abas.visaoMestre.getRange(2, 7, linhasVisao, 3).setNumberFormat('dd/MM/yyyy');
  abas.visaoMestre.getRange(2, 11, linhasVisao, 2).setNumberFormat('dd/MM/yyyy');
  abas.basePermanencia.getRange(2, 3, linhasBasePermanencia, 1).setNumberFormat('dd/MM/yyyy');
  abas.basePermanencia.getRange(2, 7, linhasBasePermanencia, 2).setNumberFormat('yyyy-MM-dd');
  abas.historicoPermanencia.getRange(2, 3, linhasHistoricoPermanencia, 1).setNumberFormat('yyyy-MM-dd');
  abas.historicoPermanencia.getRange(2, 9, linhasHistoricoPermanencia, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  abas.visaoMestre.hideColumns(13);
  SpreadsheetApp.flush();
}

function criarBackupAbasGerenciadas() {
  var planilha = obterPlanilhaMestre_();
  return CHAVES_ABAS_GERENCIADAS.reduce(function (backup, chave) {
    var aba = planilha.getSheetByName(CONFIG.abas[chave]);
    if (!aba) throw new Error('Aba não encontrada para backup: ' + CONFIG.abas[chave]);
    backup[chave] = aba.getDataRange().getValues();
    return backup;
  }, {});
}

function restaurarBackupAbasGerenciadas(backup) {
  var planilha = obterPlanilhaMestre_();
  CHAVES_ABAS_GERENCIADAS.forEach(function (chave) {
    var aba = planilha.getSheetByName(CONFIG.abas[chave]);
    var valores = backup[chave] || [CONFIG.cabecalhos[chave]];
    aba.clearContents();
    if (valores.length && valores[0].length) {
      aba.getRange(1, 1, valores.length, valores[0].length).setValues(valores);
    }
  });
  SpreadsheetApp.flush();
}
