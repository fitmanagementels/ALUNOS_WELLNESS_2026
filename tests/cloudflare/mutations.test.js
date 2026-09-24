const test = require('node:test');
const assert = require('node:assert/strict');

function fakeDb() {
  const statements = [];
  return {
    statements,
    prepare(sql) {
      return {
        bind(...values) {
          statements.push({ sql, values });
          return {
            first: async () => {
              if (/FROM mutation_log/i.test(sql)) return null;
              if (/FROM students/i.test(sql)) return { student_id: '42', name: 'ALUNO TESTE', status: 'Ativo' };
              return null;
            },
            all: async () => ({ results: /profile_catalog/i.test(sql) ? [
              { type: 'professor', group_key: 'matriculados', catalog_key: 'elohim', title: 'Elohim', active: 1 },
              { type: 'professor', group_key: 'matriculados', catalog_key: 'ruan', title: 'Ruan', active: 1 },
              { type: 'perfil_pagamento', group_key: 'global', catalog_key: 'bom_pagador', title: 'Bom pagador', active: 1 },
              { type: 'etiqueta', group_key: 'publico', catalog_key: 'performance', title: 'Performance', active: 1 },
              { type: 'etiqueta', group_key: 'comercial', catalog_key: 'coach', title: 'Coach', active: 1 }
            ] : [] })
          };
        }
      };
    },
    batch: async (batch) => { statements.push({ batch }); return []; }
  };
}

test('salva perfil com múltiplos últimos professores, Coach e Performance de forma idempotente', async () => {
  const { saveMutations } = await import('../../worker/src/services/mutation-service.js');
  const db = fakeDb();
  const result = await saveMutations(db, { email: 'fitmanagement.els@gmail.com' }, {
    requestId: 'request-profile-42',
    patches: [{ tipo: 'perfilAluno', valores: {
      id: '42', aluno: 'ALUNO TESTE', professorResponsavel: 'Elohim', ultimosProfessores: ['Elohim', 'Ruan'],
      perfilPagamento: 'Bom pagador', etiquetasPublico: ['Performance'], etiquetasComerciais: ['Coach'],
      observacaoPagamento: 'Em dia', observacoesGerais: 'Prefere manhã'
    } }]
  }, { now: () => '2026-09-24T12:00:00.000Z' });
  assert.equal(result.idempotente, false);
  assert.equal(result.requestId, 'request-profile-42');
  const serialized = JSON.stringify(db.statements);
  assert.match(serialized, /student_profiles/);
  assert.match(serialized, /student_last_teachers/);
  assert.match(serialized, /publico:performance/);
  assert.match(serialized, /comercial:coach/);
  assert.match(serialized, /mutation_log/);
});

test('rejeita etiquetas e professores que não pertencem ao catálogo', async () => {
  const { saveMutations } = await import('../../worker/src/services/mutation-service.js');
  await assert.rejects(() => saveMutations(fakeDb(), { email: 'fitmanagement.els@gmail.com' }, {
    requestId: 'request-invalid',
    patches: [{ tipo: 'perfilAluno', valores: {
      id: '42', aluno: 'ALUNO TESTE', professorResponsavel: 'Outro', ultimosProfessores: [],
      perfilPagamento: 'Bom pagador', etiquetasPublico: [], etiquetasComerciais: []
    } }]
  }), /Professor responsável inválido/);
});

test('retorna resultado já gravado sem repetir gravação', async () => {
  const { saveMutations } = await import('../../worker/src/services/mutation-service.js');
  const db = fakeDb();
  const originalPrepare = db.prepare;
  db.prepare = (sql) => {
    const statement = originalPrepare(sql);
    if (/FROM mutation_log/i.test(sql)) {
      statement.bind = (...values) => ({ first: async () => ({ result_json: JSON.stringify({ requestId: values[0], idempotente: false, versao: 'v1' }) }) });
    }
    return statement;
  };
  const result = await saveMutations(db, { email: 'fitmanagement.els@gmail.com' }, { requestId: 'already-done', patches: [{ tipo: 'configDashboard', valores: {} }] });
  assert.deepEqual(result, { requestId: 'already-done', idempotente: true, versao: 'v1' });
  assert.equal(db.statements.some((entry) => entry.batch), false);
});
