import { readDashboard } from '../repositories/dashboard-repository.js';

function toNumber(value) { return Number.isFinite(Number(value)) ? Number(value) : 0; }
function brDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
}
function readJson(value, fallback) { try { return JSON.parse(value || ''); } catch (_) { return fallback; } }
function mapSettings(rows) {
  const filters = rows.find((row) => row.setting_type === 'dashboard' && row.setting_key === 'filtros');
  const filterValues = readJson(filters && filters.value_json, {});
  const homeCards = rows.filter((row) => row.setting_type === 'home_card').map((row) => ({ chave: row.setting_key, ativo: Boolean(row.active), ordem: toNumber(row.position), titulo: row.title || row.setting_key, estados: readJson(row.states_json, []) }));
  const alerts = {};
  rows.filter((row) => row.setting_type === 'alertas').forEach((row) => { alerts[row.setting_key] = readJson(row.value_json, {}); });
  return { filters: filterValues, homeCards, alerts };
}
function mapFlow(data) {
  return {
    leads: data.leads.map((row) => ({ id: row.lead_id, nome: row.name, telefone: row.phone, origem: row.origin, indicacao: row.referral, primeiroContato: brDate(row.first_contact_on), experimental: brDate(row.trial_on), professorExperimental: row.trial_teacher, entradaComoCliente: brDate(row.became_customer_on), status: row.status, planoContratado: row.contracted_plan, valorPacote: toNumber(row.package_value_cents) / 100, minirrelatorioVenda: row.sales_report })),
    churns: data.churns.map((row) => ({ id: row.churn_id, alunoId: row.student_id, nome: row.official_name, telefone: row.official_phone, dataSaida: brDate(row.official_exit_on), profissionalResponsavel: row.responsible_professional, ultimoPersonal: row.last_teacher, motivoSaida: row.manual_exit_reason, sinaisContexto: row.manual_context, acaoRetencao: row.manual_retention_action })),
    novos: data.newStudents.map((row) => ({ id: row.entry_id, alunoId: row.student_id, nome: row.official_name, telefone: row.official_phone, dataEntrada: brDate(row.official_entry_on), contrato: row.official_contract, valor: toNumber(row.official_value_cents) / 100 }))
  };
}

function mapProfiles(profiles, lastTeachers, studentTags, students) {
  const teachers = new Map();
  const tags = new Map();
  const names = new Map((students || []).map((student) => [String(student.student_id), student.name || '']));
  lastTeachers.forEach((row) => {
    const list = teachers.get(row.student_id) || [];
    list.push(row.teacher_name);
    teachers.set(row.student_id, list);
  });
  studentTags.forEach((row) => {
    const value = tags.get(row.student_id) || { publico: [], comercial: [] };
    if (row.group_key === 'publico' || row.group_key === 'comercial') value[row.group_key].push(row.title);
    tags.set(row.student_id, value);
  });
  return profiles.map((row) => ({
    id: String(row.student_id), aluno: names.get(String(row.student_id)) || '', professorResponsavel: row.responsible_teacher || '',
    ultimosProfessores: teachers.get(row.student_id) || [], perfilPagamento: row.payment_profile || 'Sem histórico',
    observacaoPagamento: row.payment_notes || '', etiquetasPublico: (tags.get(row.student_id) || {}).publico || [], etiquetasComerciais: (tags.get(row.student_id) || {}).comercial || [],
    observacoesGerais: row.general_notes || '', atualizadoEm: row.updated_at || ''
  }));
}

export async function buildBootstrap(db) {
  const data = await readDashboard(db);
  const version = data.versions[0] || {};
  const versionId = version.version_id || 0;
  const mutation = data.mutations[0] || {};
  const settings = mapSettings(data.settings);
  return {
    versao: `importacao:${versionId}|config:${mutation.created_at || versionId}|fluxo:${mutation.created_at || versionId}`,
    atualizadoEm: version.activated_at || '',
    filtrosPadrao: { status: settings.filters.status || 'Matriculados', polo: settings.filters.polo || 'XSTEAM WELLNESS CLUB' },
    configuracao: { homeCards: settings.homeCards, alertas: settings.alerts, perfisPagamento: [], opcoesPerfilPagamento: [] },
    alunos: data.students.map((row) => ({
      id: String(row.student_id), aluno: row.name, contato: row.phone || '', status: row.status || '',
      inicioPlano: row.plan_started_on || '', dataFicha: row.prescription_on || '', dataAvaliacao: row.assessment_on || ''
    })),
    contratos: data.contracts.map((row) => ({
      chaveContrato: row.contract_key, id: String(row.student_id), contratoCompleto: row.full_name || '',
      contrato_x_sem: row.frequency || '', frequencia: row.frequency || '', valor: toNumber(row.value_cents) / 100,
      inicioCorrente: row.current_started_on || '', vencimento: row.expires_on || '',
      statusContrato: row.contract_status || '', polo: row.location || '', modalidade: row.modality || ''
    })),
    permanencia: data.permanence.map((row) => ({
      id: String(row.student_id), clienteDesde: row.customer_since || '', status: row.permanence_status || '',
      continuidadeMesesOrigem: row.source_continuity_months, quantidadeContratos: row.source_contract_count,
      primeiraObservacaoEm: row.first_seen_on || '', ultimaObservacaoEm: row.last_seen_on || '',
      presenteUltimoLote: Boolean(row.present_in_latest_batch)
    })),
    eventosPermanencia: data.events.map((row) => ({
      eventoId: row.event_id, id: String(row.student_id), dataReferencia: row.reference_date,
      tipoEvento: row.event_type, campo: row.field_name, valorAnterior: row.previous_value,
      valorNovo: row.new_value, registradoEm: row.recorded_at
    })),
    perfisAlunos: mapProfiles(data.profiles, data.lastTeachers, data.studentTags, data.students),
    catalogoPerfisAlunos: data.catalog.map((row) => ({
      tipo: row.type, grupo: row.group_key, chave: row.catalog_key, titulo: row.title,
      ativo: Boolean(row.active), ordem: toNumber(row.position)
    })),
    fluxo: mapFlow(data)
  };
}
