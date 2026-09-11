const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGas } = require('./helpers/load-gas');

const gas = loadGas(['apps-script/01_Normalizacao.gs']);

test('converte valor brasileiro em número', () => {
  assert.equal(gas.parseValorBr('1.234,56'), 1234.56);
});

test('valida e formata data brasileira', () => {
  assert.equal(gas.formatarDataIso(gas.parseDataBr('08/06/2026')), '2026-06-08');
  assert.throws(() => gas.parseDataBr('31/02/2026'), /Data inválida/);
});

test('separa frequência e polo sem perder o contrato integral', () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(gas.separarContrato('2X - GREENLIFE CT - PERSONAL (2025)'))),
    { frequencia: '2X', polo: 'GREENLIFE CT' }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(gas.separarContrato('CONSULTORIA EM CORRIDA'))),
    { frequencia: '', polo: '' }
  );
});

test('cria chave técnica estável', () => {
  const data = gas.parseDataBr('08/06/2026');
  assert.equal(
    gas.criarChaveContrato('2321', '2X - GREENLIFE CT - PERSONAL (2025)', data),
    '2321|2X-GREENLIFE-CT-PERSONAL-2025|2026-06-08'
  );
});
