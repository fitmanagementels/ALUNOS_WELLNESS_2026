function atributoXmlXlsx_(texto, nome) {
  var match = new RegExp('\\b' + nome + '=["\\\']([^"\\\']*)["\\\']', 'i').exec(String(texto || ''));
  return match ? match[1] : '';
}

function textoXmlXlsx_(xml) {
  return decodificarCelulaHtml_(String(xml == null ? '' : xml));
}

function arquivosXlsxPorNome_(blobs) {
  return (blobs || []).reduce(function (indice, blob) {
    indice[String(blob.getName() || '').replace(/^\/+/, '')] = blob;
    return indice;
  }, {});
}

function lerSharedStringsXlsx_(blob) {
  if (!blob) return [];
  var xml = blob.getDataAsString('UTF-8');
  var itens = xml.match(/<si\b[^>]*>[\s\S]*?<\/si>/gi) || [];
  return itens.map(textoXmlXlsx_);
}

function indiceColunaXlsx_(referencia) {
  var letras = String(referencia || '').replace(/\d+/g, '').toUpperCase();
  if (!letras) return -1;
  return letras.split('').reduce(function (indice, letra) {
    return indice * 26 + letra.charCodeAt(0) - 64;
  }, 0) - 1;
}

function formatosDeDataXlsx_(blob) {
  if (!blob) return {};
  var xml = blob.getDataAsString('UTF-8');
  var personalizados = {};
  (xml.match(/<numFmt\b[^>]*\/?>(?:<\/numFmt>)?/gi) || []).forEach(function (tag) {
    var id = atributoXmlXlsx_(tag, 'numFmtId');
    var codigo = atributoXmlXlsx_(tag, 'formatCode');
    if (id) personalizados[id] = codigo;
  });

  var xfsMatch = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/i.exec(xml);
  var estilos = xfsMatch ? xfsMatch[1].match(/<xf\b[^>]*\/?>(?:<\/xf>)?/gi) || [] : [];
  return estilos.reduce(function (indice, tag, posicao) {
    var formato = atributoXmlXlsx_(tag, 'numFmtId');
    var codigo = personalizados[formato] || '';
    var numerico = Number(formato);
    var embutido = (numerico >= 14 && numerico <= 22) || (numerico >= 27 && numerico <= 36);
    indice[posicao] = embutido || /[dmy]/i.test(codigo);
    return indice;
  }, {});
}

function formatarDataSerialXlsx_(serial) {
  var numero = Number(serial);
  if (!isFinite(numero)) return String(serial == null ? '' : serial);
  var data = new Date(Date.UTC(1899, 11, 30) + Math.floor(numero) * 86400000);
  return [
    String(data.getUTCDate()).padStart(2, '0'),
    String(data.getUTCMonth() + 1).padStart(2, '0'),
    String(data.getUTCFullYear()).padStart(4, '0')
  ].join('/');
}

function valorCelulaXlsx_(atributos, conteudo, compartilhadas, formatosDeData) {
  var tipo = atributoXmlXlsx_(atributos, 't');
  var estilo = atributoXmlXlsx_(atributos, 's');
  var valorMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(conteudo);
  var valor = valorMatch ? textoXmlXlsx_(valorMatch[1]) : '';

  if (tipo === 's') {
    var indice = Number(valor);
    if (!isFinite(indice) || compartilhadas[indice] == null) {
      throw new Error('XLSX inválido: referência de shared string ausente.');
    }
    return compartilhadas[indice];
  }
  if (tipo === 'inlineStr') return textoXmlXlsx_(conteudo);
  if (tipo === 'b') return valor === '1' ? 'true' : 'false';
  if (formatosDeData[estilo] && valor !== '') return formatarDataSerialXlsx_(valor);
  return valor;
}

function primeiraWorksheetXlsx_(partes) {
  return Object.keys(partes)
    .filter(function (nome) { return /^xl\/worksheets\/sheet\d+\.xml$/i.test(nome); })
    .sort(function (a, b) {
      var numeroA = Number(/sheet(\d+)\.xml$/i.exec(a)[1]);
      var numeroB = Number(/sheet(\d+)\.xml$/i.exec(b)[1]);
      return numeroA - numeroB;
    })
    .map(function (nome) { return partes[nome]; })[0] || null;
}

function linhasWorksheetXlsx_(xml, compartilhadas, formatosDeData) {
  var rows = String(xml || '').match(/<row\b[^>]*>[\s\S]*?<\/row>/gi) || [];
  return rows.map(function (rowXml) {
    var linha = [];
    var celulas = rowXml.match(/<c\b[^>]*>[\s\S]*?<\/c>/gi) || [];
    celulas.forEach(function (celulaXml, posicao) {
      var abertura = /^<c\b([^>]*)>/i.exec(celulaXml);
      var atributos = abertura ? abertura[1] : '';
      var referencia = atributoXmlXlsx_(atributos, 'r');
      var coluna = indiceColunaXlsx_(referencia);
      linha[coluna >= 0 ? coluna : posicao] = valorCelulaXlsx_(
        atributos,
        celulaXml,
        compartilhadas,
        formatosDeData
      );
    });
    return linha.map(function (valor) { return valor == null ? '' : valor; });
  });
}

function parseTabelaXlsx(blob) {
  var partes;
  try {
    var blobZip = Utilities.newBlob(blob.getBytes(), 'application/zip', 'relatorio.xlsx');
    partes = arquivosXlsxPorNome_(Utilities.unzip(blobZip));
  } catch (erro) {
    throw new Error('XLSX inválido: não foi possível descompactar o arquivo.');
  }
  var worksheet = primeiraWorksheetXlsx_(partes);
  if (!worksheet) throw new Error('XLSX inválido: nenhuma worksheet encontrada.');
  return linhasWorksheetXlsx_(
    worksheet.getDataAsString('UTF-8'),
    lerSharedStringsXlsx_(partes['xl/sharedStrings.xml']),
    formatosDeDataXlsx_(partes['xl/styles.xml'])
  );
}
