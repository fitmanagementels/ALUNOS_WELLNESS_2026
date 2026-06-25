function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("XS Tools")
    .addItem("Atualizar Dados e Agenda", "atualizarTudo")
    .addSeparator()
    .addItem("Atualizar apenas aba Dados", "atualizarAbaDados")
    .addItem("Atualizar apenas aba AGENDA", "atualizarAbaAgenda")
    .addSeparator()
    .addItem("Abrir Gestão de Agenda", "abrirGestaoAgenda")
    .addToUi();
}

function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("XSTEAM | Gestão de Agenda")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover");
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function abrirGestaoAgenda() {
  const html = HtmlService.createHtmlOutput(
    '<p style="font-family:Arial,sans-serif">Publique este projeto como Web App para usar a Gestão de Agenda como PWA.</p>',
  )
    .setWidth(420)
    .setHeight(120);
  SpreadsheetApp.getUi().showModalDialog(html, "Gestão de Agenda");
}

function getAgendaAppData() {
  const values = getAgendaValues_();
  const data = AgendaCore.buildAgendaAppDataFromValues(values);
  data.brand = {
    logoDataUri: getBrandLogoDataUri_(),
    name: "XSTEAM",
  };
  return data;
}

function saveAgendaStudent(payload) {
  payload = payload || {};
  const studentId = AgendaCore.cleanText(payload.id);

  if (!studentId) {
    throw new Error("ID do aluno é obrigatório para salvar.");
  }

  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);

  try {
    const sheet = getAgendaSheet_();
    const values = sheet.getDataRange().getValues();

    if (values.length < 1) {
      throw new Error('A aba "AGENDA" está vazia.');
    }

    const headerIndex = AgendaCore.createHeaderIndex(values[0]);
    const idColumnIndex = headerIndex[AgendaCore.headerKey("ID")];
    let targetRowNumber = 0;

    for (let i = 1; i < values.length; i++) {
      if (AgendaCore.cleanText(values[i][idColumnIndex]) === studentId) {
        targetRowNumber = i + 1;
        break;
      }
    }

    if (!targetRowNumber) {
      throw new Error("Aluno não encontrado na AGENDA: " + studentId);
    }

    const updates = AgendaCore.buildManualUpdatesFromPayload(payload);

    updates.forEach(function (update) {
      const columnIndex = headerIndex[AgendaCore.headerKey(update.header)];
      sheet.getRange(targetRowNumber, columnIndex + 1).setValue(update.value);
    });

    SpreadsheetApp.flush();
    return getAgendaAppData();
  } finally {
    lock.releaseLock();
  }
}

function getAgendaSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("AGENDA");

  if (!sheet) {
    throw new Error('A aba "AGENDA" não foi encontrada.');
  }

  return sheet;
}

function getAgendaValues_() {
  const sheet = getAgendaSheet_();
  return sheet.getDataRange().getValues();
}

function getBrandLogoDataUri_() {
  try {
    return include("LogoDataUri").trim();
  } catch (error) {
    return "";
  }
}

function atualizarTudo() {
  atualizarAbaDados(false);
  atualizarAbaAgenda(false);

  SpreadsheetApp.getUi().alert(
    'As abas "Dados" e "AGENDA" foram atualizadas com sucesso.',
  );
}

function atualizarAbaDados(mostrarAlerta = true) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaBase = ss.getSheetByName("Base");
  let abaDados = ss.getSheetByName("Dados");

  if (!abaBase) {
    SpreadsheetApp.getUi().alert('A aba "Base" não foi encontrada.');
    return;
  }

  if (!abaDados) {
    abaDados = ss.insertSheet("Dados");
  }

  const dados = abaBase.getDataRange().getValues();

  if (dados.length < 2) {
    SpreadsheetApp.getUi().alert('A aba "Base" não possui dados suficientes.');
    return;
  }

  // Colunas desejadas da aba Base:
  // A até D, F até L, N e R
  const colunasSelecionadas = [
    0,
    1,
    2,
    3, // A:D
    5,
    6,
    7,
    8,
    9,
    10,
    11, // F:L
    13, // N
    17, // R
  ];

  const cabecalho = colunasSelecionadas.map((i) => dados[0][i]);
  const mapaAlunos = {};

  for (let i = 1; i < dados.length; i++) {
    const linha = dados[i];

    const mesReferencia = linha[0]; // Coluna A da Base
    const idAluno = linha[1]; // Coluna B da Base
    const polo = linha[11]; // Coluna L da Base

    if (!idAluno) continue;
    if (String(polo).trim().toUpperCase() !== "XSTEAM WELLNESS CLUB") continue;

    const dataReferencia = converterMesParaData(mesReferencia);

    if (!mapaAlunos[idAluno]) {
      mapaAlunos[idAluno] = {
        data: dataReferencia,
        linha: linha,
      };
    } else if (dataReferencia >= mapaAlunos[idAluno].data) {
      mapaAlunos[idAluno] = {
        data: dataReferencia,
        linha: linha,
      };
    }
  }

  const resultado = Object.values(mapaAlunos)
    .sort((a, b) => b.data - a.data)
    .map((item) => colunasSelecionadas.map((i) => item.linha[i]));

  abaDados.clearContents();

  abaDados.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);

  if (resultado.length > 0) {
    abaDados
      .getRange(2, 1, resultado.length, cabecalho.length)
      .setValues(resultado);
  }

  abaDados.autoResizeColumns(1, cabecalho.length);

  if (mostrarAlerta) {
    SpreadsheetApp.getUi().alert(
      `A aba "Dados" foi atualizada com ${resultado.length} alunos únicos da XSTEAM WELLNESS CLUB.`,
    );
  }
}

function atualizarAbaAgenda(mostrarAlerta = true) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaDados = ss.getSheetByName("Dados");
  let abaAgenda = ss.getSheetByName("AGENDA");

  if (!abaDados) {
    SpreadsheetApp.getUi().alert('A aba "Dados" não foi encontrada.');
    return;
  }

  if (!abaAgenda) {
    abaAgenda = ss.insertSheet("AGENDA");
  }

  const dados = abaDados.getDataRange().getValues();

  if (dados.length < 2) {
    if (mostrarAlerta) {
      SpreadsheetApp.getUi().alert(
        'A aba "Dados" não possui alunos para enviar para a AGENDA.',
      );
    }
    return;
  }

  const cabecalhoAgenda = [
    "ID",
    "Nome",
    "Dias",
    "Status",

    "Prof1",
    "Dia1",
    "Hora1",

    "Prof2",
    "Dia2",
    "Hora2",

    "Prof3",
    "Dia3",
    "Hora3",

    "Prof4",
    "Dia4",
    "Hora4",

    "Prof5",
    "Dia5",
    "Hora5",

    "Prof6",
    "Dia6",
    "Hora6",

    "Observações",
  ];

  const agendaAtual = abaAgenda.getDataRange().getValues();
  const dadosManuaisPorId = {};

  // Preserva dados manuais da coluna D em diante, usando o ID como chave
  for (let i = 1; i < agendaAtual.length; i++) {
    const linhaAgenda = agendaAtual[i];
    const id = linhaAgenda[0];

    if (!id) continue;

    dadosManuaisPorId[id] = linhaAgenda.slice(3);
  }

  const novaAgenda = [cabecalhoAgenda];

  for (let i = 1; i < dados.length; i++) {
    const linhaDados = dados[i];

    const id = linhaDados[1]; // Coluna B da aba Dados
    const nome = linhaDados[2]; // Coluna C da aba Dados
    const dias = linhaDados[9]; // Coluna J da aba Dados

    if (!id) continue;

    let dadosManuais = dadosManuaisPorId[id] || [];

    // Garante que os dados manuais tenham o tamanho exato das colunas D até W
    const quantidadeColunasManuais = cabecalhoAgenda.length - 3;

    if (dadosManuais.length < quantidadeColunasManuais) {
      dadosManuais = dadosManuais.concat(
        Array(quantidadeColunasManuais - dadosManuais.length).fill(""),
      );
    }

    if (dadosManuais.length > quantidadeColunasManuais) {
      dadosManuais = dadosManuais.slice(0, quantidadeColunasManuais);
    }

    novaAgenda.push([id, nome, dias, ...dadosManuais]);
  }

  abaAgenda.clearContents();

  abaAgenda
    .getRange(1, 1, novaAgenda.length, cabecalhoAgenda.length)
    .setValues(novaAgenda);

  abaAgenda.setFrozenRows(1);
  abaAgenda.autoResizeColumns(1, cabecalhoAgenda.length);

  if (mostrarAlerta) {
    SpreadsheetApp.getUi().alert(
      `A aba "AGENDA" foi atualizada com ${novaAgenda.length - 1} alunos. Os dados manuais foram preservados pelo ID.`,
    );
  }
}

function converterMesParaData(valor) {
  if (valor instanceof Date) {
    return new Date(valor.getFullYear(), valor.getMonth(), 1);
  }

  const texto = String(valor).trim().toLowerCase();

  const meses = {
    janeiro: 0,
    fevereiro: 1,
    março: 2,
    marco: 2,
    abril: 3,
    maio: 4,
    junho: 5,
    julho: 6,
    agosto: 7,
    setembro: 8,
    outubro: 9,
    novembro: 10,
    dezembro: 11,
  };

  for (const mes in meses) {
    if (texto.includes(mes)) {
      const anoEncontrado = texto.match(/\d{4}/);
      const ano = anoEncontrado ? Number(anoEncontrado[0]) : 1900;
      return new Date(ano, meses[mes], 1);
    }
  }

  const dataTentativa = new Date(valor);

  if (!isNaN(dataTentativa.getTime())) {
    return new Date(dataTentativa.getFullYear(), dataTentativa.getMonth(), 1);
  }

  return new Date(1900, 0, 1);
}