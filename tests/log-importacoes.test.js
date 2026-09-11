const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

function createSheet() {
  const writes = [];
  return {
    writes,
    getLastRow: () => 1,
    getRange(row, column, rows = 1, columns = 1) {
      return {
        setValues(values) { writes.push({ row, column, rows, columns, values }); return this; },
        setValue(value) { writes.push({ row, column, rows, columns, values: [[value]] }); return this; }
      };
    }
  };
}

test('registra uma linha PROCESSANDO por arquivo e atualiza as mesmas linhas', () => {
  const sheet = createSheet();
  const gas = loadGas(['apps-script/00_Config.gs', 'apps-script/06_LogImportacoes.gs'], {
    SpreadsheetApp: { flush: () => {} }
  });
  const arquivos = ['vencimentos', 'fichas', 'avaliacao_fisica', 'permanencia'].map((tipo, index) => ({
    tipo, nome: `${tipo}_2026-07-08_r01.xls`, id: String(index + 1), dataReferencia: '2026-07-08', revisao: '01'
  }));
  const refs = gas.iniciarLogImportacao(sheet, arquivos, 'exec-1', new Date('2026-07-10T12:00:00Z'));
  assert.deepEqual(refs.map(item => item.linha), [2, 3, 4, 5]);
  assert.equal(sheet.writes[0].values.length, 4);
  assert.equal(sheet.writes[0].values[0][11], 'PROCESSANDO');

  gas.finalizarLogImportacao(sheet, refs, {
    status: 'SUCESSO', mensagem: 'Base atualizada', contagens: {
      vencimentos: { lidas: 3, validas: 3, rejeitadas: 0 },
      fichas: { lidas: 2, validas: 2, rejeitadas: 0 },
      avaliacao_fisica: { lidas: 2, validas: 2, rejeitadas: 0 },
      permanencia: { lidas: 2, validas: 2, rejeitadas: 0 }
    }
  }, new Date('2026-07-10T12:01:00Z'));
  const finalWrite = sheet.writes.find(write => write.column === 9);
  assert.deepEqual(
    JSON.parse(JSON.stringify(finalWrite.values[0])),
    [3, 3, 0, 'SUCESSO', 'Base atualizada']
  );
});

test('recusa data e revisão já registradas', () => {
  const gas = loadGas(['apps-script/06_LogImportacoes.gs'], {
    obterAbaImportacoes_: () => ({
      getDataRange: () => ({
        getDisplayValues: () => [
          ['execucao_id', '', '', '', '', '', 'data_referencia', 'revisao'],
          ['exec-old', '', '', '', '', '', '2026-07-08', 'r01']
        ]
      })
    })
  });
  assert.throws(
    () => gas.verificarLoteJaRegistrado({ dataReferencia: '2026-07-08', revisao: '01' }),
    /revisão superior/
  );
});

test('retorna a última importação bem-sucedida', () => {
  const gas = loadGas(['apps-script/06_LogImportacoes.gs'], {
    obterAbaImportacoes_: () => ({
      getDataRange: () => ({
        getDisplayValues: () => [
          ['execucao_id', '', 'data_hora_fim', '', '', '', 'data_referencia', 'revisao', '', '', '', 'status'],
          ['exec-1', '', '10/07/2026 10:00', '', '', '', '2026-07-07', 'r01', '', '', '', 'SUCESSO'],
          ['exec-2', '', '10/07/2026 11:00', '', '', '', '2026-07-08', 'r01', '', '', '', 'SUCESSO']
        ]
      })
    })
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(gas.obterUltimaImportacaoBemSucedida())),
    { execucaoId: 'exec-2', concluidaEm: '10/07/2026 11:00', dataReferencia: '2026-07-08', revisao: 'r01' }
  );
});
