function decodificarCelulaHtml_(valor) {
  return String(valor == null ? '' : valor)
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, function (_match, codigo) {
      return String.fromCharCode(Number(codigo));
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarCabecalho_(valor) {
  return decodificarCelulaHtml_(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseTabelaHtml(html) {
  var linhasHtml = String(html == null ? '' : html).match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
  return linhasHtml
    .map(function (linhaHtml) {
      var celulasHtml = linhaHtml.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
      return celulasHtml.map(decodificarCelulaHtml_);
    })
    .filter(function (linha) {
      return linha.some(function (celula) { return celula !== ''; });
    });
}

function tabelaParaObjetos(linhas, cabecalhosObrigatorios) {
  var obrigatorios = cabecalhosObrigatorios.map(normalizarCabecalho_);
  var indiceCabecalho = linhas.findIndex(function (linha) {
    var normalizados = linha.map(normalizarCabecalho_);
    return obrigatorios.every(function (cabecalho) {
      return normalizados.indexOf(cabecalho) !== -1;
    });
  });

  if (indiceCabecalho === -1) {
    throw new Error('Cabeçalhos obrigatórios não encontrados: ' + obrigatorios.join(', '));
  }

  var cabecalhos = linhas[indiceCabecalho].map(normalizarCabecalho_);
  var posicoes = {};
  obrigatorios.forEach(function (cabecalho) {
    posicoes[cabecalho] = cabecalhos.indexOf(cabecalho);
  });

  return linhas
    .slice(indiceCabecalho + 1)
    .filter(function (linha) {
      return obrigatorios.some(function (cabecalho) {
        return decodificarCelulaHtml_(linha[posicoes[cabecalho]]) !== '';
      });
    })
    .map(function (linha) {
      var objeto = {};
      obrigatorios.forEach(function (cabecalho) {
        objeto[cabecalho] = decodificarCelulaHtml_(linha[posicoes[cabecalho]]);
      });
      return objeto;
    })
    .filter(function (objeto) {
      var codigo = String(objeto.codigo || '').trim();
      return !/^Total:\s*\d+(?:\s+registros?)?$/i.test(codigo) &&
        !/^Total\s+R\$/i.test(codigo);
    });
}
