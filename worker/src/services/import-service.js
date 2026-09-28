import { TYPES, date, validateRows, buildImport, fail } from '../../../pwa/js/import-model.mjs';
import { buildLocalBackup } from './local-backup-service.js';

const rows = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results || [];
const one = async (db, sql, ...args) => (await rows(db, sql, ...args))[0];
const digest = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, '0')).join('');
const baselineSql = `SELECT COALESCE((SELECT version_id FROM data_versions WHERE status='active'),0) AS version, COALESCE((SELECT MAX(rowid) FROM mutation_log),0) AS mutation`;
async function own(db, actor, id) {
  const job = await one(db, 'SELECT * FROM weekly_uploads WHERE id=? AND actor=?', String(id || ''), actor.email);
  if (!job) fail('Importação não encontrada para esta conta.');
  return job;
}
function manifest(value) {
  if (!Array.isArray(value) || value.length !== 4 || new Set(value.map(f => f.type)).size !== 4) fail('Selecione os quatro relatórios diferentes.');
  value.forEach(f => {
    if (!TYPES[f.type] || !Number.isInteger(f.rows) || f.rows < 1 || f.rows > 20000 || !/^[a-f0-9]{64}$/.test(f.hash) || typeof f.name !== 'string' || f.name.length > 200) fail('Identificação de arquivo inválida.');
  });
  return [...value].sort((a, b) => a.type.localeCompare(b.type));
}
async function loadReports(db, job) {
  const out = {};
  const chunks = await rows(db, 'SELECT type,position,rows_json FROM weekly_upload_chunks WHERE upload_id=? ORDER BY type,position', job.id);
  for (const f of JSON.parse(job.manifest_json)) {
    const parts = chunks.filter(c => c.type === f.type);
    if (parts.some((c, i) => c.position !== i) || parts.length !== Math.ceil(f.rows / 100)) fail('Envio incompleto. Retome o upload.');
    out[f.type] = parts.flatMap(c => JSON.parse(c.rows_json));
    if (out[f.type].length !== f.rows || await digest(JSON.stringify(out[f.type])) !== f.hash) fail('O conteúdo recebido não corresponde ao arquivo selecionado.');
    validateRows(f.type, out[f.type]);
  }
  return out;
}
export async function importAction(db, actor, action, payload) {
  if (action === 'importHistory') return rows(db, 'SELECT id,reference_date,status,created_at,applied_at FROM weekly_uploads WHERE actor=? ORDER BY created_at DESC LIMIT 20', actor.email);
  if (action === 'importStart') {
    const reference = date(payload.reference, true), files = manifest(payload.files);
    if (reference > new Date().toISOString().slice(0, 10)) fail('A data de referência não pode estar no futuro.');
    const fingerprint = await digest(JSON.stringify(files.map(f => [f.type, f.hash])));
    const applied = await one(db, "SELECT id,status,actor FROM weekly_uploads WHERE fingerprint=? AND status='applied'", fingerprint);
    if (applied) {
      if (applied.actor !== actor.email) fail('Estes quatro arquivos já foram aplicados à base por outra conta autorizada.');
      return {id:applied.id,status:applied.status};
    }
    const prior = await one(db, 'SELECT id,status FROM weekly_uploads WHERE fingerprint=? AND actor=? AND reference_date=? ORDER BY created_at DESC LIMIT 1', fingerprint, actor.email, reference);
    if (prior) return prior;
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO weekly_uploads(id,actor,reference_date,manifest_json,fingerprint,created_at) VALUES(?,?,?,?,?,?)').bind(id, actor.email, reference, JSON.stringify(files), fingerprint, new Date().toISOString()).run();
    return { id, status: 'uploading' };
  }
  const job = await own(db, actor, payload.id);
  if (action === 'importChunk') {
    if (job.status !== 'uploading') return { status: job.status };
    const f = JSON.parse(job.manifest_json).find(f => f.type === payload.type);
    if (!f || !Number.isInteger(payload.position) || payload.position < 0 || payload.position >= Math.ceil(f.rows / 100)) fail('Bloco inválido.');
    validateRows(payload.type, payload.rows);
    if (payload.rows.length !== Math.min(100, f.rows - payload.position * 100)) fail('Quantidade incorreta no bloco.');
    const serialized = JSON.stringify(payload.rows);
    const old = await one(db, 'SELECT rows_json FROM weekly_upload_chunks WHERE upload_id=? AND type=? AND position=?', job.id, payload.type, payload.position);
    if (old && old.rows_json !== serialized) fail('Bloco já recebido com conteúdo diferente.');
    await db.prepare("INSERT INTO weekly_upload_chunks(upload_id,type,position,rows_json) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM weekly_uploads WHERE id=? AND status='uploading') ON CONFLICT DO NOTHING").bind(job.id, payload.type, payload.position, serialized, job.id).run();
    return { received: true };
  }
  if (action === 'importPreview') {
    if (job.status === 'applied') return { status: 'applied', ...JSON.parse(job.preview_json) };
    const baseline = await one(db, baselineSql);
    const active = await one(db, "SELECT reference_date FROM data_versions WHERE status='active'");
    if (active && job.reference_date < active.reference_date) fail('Este lote é anterior à base atual. Use um relatório atualizado.');
    const reports = await loadReports(db, job);
    const [students, contracts, permanence] = await Promise.all(['students', 'contracts', 'permanence'].map(t => rows(db, `SELECT * FROM ${t}`)));
    const preview = buildImport(reports, { students, contracts, permanence });
    preview.reference = job.reference_date;
    preview.files = JSON.parse(job.manifest_json);
    if (new TextEncoder().encode(JSON.stringify(preview)).byteLength > 1500000) fail('Prévia acima do limite deste importador. Revise a abrangência dos relatórios antes de continuar.');
    // Keep preparation auditable and bind confirmation to this exact current base.
    await db.prepare("UPDATE weekly_uploads SET preview_json=?,baseline_version=?,baseline_mutation=?,backed_up=0,status='preview' WHERE id=? AND status!='applied'").bind(JSON.stringify(preview), baseline.version, baseline.mutation, job.id).run();
    return preview;
  }
  if (action === 'importBackup') {
    if (job.status !== 'preview') fail('Gere a prévia antes do backup.');
    const snapshot = await buildLocalBackup(db);
    await db.prepare("UPDATE weekly_uploads SET backed_up=1 WHERE id=? AND status='preview'").bind(job.id).run();
    return snapshot;
  }
  if (action === 'importConfirm') {
    if (job.status === 'applied') return { status: 'applied', id: job.id };
    if (job.status !== 'preview' || !job.backed_up) fail('Confira a prévia e baixe o backup antes de confirmar.');
    const preview = JSON.parse(job.preview_json);
    if (preview.errors.length) fail('Existem inconsistências bloqueantes na prévia. Corrija os arquivos antes de importar.');
    const baseline = await one(db, baselineSql);
    if (baseline.version !== job.baseline_version || baseline.mutation !== job.baseline_mutation) fail('A base mudou desde a prévia. Gere uma nova prévia e backup.');
    await promote(db, job, preview);
    return { id: job.id, status: 'applied' };
  }
  fail('Ação de importação inválida.');
}

async function promote(db, job, preview) {
  const now = new Date().toISOString(), statements = [];
  const add = (sql, ...args) => statements.push(db.prepare(sql).bind(...args));
  add(`INSERT INTO weekly_upload_guard(id,valid) VALUES(?, CASE WHEN
    COALESCE((SELECT version_id FROM data_versions WHERE status='active'),0)=?
    AND COALESCE((SELECT MAX(rowid) FROM mutation_log),0)=?
    AND EXISTS(SELECT 1 FROM weekly_uploads WHERE id=? AND status='preview' AND backed_up=1)
    THEN 1 ELSE 0 END)`, job.id, job.baseline_version, job.baseline_mutation, job.id);
  add("UPDATE data_versions SET status='superseded' WHERE status='active'");
  add("INSERT INTO data_versions(reference_date,revision,status,created_at,activated_at) SELECT ?,COALESCE(MAX(revision),0)+1,'active',?,? FROM data_versions WHERE reference_date=?", job.reference_date, now, now, job.reference_date);
  const version = "(SELECT version_id FROM data_versions WHERE status='active')";
  const j = field => `json_extract(value,'$.${field}')`;
  const upsert = (table, fields, key, data, updates) => {
    // Set-based writes keep the entire promotion within the free-tier query limit.
      add(`INSERT INTO ${table}(${fields.join(',')},source_version_id${table === 'students' || table === 'contracts' ? ',updated_at' : ''}) SELECT ${fields.map(j).join(',')},${version}${table === 'students' || table === 'contracts' ? ',?' : ''} FROM json_each(?) WHERE 1 ON CONFLICT(${key}) DO UPDATE SET ${updates || fields.filter(f => f !== key).map(f => `${f}=excluded.${f}`).join(',')},source_version_id=excluded.source_version_id${table === 'students' || table === 'contracts' ? ',updated_at=excluded.updated_at' : ''}`,
        ...(table === 'students' || table === 'contracts' ? [now] : []), JSON.stringify(data));
  };
  upsert('students', ['student_id','name','phone','status','plan_started_on','prescription_on','assessment_on'], 'student_id', preview.students);
  upsert('contracts', ['contract_key','student_id','full_name','frequency','value_cents','current_started_on','expires_on','contract_status','location','modality'], 'contract_key', preview.contracts);
  upsert('prescriptions', ['student_id','started_on'], 'student_id', preview.students.filter(s => s.prescription_on).map(s => ({student_id:s.student_id,started_on:s.prescription_on})));
  upsert('assessments', ['student_id','assessed_on'], 'student_id', preview.students.filter(s => s.assessment_on).map(s => ({student_id:s.student_id,assessed_on:s.assessment_on})));
  for (const field of ['customer_since','permanence_status','source_continuity_months','source_contract_count']) {
    add(`INSERT INTO permanence_events(event_id,student_id,reference_date,event_type,field_name,previous_value,new_value,source_version_id,recorded_at)
      SELECT ?||':'||${j('student_id')}||':${field}',${j('student_id')},?,'alteracao','${field}',CAST(p.${field} AS TEXT),CAST(${j(field)} AS TEXT),${version},?
      FROM json_each(?) JOIN permanence p ON p.student_id=${j('student_id')} WHERE COALESCE(CAST(p.${field} AS TEXT),'')!=COALESCE(CAST(${j(field)} AS TEXT),'')`, job.id, job.reference_date, now, JSON.stringify(preview.permanence));
  }
  add('UPDATE permanence SET present_in_latest_batch=0');
  upsert('permanence', ['student_id','customer_since','permanence_status','source_continuity_months','source_contract_count','first_seen_on','last_seen_on','present_in_latest_batch'], 'student_id', preview.permanence.map(p => ({...p,first_seen_on:job.reference_date,last_seen_on:job.reference_date,present_in_latest_batch:1})), 'customer_since=excluded.customer_since,permanence_status=excluded.permanence_status,source_continuity_months=excluded.source_continuity_months,source_contract_count=excluded.source_contract_count,last_seen_on=excluded.last_seen_on,present_in_latest_batch=1');
  const {students, contracts, permanence, ...receipt} = preview;
  add("UPDATE weekly_uploads SET status='applied',applied_at=?,preview_json=? WHERE id=?", now, JSON.stringify(receipt), job.id);
  add('DELETE FROM weekly_upload_chunks WHERE upload_id=?', job.id);
  add('DELETE FROM weekly_upload_guard WHERE id=?', job.id);
  await db.batch(statements);
}
