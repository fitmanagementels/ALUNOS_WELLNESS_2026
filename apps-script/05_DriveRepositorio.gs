function validarPartesData_(ano, mes, dia, nomeArquivo) {
  var data = new Date(Number(ano), Number(mes) - 1, Number(dia), 12, 0, 0, 0);
  if (
    data.getFullYear() !== Number(ano) ||
    data.getMonth() !== Number(mes) - 1 ||
    data.getDate() !== Number(dia)
  ) {
    throw new Error('Data inválida no nome do arquivo: ' + nomeArquivo);
  }
}

function parseNomeArquivo(nome) {
  var texto = String(nome || '');
  var match = /^(vencimentos|fichas|avaliacao_fisica|permanencia)_(\d{4})[-_](\d{2})[-_](\d{2})_r(\d{2})\.(xls|xlsx)$/i.exec(texto);
  if (!match) throw new Error('Arquivo inválido: ' + texto);

  var tipo = match[1].toLowerCase();
  validarPartesData_(match[2], match[3], match[4], texto);
  var dataReferencia = match[2] + '-' + match[3] + '-' + match[4];
  var extensaoRecebida = match[6].toLowerCase();
  return {
    tipo: tipo,
    dataReferencia: dataReferencia,
    revisao: match[5],
    extensaoRecebida: extensaoRecebida,
    nomeCanonico: tipo + '_' + dataReferencia + '_r' + match[5] + '.' + extensaoRecebida
  };
}

function detectarFormatoArquivo(blob) {
  var bytes = blob.getBytes();
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return { formato: 'xlsx', extensaoCanonica: 'xlsx' };
  }
  return { formato: 'html', extensaoCanonica: 'xls' };
}

function agruparLote(arquivos) {
  if (!arquivos.length) throw new Error('A pasta 01_ENTRADA está vazia.');

  var enriquecidos = arquivos.map(function (arquivo) {
    var parsed = parseNomeArquivo(arquivo.nome);
    return Object.assign({}, arquivo, parsed);
  });
  var primeiraData = enriquecidos[0].dataReferencia;
  var primeiraRevisao = enriquecidos[0].revisao;
  if (enriquecidos.some(function (arquivo) {
    return arquivo.dataReferencia !== primeiraData || arquivo.revisao !== primeiraRevisao;
  })) {
    throw new Error('Os quatro arquivos precisam ter a mesma data e revisão.');
  }

  var arquivosPorTipo = {};
  enriquecidos.forEach(function (arquivo) {
    if (arquivosPorTipo[arquivo.tipo]) {
      throw new Error('Tipo repetido no lote: ' + arquivo.tipo);
    }
    arquivosPorTipo[arquivo.tipo] = arquivo;
  });

  var ausentes = CONFIG.tiposObrigatorios.filter(function (tipo) {
    return !arquivosPorTipo[tipo];
  });
  if (ausentes.length) throw new Error('Lote incompleto. Faltando: ' + ausentes.join(', '));
  if (enriquecidos.length !== CONFIG.tiposObrigatorios.length) {
    throw new Error('A pasta 01_ENTRADA deve conter exatamente quatro arquivos.');
  }

  return {
    dataReferencia: primeiraData,
    revisao: primeiraRevisao,
    arquivos: enriquecidos,
    arquivosPorTipo: arquivosPorTipo
  };
}

var NOME_POP_ENTRADA = 'leia-me_pop_01_entrada.pdf';

function filtrarArquivosOperacionaisEntrada_(arquivos) {
  return arquivos.filter(function (arquivo) {
    return String(arquivo.nome || '').toLowerCase() !== NOME_POP_ENTRADA;
  });
}

function listarArquivosEntrada() {
  var iterator = DriveApp.getFolderById(CONFIG.pastaEntradaId).getFiles();
  var arquivos = [];
  while (iterator.hasNext()) {
    var arquivo = iterator.next();
    arquivos.push({ id: arquivo.getId(), nome: arquivo.getName(), arquivo: arquivo });
  }
  return arquivos;
}

function enriquecerArquivosReconhecidos_(arquivos) {
  return arquivos.map(function (arquivo) {
    return Object.assign({}, arquivo, parseNomeArquivo(arquivo.nome));
  });
}

function lerTabelaArquivo_(entrada, tipo) {
  var blob = entrada.arquivo.getBlob();
  var formato = detectarFormatoArquivo(blob);
  var linhasBrutas;
  if (formato.formato === 'xlsx') {
    linhasBrutas = parseTabelaXlsx(blob);
  } else {
    var html = blob.getDataAsString('UTF-8');
    if (!/<table\b/i.test(html)) {
      throw new Error('Formato de arquivo inválido: esperado XLS HTML ou XLSX.');
    }
    linhasBrutas = parseTabelaHtml(html);
  }
  return {
    linhas: tabelaParaObjetos(linhasBrutas, CABECALHOS_ORIGEM[tipo]),
    extensaoCanonica: formato.extensaoCanonica
  };
}

function lerTabelasDoLote(lote) {
  var resultado = { contagens: {} };
  CONFIG.tiposObrigatorios.forEach(function (tipo) {
    var entrada = lote.arquivosPorTipo[tipo];
    var leitura = lerTabelaArquivo_(entrada, tipo);
    entrada.nomeCanonico = entrada.tipo + '_' + lote.dataReferencia + '_r' + lote.revisao + '.' + leitura.extensaoCanonica;
    var linhas = leitura.linhas;
    resultado[tipo] = linhas;
    resultado.contagens[tipo] = {
      lidas: linhas.length,
      validas: linhas.length,
      rejeitadas: 0
    };
  });
  return resultado;
}

function obterOuCriarPastaFilha_(pastaPai, nome) {
  var pastas = pastaPai.getFoldersByName(nome);
  return pastas.hasNext() ? pastas.next() : pastaPai.createFolder(nome);
}

function moverLotePara_(lote, pastaRaizId) {
  var pastaRaiz = DriveApp.getFolderById(pastaRaizId);
  var pastaAno = obterOuCriarPastaFilha_(pastaRaiz, lote.dataReferencia.slice(0, 4));
  var pastaData = obterOuCriarPastaFilha_(pastaAno, lote.dataReferencia);
  lote.arquivos.forEach(function (entrada) {
    entrada.arquivo.setName(entrada.nomeCanonico);
    entrada.arquivo.moveTo(pastaData);
  });
  return pastaData.getId();
}

function moverLoteParaProcessados(lote) {
  return moverLotePara_(lote, CONFIG.pastaProcessadosId);
}

function moverLoteParaRejeitados(lote) {
  return moverLotePara_(lote, CONFIG.pastaRejeitadosId);
}

function inspecionarPastaEntrada() {
  var arquivos = filtrarArquivosOperacionaisEntrada_(listarArquivosEntrada());
  if (!arquivos.length) {
    return { ready: false, lote: null, erros: ['A pasta 01_ENTRADA está vazia.'] };
  }
  try {
    var lote = agruparLote(arquivos);
    return {
      ready: true,
      lote: {
        dataReferencia: lote.dataReferencia,
        revisao: 'r' + lote.revisao,
        arquivos: lote.arquivos.map(function (arquivo) { return arquivo.nome; })
      },
      erros: []
    };
  } catch (erro) {
    return { ready: false, lote: null, erros: [String(erro.message || erro)] };
  }
}
