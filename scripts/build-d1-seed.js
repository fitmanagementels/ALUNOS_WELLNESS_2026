const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}
function required(name) {
  const value = argument(name);
  if (!value) throw new Error(`Argumento obrigatório ausente: ${name}`);
  return path.resolve(value);
}
function sql(value) {
  if (value && typeof value === 'object' && value.__raw) return value.__raw;
  if (value === null || value === undefined || value === '') return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}
function raw(value) { return { __raw: value }; }
function text(value, limit = 5000) { return String(value == null ? '' : value).trim().slice(0, limit); }
function isoDate(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  const source = text(value, 40);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(source);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(source);
  const parts = br ? [br[3], br[2], br[1]] : iso ? [iso[1], iso[2], iso[3]] : null;
  if (!parts) return '';
  const normalized = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
  const parsed = new Date(`${normalized}T12:00:00Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== normalized ? '' : normalized;
}
function cents(value) {
  if (value === '' || value == null) return null;
  if (typeof value === 'number') return Math.round(value * 100);
  const normalized = text(value).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : null;
}
function bool(value) { return value === true || String(value).toLowerCase() === 'true' ? 1 : 0; }
function list(value) { try { const parsed = JSON.parse(String(value || '[]')); return Array.isArray(parsed) ? parsed.map((item) => text(item, 120)).filter(Boolean) : []; } catch (_) { return []; } }
function sheet(book, name) {
  const page = book.Sheets[name];
  if (!page) return [];
  return XLSX.utils.sheet_to_json(page, { defval: '', raw: true, cellDates: true }).filter((row) => Object.values(row).some((value) => text(value)));
}
function firstSheet(book) { return sheet(book, book.SheetNames[0]); }
function latestByDate(rows, dateKey) {
  const picked = new Map();
  rows.forEach((row) => {
    const id = text(row.Código || row.codigo || row.id, 100);
    if (!id) return;
    const current = picked.get(id);
    const nextDate = isoDate(row[dateKey]);
    if (!current || nextDate >= current.date) picked.set(id, { row, date: nextDate });
  });
  return picked;
}
function tagKey(group, title) {
  const key = text(title, 120).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return key ? `${group}:${key}` : '';
}
const PUBLIC_TAGS = new Set(['idoso', 'saude', 'estetica', 'dores', 'corrida', 'performance']);
const COMMERCIAL_TAGS = new Set(['risco_de_churn', 'sem_fidelizacao', 'elohim', 'coach']);
function supportedTag(title, preferredGroup) {
  const slug = tagKey('', title).replace(/^:/, '');
  if (PUBLIC_TAGS.has(slug)) return { group: 'publico', key: `publico:${slug}` };
  if (COMMERCIAL_TAGS.has(slug)) return { group: 'comercial', key: `comercial:${slug}` };
  return null;
}
function statement(lines, table, columns, values, mode = 'INSERT OR REPLACE') {
  lines.push(`${mode} INTO ${table}(${columns.join(', ')}) VALUES (${values.map(sql).join(', ')});`);
}

function build(masterFile, churnsFile, newStudentsFile, options = {}) {
  const master = XLSX.readFile(masterFile, { cellDates: true });
  const officialChurns = XLSX.readFile(churnsFile, { cellDates: true });
  const officialNew = XLSX.readFile(newStudentsFile, { cellDates: true });
  const students = sheet(master, 'BASE_ALUNOS');
  const contracts = sheet(master, 'CONTRATOS');
  const permanence = sheet(master, 'BASE_PERMANENCIA');
  const events = sheet(master, 'HISTORICO_PERMANENCIA');
  const profiles = sheet(master, 'PERFIS_ALUNOS');
  const leads = sheet(master, 'FLUXO_LEADS');
  const previousChurns = sheet(master, 'FLUXO_CHURNS');
  const dashboardSettings = sheet(master, 'CONFIG_DASHBOARD');
  const alertSettings = sheet(master, 'CONFIG_ALERTAS');
  const imports = sheet(master, 'IMPORTACOES');
  const officialExitById = latestByDate(firstSheet(officialChurns), 'Vencimento');
  const latestImport = imports.map((row) => isoDate(row.data_referencia)).filter(Boolean).sort().at(-1) || new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const studentIds = new Set(students.map((row) => text(row.id, 100)).filter(Boolean));
  const studentPhone = new Map(students.map((row) => [text(row.id, 100), text(row.contato, 60)]));
  const manualChurnById = new Map();
  previousChurns.forEach((row) => { const id = text(row.aluno_id, 100); if (id && text(row.churn_id, 120)) manualChurnById.set(id, row); });
  const lines = [];
  if (options.transaction !== false) lines.push('BEGIN TRANSACTION;');
  lines.push(`INSERT OR IGNORE INTO data_versions(reference_date, revision, status, created_at, activated_at) VALUES (${sql(latestImport)}, 1, 'active', ${sql(now)}, ${sql(now)});`);

  students.forEach((row) => {
    const id = text(row.id, 100); if (!id) return;
    statement(lines, 'students', ['student_id', 'name', 'phone', 'status', 'plan_started_on', 'prescription_on', 'assessment_on', 'source_version_id', 'updated_at'], [id, text(row.aluno, 200), text(row.contato, 60), text(row.status, 80), isoDate(row.inicio_plano), isoDate(row.data_ficha), isoDate(row.data_avaliacao), raw("(SELECT version_id FROM data_versions WHERE status='active')"), now]);
  });
  contracts.forEach((row) => {
    const id = text(row.id, 100), key = text(row._chave_contrato, 160); if (!id || !key || !studentIds.has(id)) return;
    statement(lines, 'contracts', ['contract_key', 'student_id', 'full_name', 'frequency', 'value_cents', 'current_started_on', 'expires_on', 'contract_status', 'location', 'modality', 'source_version_id', 'updated_at'], [key, id, text(row.contrato_completo, 300), text(row.contrato_x_sem, 80), cents(row.valor) || 0, isoDate(row.inicio_corrente), isoDate(row.vencimento), text(row.status_contrato, 80), text(row.polo, 120), text(row.modalidade, 120), raw("(SELECT version_id FROM data_versions WHERE status='active')"), now]);
  });
  permanence.forEach((row) => {
    const id = text(row.id, 100); if (!id || !studentIds.has(id)) return;
    statement(lines, 'permanence', ['student_id', 'customer_since', 'permanence_status', 'source_continuity_months', 'source_contract_count', 'first_seen_on', 'last_seen_on', 'present_in_latest_batch', 'source_version_id'], [id, isoDate(row.cliente_desde), text(row.status_permanencia, 80), Number(row.continuidade_meses_origem) || null, Number(row.quantidade_contratos_origem) || null, isoDate(row.primeira_observacao_em), isoDate(row.ultima_observacao_em), bool(row.presente_ultimo_lote), raw("(SELECT version_id FROM data_versions WHERE status='active')")]);
  });
  events.forEach((row) => {
    const id = text(row.id, 100), eventId = text(row.evento_id, 160), referenceDate = isoDate(row.data_referencia), type = text(row.tipo_evento, 100), field = text(row.campo, 100);
    if (!id || !eventId || !referenceDate || !type || !field || !studentIds.has(id)) return;
    statement(lines, 'permanence_events', ['event_id', 'student_id', 'reference_date', 'event_type', 'field_name', 'previous_value', 'new_value', 'source_version_id', 'recorded_at'], [eventId, id, referenceDate, type, field, text(row.valor_anterior, 500), text(row.valor_novo, 500), raw("(SELECT version_id FROM data_versions WHERE status='active')"), isoDate(row.registrado_em) ? `${isoDate(row.registrado_em)}T12:00:00.000Z` : now]);
  });
  profiles.forEach((row) => {
    const id = text(row.id, 100); if (!id || !studentIds.has(id)) return;
    statement(lines, 'student_profiles', ['student_id', 'responsible_teacher', 'payment_profile', 'payment_notes', 'general_notes', 'updated_at', 'updated_by'], [id, text(row.professor_responsavel, 120), text(row.perfil_pagamento, 100) || 'Sem histórico', text(row.observacao_pagamento, 1000), text(row.observacoes_gerais, 3000), now, 'legacy-migration']);
    list(row.ultimos_professores).forEach((teacher, index) => statement(lines, 'student_last_teachers', ['student_id', 'teacher_name', 'position'], [id, teacher, index + 1]));
    list(row.etiquetas_publico).concat(list(row.etiquetas_comerciais)).forEach((tag) => {
      const resolved = supportedTag(tag, 'publico');
      if (resolved) statement(lines, 'student_tags', ['student_id', 'tag_key'], [id, resolved.key], 'INSERT OR IGNORE');
    });
  });
  leads.forEach((row) => {
    const id = text(row.lead_id, 120); if (!id) return;
    statement(lines, 'leads', ['lead_id', 'name', 'phone', 'origin', 'referral', 'first_contact_on', 'trial_on', 'trial_teacher', 'became_customer_on', 'status', 'contracted_plan', 'package_value_cents', 'sales_report', 'created_at', 'updated_at'], [id, text(row.nome, 200), text(row.telefone, 60), text(row.origem, 160), text(row.indicacao, 300), isoDate(row.primeiro_contato), isoDate(row.experimental), text(row.professor_experimental, 200), isoDate(row.entrada_como_cliente), text(row.status, 80), text(row.plano_contratado, 80), cents(row.valor_pacote), text(row.minirrelatorio_venda, 3000), now, now]);
  });
  officialExitById.forEach(({ row, date }, studentId) => {
    const manual = manualChurnById.get(studentId) || {};
    const churnId = text(manual.churn_id, 120) || `official-${studentId}`;
    statement(lines, 'churns', ['churn_id', 'student_id', 'official_name', 'official_phone', 'official_exit_on', 'official_contract', 'official_value_cents', 'official_started_on', 'official_expires_on', 'responsible_professional', 'last_teacher', 'manual_exit_reason', 'manual_context', 'manual_retention_action', 'created_at', 'updated_at'], [churnId, studentId, text(row.Cliente, 200), text(manual.telefone, 60) || studentPhone.get(studentId) || '', date, text(row.Contrato, 300), cents(row.Valor), isoDate(row.Início), date, text(manual.profissional_responsavel, 120), text(manual.ultimo_personal, 120), text(manual.motivo_saida, 2000), text(manual.sinais_contexto, 3000), text(manual.acao_retencao, 3000), now, now]);
  });
  firstSheet(officialNew).forEach((row, index) => {
    const studentId = text(row.Código, 100), entry = isoDate(row['Data da Venda']); if (!studentId || !entry) return;
    statement(lines, 'new_students', ['entry_id', 'student_id', 'official_name', 'official_phone', 'official_entry_on', 'official_contract', 'official_value_cents', 'source_batch_id', 'created_at'], [`official-new-${studentId}-${entry}-${index + 1}`, studentId, text(row.Aluno, 200), '', entry, `${text(row.Pacote, 160)}${row.Polo ? ` - ${text(row.Polo, 120)}` : ''}`, cents(row.Valor), 'official-new-students-2026-08-20', now]);
  });
  dashboardSettings.concat(alertSettings).forEach((row) => {
    const type = text(row.tipo, 80), key = text(row.chave, 120); if (!type || !key) return;
    statement(lines, 'settings', ['setting_type', 'setting_key', 'active', 'position', 'value_json', 'title', 'states_json'], [type, key, bool(row.ativo), Number(row.ordem) || 0, text(row.valor, 4000) || '{}', text(row.titulo, 200), text(row.estados, 4000) || '[]']);
  });
  if (options.transaction !== false) lines.push('COMMIT;');
  return { sql: `${lines.join('\n')}\n`, counts: { students: students.length, contracts: contracts.length, profiles: profiles.length, churns: officialExitById.size, newStudents: firstSheet(officialNew).length } };
}

function main() {
  const master = required('--master'), churns = required('--churns'), newStudents = required('--new-students'), output = required('--output');
  const repo = path.resolve(__dirname, '..');
  if (output === repo || output.startsWith(`${repo}${path.sep}`)) throw new Error('A saída deve ficar fora do repositório.');
  [master, churns, newStudents].forEach((file) => { if (!fs.existsSync(file)) throw new Error('Arquivo de entrada não encontrado.'); });
  const result = build(master, churns, newStudents, { transaction: !process.argv.includes('--no-transaction') });
  fs.writeFileSync(output, result.sql, { mode: 0o600 });
  process.stdout.write(JSON.stringify(result.counts));
}

if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

module.exports = { build };
