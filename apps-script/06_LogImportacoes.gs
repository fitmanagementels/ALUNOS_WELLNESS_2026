function iniciarLogImportacao(aba, arquivos, execucaoId, inicio) {
  var primeiraLinha = aba.getLastRow() + 1;
  var valores = arquivos.map(function (arquivo) {
    return [
      execucaoId,
      inicio,
      '',
      arquivo.tipo,
      arquivo.nome,
      arquivo.id,
      arquivo.dataReferencia,
      'r' + arquivo.revisao,
      '', '', '',
      'PROCESSANDO',
      'Importação iniciada'
    ];
  });
  aba.getRange(primeiraLinha, 1, valores.length, CONFIG.cabecalhos.importacoes.length).setValues(valores);
  SpreadsheetApp.flush();
  return arquivos.map(function (arquivo, indice) {
    return { tipo: arquivo.tipo, linha: primeiraLinha + indice };
  });
}

function finalizarLogImportacao(aba, referencias, resultado, fim) {
  referencias.forEach(function (referencia) {
    var contagem = (resultado.contagens && resultado.contagens[referencia.tipo]) || {
      lidas: '', validas: '', rejeitadas: ''
    };
    aba.getRange(referencia.linha, 3).setValue(fim);
    aba.getRange(referencia.linha, 9, 1, 5).setValues([[
      contagem.lidas,
      contagem.validas,
      contagem.rejeitadas,
      resultado.status,
      String(resultado.mensagem || '').slice(0, 500)
    ]]);
  });
  SpreadsheetApp.flush();
}

function verificarLoteJaRegistrado(lote) {
  var valores = obterAbaImportacoes_().getDataRange().getDisplayValues();
  var revisao = 'r' + lote.revisao;
  var encontrado = valores.slice(1).some(function (linha) {
    return linha[6] === lote.dataReferencia && linha[7] === revisao;
  });
  if (encontrado) {
    throw new Error(
      'O lote ' + lote.dataReferencia + ' ' + revisao +
      ' já foi registrado. Envie uma revisão superior.'
    );
  }
}

function obterUltimaImportacaoBemSucedida() {
  var valores = obterAbaImportacoes_().getDataRange().getDisplayValues();
  for (var indice = valores.length - 1; indice >= 1; indice -= 1) {
    if (valores[indice][11] === 'SUCESSO') {
      return {
        execucaoId: valores[indice][0],
        concluidaEm: valores[indice][2],
        dataReferencia: valores[indice][6],
        revisao: valores[indice][7]
      };
    }
  }
  return null;
}
