const test = require('node:test');
const assert = require('node:assert/strict');

function fakeDb(rowsByTable) {
  return {
    prepare(sql) {
      const table = /FROM\s+([a-z_]+)/i.exec(sql)[1];
      return { all: async () => ({ results: rowsByTable[table] || [] }) };
    }
  };
}

test('bootstrap D1 preserva o contrato consumido pelo PWA', async () => {
  const { buildBootstrap } = await import('../../worker/src/services/bootstrap-service.js');
  const response = await buildBootstrap(fakeDb({
    data_versions: [{ version_id: 7, reference_date: '2026-09-24', revision: 2, activated_at: '2026-09-24T10:00:00Z' }],
    students: [{ student_id: '42', name: 'ALUNO TESTE', phone: '85999999999', status: 'Ativo', plan_started_on: '2026-01-01', prescription_on: '2026-09-01', assessment_on: '2026-09-02' }],
    contracts: [{ contract_key: 'c42', student_id: '42', full_name: '2X WELLNESS', frequency: '2X', value_cents: 76500, current_started_on: '2026-01-01', expires_on: '2026-10-01', contract_status: 'Ativo', location: 'XSTEAM WELLNESS CLUB', modality: 'MUSCULAÇÃO' }],
    permanence: [], permanence_events: [],
    student_profiles: [{ student_id: '42', responsible_teacher: 'Elohim', payment_profile: 'Bom pagador', payment_notes: 'Em dia', general_notes: 'Prefere manhã', updated_at: '2026-09-24T10:00:00Z' }],
    student_last_teachers: [{ student_id: '42', teacher_name: 'Ruan', position: 1 }],
    student_tags: [{ student_id: '42', group_key: 'publico', title: 'Performance' }, { student_id: '42', group_key: 'comercial', title: 'Coach' }],
    profile_catalog: [{ type: 'etiqueta', group_key: 'comercial', catalog_key: 'coach', title: 'Coach', active: 1, position: 40 }],
    leads: [], churns: [], settings: []
  }));

  assert.equal(response.versao, 'importacao:7|config:7|fluxo:7');
  assert.deepEqual(response.alunos[0], {
    id: '42', aluno: 'ALUNO TESTE', contato: '85999999999', status: 'Ativo',
    inicioPlano: '2026-01-01', dataFicha: '2026-09-01', dataAvaliacao: '2026-09-02'
  });
  assert.equal(response.contratos[0].valor, 765);
  assert.deepEqual(response.perfisAlunos[0], {
    id: '42', aluno: 'ALUNO TESTE', professorResponsavel: 'Elohim', ultimosProfessores: ['Ruan'],
    perfilPagamento: 'Bom pagador', observacaoPagamento: 'Em dia', etiquetasPublico: ['Performance'],
    etiquetasComerciais: ['Coach'], observacoesGerais: 'Prefere manhã', atualizadoEm: '2026-09-24T10:00:00Z'
  });
  assert.equal(response.catalogoPerfisAlunos[0].titulo, 'Coach');
  assert.deepEqual(response.fluxo, { leads: [], churns: [] });
});
