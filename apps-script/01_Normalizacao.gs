function normalizarId(valor) {
  var id = String(valor == null ? '' : valor).trim().replace(/\.0$/, '');
  if (id && !/^\d+$/.test(id)) {
    throw new Error('ID inválido: ' + valor);
  }
  return id;
}

function parseDataBr(valor) {
  if (valor && typeof valor.getTime === 'function' && !isNaN(valor.getTime())) {
    return new Date(valor.getTime());
  }

  var texto = String(valor == null ? '' : valor).trim();
  if (!texto) return '';

  var partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!partes) throw new Error('Data inválida: ' + texto);

  var dia = Number(partes[1]);
  var mes = Number(partes[2]);
  var ano = Number(partes[3]);
  var data = new Date(ano, mes - 1, dia, 12, 0, 0, 0);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    throw new Error('Data inválida: ' + texto);
  }
  return data;
}

function formatarDataIso(data) {
  if (!(data instanceof Date) || isNaN(data.getTime())) return '';
  return [
    String(data.getFullYear()).padStart(4, '0'),
    String(data.getMonth() + 1).padStart(2, '0'),
    String(data.getDate()).padStart(2, '0')
  ].join('-');
}

function parseValorBr(valor) {
  var original = String(valor == null ? '' : valor).trim();
  if (!original) throw new Error('Valor inválido: vazio');

  var normalizado = original
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) {
    throw new Error('Valor inválido: ' + original);
  }

  var numero = Number(normalizado);
  if (!isFinite(numero)) throw new Error('Valor inválido: ' + original);
  return numero;
}

function normalizarSegmentoChave(valor) {
  return String(valor == null ? '' : valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function separarContrato(contratoCompleto) {
  var partes = String(contratoCompleto == null ? '' : contratoCompleto)
    .trim()
    .split(/\s+-\s+/);
  if (partes.length < 2) return { frequencia: '', polo: '' };
  return { frequencia: partes[0].trim(), polo: partes[1].trim() };
}

function criarChaveContrato(id, contratoCompleto, inicioCorrente) {
  var idNormalizado = normalizarId(id);
  var contratoNormalizado = normalizarSegmentoChave(contratoCompleto);
  var inicioIso = formatarDataIso(inicioCorrente);
  if (!idNormalizado || !contratoNormalizado || !inicioIso) {
    throw new Error('Não foi possível criar a chave do contrato.');
  }
  return idNormalizado + '|' + contratoNormalizado + '|' + inicioIso;
}
