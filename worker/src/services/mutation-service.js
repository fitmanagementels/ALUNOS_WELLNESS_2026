import { commitMutation, findMutation, statement } from '../repositories/mutation-repository.js';

const MAX_PATCHES = 20;
const FLOW_LEAD_STATUS = new Set(['Novo', 'Em contato', 'Esfriando', 'Experimental agendado', 'Experimental realizado', 'Convertido', 'Perdido']);
const FLOW_LEAD_PLANS = new Set(['', 'Pacote 5x', 'Pacote 10x', '1x/sem', '2x/sem', '3x/sem', '4x/sem', '5x/sem', '6x/sem']);

function invalid(message) { throw Object.assign(new Error(message), { code: 'VALIDATION_ERROR' }); }
function text(value, limit = 500) { return String(value == null ? '' : value).trim().slice(0, limit); }
function truthy(value) { return value === true || String(value).toLowerCase() === 'true'; }
function todayIso(now) { return now().slice(0, 10); }
function dateIso(value) {
  const source = text(value, 20);
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(source);
  if (!match) return '';
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== iso ? '' : iso;
}
function cents(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) invalid('Valor inválido.');
  return Math.round(number * 100);
}
function teacherGroup(status) { return /cancel/i.test(String(status || '')) ? 'cancelados' : 'matriculados'; }
function list(values, allowed, label) {
  if (!Array.isArray(values)) invalid(`${label} inválido.`);
  const seen = new Set();
  return values.map((value) => text(value, 80)).filter((value) => {
    if (!value || seen.has(value)) return false;
    if (!allowed.has(value)) invalid(`${label} inválido.`);
    seen.add(value);
    return true;
  });
}
function catalogIndex(rows) {
  const index = new Map();
  rows.filter((row) => Number(row.active) === 1).forEach((row) => {
    index.set(`${row.type}|${row.group_key}|${row.title}`, row.catalog_key);
  });
  return index;
}
function catalogTitles(index, type, group) {
  return new Set([...index.keys()].filter((key) => key.startsWith(`${type}|${group}|`)).map((key) => key.split('|')[2]));
}
async function profileStatements(db, values, actor, now) {
  const id = text(values.id, 100);
  const student = id && await db.prepare('SELECT student_id, name, status FROM students WHERE student_id = ?').bind(id).first();
  if (!id || !student || !text(values.aluno, 200)) invalid('Aluno inválido.');
  const catalogRows = (await db.prepare('SELECT type, group_key, catalog_key, title, active FROM profile_catalog').bind().all()).results || [];
  const catalog = catalogIndex(catalogRows);
  const professorAllowed = catalogTitles(catalog, 'professor', teacherGroup(student.status));
  const responsible = text(values.professorResponsavel, 120);
  if (responsible && !professorAllowed.has(responsible)) invalid('Professor responsável inválido.');
  const lastTeachers = list(values.ultimosProfessores || [], professorAllowed, 'Último professor');
  const paymentProfiles = catalogTitles(catalog, 'perfil_pagamento', 'global');
  const payment = text(values.perfilPagamento || 'Sem histórico', 100);
  if (!paymentProfiles.has(payment)) invalid('Perfil de pagamento inválido.');
  const publicTags = list(values.etiquetasPublico || [], catalogTitles(catalog, 'etiqueta', 'publico'), 'Etiqueta de Público');
  const commercialTags = list(values.etiquetasComerciais || [], catalogTitles(catalog, 'etiqueta', 'comercial'), 'Etiqueta Comercial');
  const timestamp = now();
  const commands = [
    statement(db, `INSERT INTO student_profiles(student_id, responsible_teacher, payment_profile, payment_notes, general_notes, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id) DO UPDATE SET responsible_teacher=excluded.responsible_teacher, payment_profile=excluded.payment_profile,
      payment_notes=excluded.payment_notes, general_notes=excluded.general_notes, updated_at=excluded.updated_at, updated_by=excluded.updated_by`,
    id, responsible, payment, text(values.observacaoPagamento, 1000), text(values.observacoesGerais, 3000), timestamp, actor.email),
    statement(db, 'DELETE FROM student_last_teachers WHERE student_id = ?', id),
    statement(db, 'DELETE FROM student_tags WHERE student_id = ?', id)
  ];
  lastTeachers.forEach((name, position) => commands.push(statement(db,
    'INSERT INTO student_last_teachers(student_id, teacher_name, position) VALUES (?, ?, ?)', id, name, position + 1)));
  publicTags.forEach((title) => commands.push(statement(db,
    'INSERT INTO student_tags(student_id, tag_key) VALUES (?, ?)', id, `publico:${catalog.get(`etiqueta|publico|${title}`)}`)));
  commercialTags.forEach((title) => commands.push(statement(db,
    'INSERT INTO student_tags(student_id, tag_key) VALUES (?, ?)', id, `comercial:${catalog.get(`etiqueta|comercial|${title}`)}`)));
  return commands;
}
function leadStatements(db, values, now) {
  const id = text(values.id, 120);
  const name = text(values.nome, 200);
  const phone = text(values.telefone, 60);
  const firstContact = dateIso(values.primeiroContato);
  const status = text(values.status, 80);
  const trial = values.experimental ? dateIso(values.experimental) : null;
  const entry = values.entradaComoCliente ? dateIso(values.entradaComoCliente) : null;
  const plan = text(values.planoContratado, 80);
  if (!id || !name || !phone || !firstContact || !FLOW_LEAD_STATUS.has(status) || (values.experimental && !trial) || (values.entradaComoCliente && !entry) || !FLOW_LEAD_PLANS.has(plan)) invalid('Lead inválido.');
  const timestamp = now();
  return statement(db, `INSERT INTO leads(lead_id, name, phone, origin, referral, first_contact_on, trial_on, trial_teacher, became_customer_on, status, contracted_plan, package_value_cents, sales_report, created_at, updated_at, archived_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(lead_id) DO UPDATE SET name=excluded.name, phone=excluded.phone, origin=excluded.origin, referral=excluded.referral,
    first_contact_on=excluded.first_contact_on, trial_on=excluded.trial_on, trial_teacher=excluded.trial_teacher, became_customer_on=excluded.became_customer_on,
    status=excluded.status, contracted_plan=excluded.contracted_plan, package_value_cents=excluded.package_value_cents, sales_report=excluded.sales_report, updated_at=excluded.updated_at, archived_at=NULL`,
  id, name, phone, text(values.origem, 160), text(values.indicacao, 300), firstContact, trial, text(values.professorExperimental, 200), entry, status, plan, cents(values.valorPacote), text(values.minirrelatorioVenda, 3000), timestamp, timestamp);
}
function churnStatements(db, values, now) {
  const id = text(values.id, 120), studentId = text(values.alunoId, 100), name = text(values.nome, 200), exit = dateIso(values.dataSaida);
  if (!id || !studentId || !name || !exit) invalid('Churn inválido.');
  const timestamp = now();
  return statement(db, `INSERT INTO churns(churn_id, student_id, official_name, official_phone, official_exit_on, responsible_professional, last_teacher, manual_exit_reason, manual_context, manual_retention_action, created_at, updated_at, archived_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(churn_id) DO UPDATE SET student_id=excluded.student_id, official_name=excluded.official_name, official_phone=excluded.official_phone,
    official_exit_on=excluded.official_exit_on, responsible_professional=excluded.responsible_professional, last_teacher=excluded.last_teacher,
    manual_exit_reason=excluded.manual_exit_reason, manual_context=excluded.manual_context, manual_retention_action=excluded.manual_retention_action, updated_at=excluded.updated_at, archived_at=NULL`,
  id, studentId, name, text(values.telefone, 60), exit, text(values.profissionalResponsavel, 120), text(values.ultimoPersonal, 120), text(values.motivoSaida, 2000), text(values.sinaisContexto, 3000), text(values.acaoRetencao, 3000), timestamp, timestamp);
}
function settingsStatements(db, type, values) {
  const rows = [];
  if (type === 'configDashboard') {
    if (values.filtrosPadrao) {
      const status = text(values.filtrosPadrao.status, 80), polo = text(values.filtrosPadrao.polo, 80);
      if (!status || !polo) invalid('Os filtros padrão são obrigatórios.');
      rows.push(['dashboard', 'filtros', 1, 0, JSON.stringify({ status, polo }), 'Filtros padrão', '[]']);
    }
    if (values.homeCards) {
      if (!Array.isArray(values.homeCards)) invalid('Cartões da Home inválidos.');
      values.homeCards.forEach((card) => rows.push(['home_card', text(card.chave, 80), truthy(card.ativo) ? 1 : 0, Number(card.ordem) || 0, '{}', text(card.titulo || card.chave, 120), JSON.stringify(Array.isArray(card.estados) ? card.estados.map((state) => text(state, 80)) : [])]));
    }
  } else if (type === 'configAlertas') {
    ['prescricoes', 'avaliacoes'].forEach((key) => { if (values[key]) rows.push(['alertas', key, 1, key === 'prescricoes' ? 10 : 20, JSON.stringify(values[key]), key === 'prescricoes' ? 'Prescrições' : 'Avaliações', '[]']); });
  }
  return rows.map((row) => statement(db, `INSERT INTO settings(setting_type, setting_key, active, position, value_json, title, states_json) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(setting_type, setting_key) DO UPDATE SET active=excluded.active, position=excluded.position, value_json=excluded.value_json, title=excluded.title, states_json=excluded.states_json`, ...row));
}

export async function saveMutations(db, actor, payload, deps = {}) {
  const now = deps.now || (() => new Date().toISOString());
  const requestId = text(payload && payload.requestId, 120);
  const patches = payload && Array.isArray(payload.patches) ? payload.patches : [];
  if (!requestId || !patches.length || patches.length > MAX_PATCHES || !actor || !text(actor.email, 254)) invalid('Solicitação de configuração inválida.');
  const saved = await findMutation(db, requestId);
  if (saved && saved.result_json) {
    const result = JSON.parse(saved.result_json);
    return { ...result, requestId, idempotente: true };
  }
  const commands = [];
  for (const patch of patches) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) invalid('Alteração inválida.');
    const values = patch.valores && typeof patch.valores === 'object' ? patch.valores : {};
    if (patch.tipo === 'perfilAluno') commands.push(...await profileStatements(db, values, actor, now));
    else if (patch.tipo === 'fluxoLead') commands.push(leadStatements(db, values, now));
    else if (patch.tipo === 'fluxoChurn') commands.push(churnStatements(db, values, now));
    else if (patch.tipo === 'excluirFluxoChurn') {
      const id = text(values.id, 120); if (!id) invalid('Churn inválido.');
      commands.push(statement(db, 'UPDATE churns SET archived_at = ?, updated_at = ? WHERE churn_id = ? AND archived_at IS NULL', now(), now(), id));
    } else if (patch.tipo === 'configDashboard' || patch.tipo === 'configAlertas') commands.push(...settingsStatements(db, patch.tipo, values));
    else if (patch.tipo === 'perfilPagamento') commands.push(...await profileStatements(db, values, actor, now));
    else invalid('Tipo de alteração inválido.');
  }
  const result = { requestId, idempotente: false, versao: now() };
  commands.push(statement(db, 'INSERT INTO mutation_log(request_id, actor_email, mutation_type, created_at, result_json) VALUES (?, ?, ?, ?, ?)', requestId, actor.email, 'dashboard_batch', now(), JSON.stringify(result)));
  await commitMutation(db, commands);
  return result;
}
