export const TYPES = {
  vencimentos: ['codigo', 'cliente', 'status cliente', 'contrato', 'valor', 'inicio', 'vencimento', 'status contrato', 'modalidade'],
  fichas: ['codigo', 'cliente', 'data inicio', 'contato'],
  avaliacoes: ['codigo', 'nome', 'data da avaliacao'],
  permanencia: ['codigo', 'cliente', 'cliente desde', 'status atual', 'continuidade (meses)', 'contratos']
};
export const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
export function fail(message) { throw Object.assign(new Error(message), { code: 'IMPORT_VALIDATION', status: 400 }); }
function cell(value) {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim();
}
export function parseReport(html) {
  if (typeof html !== 'string' || !/<table\b/i.test(html)) fail('Use o relatório original XLS/HTML exportado pelo TecnoFit.');
  const table = (html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []).map(row => (row.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map(cell));
  let type, headers, start;
  for (let i = 0; i < table.length; i++) {
    const h = table[i].map(norm);
    const matches = Object.keys(TYPES).filter(t => TYPES[t].every(k => h.includes(k)));
    if (matches.length === 1) { type = matches[0]; headers = h; start = i + 1; break; }
  }
  if (!type) fail('Não foi possível reconhecer as colunas do relatório.');
  const rows = [];
  for (const row of table.slice(start)) {
    if (!row.some(Boolean) || row.some(v => /^Total\s*[:R$]/i.test(v))) continue;
    const item = Object.fromEntries(TYPES[type].map(k => [k, row[headers.indexOf(k)] || '']));
    rows.push(item);
  }
  validateRows(type, rows);
  return { type, rows };
}
export function date(value, required = false) {
  if (!value && !required) return null;
  const s = String(value || '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString().slice(0, 10) !== iso) fail('Data inválida: ' + s);
  return iso;
}
export function validateRows(type, rows) {
  if (!TYPES[type] || !Array.isArray(rows) || !rows.length || rows.length > 20000) fail('Relatório vazio ou acima de 20 mil linhas.');
  rows.forEach((r, i) => {
    if (!r || TYPES[type].some(k => typeof r[k] !== 'string' || r[k].length > 2000)) fail(`${type}: campos inválidos na linha ${i + 1}.`);
    if (!/^\d+$/.test(r.codigo) || !String(r.cliente || r.nome).trim()) fail(`${type}: ID ou nome inválido na linha ${i + 1}.`);
    if (type === 'vencimentos') {
      date(r.inicio, true); date(r.vencimento, true);
      if (!r.contrato.trim()) fail('Contrato sem descrição.');
      money(r.valor);
    } else if (type === 'fichas') date(r['data inicio'], true);
    else if (type === 'avaliacoes') date(r['data da avaliacao'], true);
    else {
      date(r['cliente desde'], true);
      for (const k of ['continuidade (meses)', 'contratos']) if (!/^\d+$/.test(r[k])) fail('Permanência com quantidade inválida.');
    }
  });
}
function money(value) {
  const raw = value.replace(/R\$|\s/g, '');
  if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(raw)) fail('Valor inválido: ' + value);
  return Math.round(Number(raw.replace(/\./g, '').replace(',', '.')) * 100);
}
const keyPart = s => norm(s).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export function buildImport(reports, current = {}) {
  Object.keys(TYPES).forEach(t => validateRows(t, reports[t]));
  const students = new Map(), contracts = new Map(), warnings = [], errors = [];
  const oldStudents = new Map((current.students || []).map(s => [s.student_id, s]));
  const oldContracts = new Map((current.contracts || []).map(c => [c.contract_key, c]));
  const reportNames = new Map();
  for (const [type, list] of Object.entries(reports)) for (const r of list) {
    const name = r.cliente || r.nome, previous = reportNames.get(r.codigo);
    if (previous && norm(previous) !== norm(name)) errors.push({id:r.codigo,name,reason:'Nomes divergentes no mesmo ID em '+type,value:previous});
    else reportNames.set(r.codigo,name);
  }
  const latest = (rows, field) => {
    const out = new Map();
    rows.forEach(r => { const prev = out.get(r.codigo); if (!prev || date(r[field]) > date(prev[field])) out.set(r.codigo, r); });
    return out;
  };
  const fichas = latest(reports.fichas, 'data inicio'), avaliacoes = latest(reports.avaliacoes, 'data da avaliacao');
  const permanencia = new Map();
  reports.permanencia.forEach(r => {
    if (permanencia.has(r.codigo)) errors.push({ id: r.codigo, name: r.cliente, reason: 'ID duplicado em permanência' });
    permanencia.set(r.codigo, r);
  });
  for (const r of reports.vencimentos) {
    const parts = r.contrato.split(/\s+-\s+/), start = date(r.inicio, true), expiry = date(r.vencimento, true);
    const key = `${r.codigo}|${keyPart(r.contrato)}|${start}`;
    const c = { contract_key: key, student_id: r.codigo, full_name: r.contrato, frequency: parts.length > 1 ? parts[0] : '', location: parts[1] || '', value_cents: money(r.valor), current_started_on: start, expires_on: expiry, contract_status: r['status contrato'], modality: r.modalidade };
    if (contracts.has(key) && JSON.stringify(contracts.get(key)) !== JSON.stringify(c)) errors.push({ id: r.codigo, name: r.cliente, reason: 'Mesmo contrato com informações divergentes' });
    contracts.set(key, c);
    if (!c.location || !c.frequency) warnings.push({ id: r.codigo, name: r.cliente, reason: 'Contrato sem frequência/polo reconhecidos', value: r.contrato });
    const prev = students.get(r.codigo);
    if (prev && norm(prev.name) !== norm(r.cliente)) errors.push({ id: r.codigo, name: r.cliente, reason: 'Nomes divergentes no mesmo ID' });
    if (!prev || expiry > prev.expires_on || (expiry === prev.expires_on && start > prev.current_started_on)) students.set(r.codigo, { student_id: r.codigo, name: r.cliente, status: r['status cliente'], expires_on: expiry, current_started_on: start });
  }
  for (const s of students.values()) {
    const id = s.student_id, old = oldStudents.get(id), f = fichas.get(id), a = avaliacoes.get(id), p = permanencia.get(id);
    for (const [label, row] of [['cadastro existente', old && { cliente: old.name }], ['fichas', f], ['avaliações', a], ['permanência', p]]) {
      if (row && norm(row.cliente || row.nome) !== norm(s.name)) errors.push({ id, name: s.name, reason: 'Nome divergente em ' + label, value: row.cliente || row.nome });
    }
    for (const [label, row] of [['ficha', f], ['avaliação', a], ['permanência', p]]) if (!row) warnings.push({ id, name: s.name, reason: 'Sem correspondência em ' + label });
    s.phone = old?.phone || f?.contato || '';
    if (old?.phone && f?.contato && old.phone.replace(/\D/g, '') !== f.contato.replace(/\D/g, '')) warnings.push({ id, name: s.name, reason: 'Telefone divergente; contato existente preservado', previous: old.phone, incoming: f.contato });
    s.plan_started_on = p ? date(p['cliente desde']) : old?.plan_started_on || null;
    s.prescription_on = [old?.prescription_on, f && date(f['data inicio'])].filter(Boolean).sort().at(-1) || null;
    s.assessment_on = [old?.assessment_on, a && date(a['data da avaliacao'])].filter(Boolean).sort().at(-1) || null;
  }
  // Permanência pode abranger alunos históricos fora da lista de vencimentos.
  const known = new Set([...oldStudents.keys(), ...students.keys()]);
  for (const r of permanencia.values()) {
    const existing = oldStudents.get(r.codigo);
    if (existing && norm(existing.name) !== norm(r.cliente)) errors.push({id:r.codigo,name:r.cliente,reason:'Nome divergente no cadastro de permanência',value:existing.name});
  }
  const permanence = [...permanencia.values()].filter(r => known.has(r.codigo)).map(r => ({ student_id: r.codigo, customer_since: date(r['cliente desde']), permanence_status: r['status atual'], source_continuity_months: Number(r['continuidade (meses)']), source_contract_count: Number(r.contratos) }));
  const absent = [...oldStudents.values()].filter(s => !students.has(s.student_id)).map(s => ({ id: s.student_id, name: s.name }));
  const changes = [];
  const oldPermanence = new Map((current.permanence || []).map(p => [p.student_id,p]));
  for (const p of permanence) {
    const old = oldPermanence.get(p.student_id);
    if (!old) changes.push({id:p.student_id,entity:'permanência',kind:'novo',incoming:p});
    else for (const field of ['customer_since','permanence_status','source_continuity_months','source_contract_count']) if (String(old[field] ?? '') !== String(p[field] ?? '')) changes.push({id:p.student_id,entity:'permanência',field,previous:old[field],incoming:p[field]});
  }
  for (const s of students.values()) {
    const old = oldStudents.get(s.student_id);
    if (!old) changes.push({ id: s.student_id, name: s.name, entity: 'aluno', kind: 'novo' });
    else for (const field of ['name', 'status', 'phone', 'plan_started_on', 'prescription_on', 'assessment_on']) if ((old[field] || '') !== (s[field] || '')) changes.push({ id: s.student_id, name: s.name, entity: 'aluno', field, previous: old[field], incoming: s[field] });
  }
  for (const c of contracts.values()) {
    const old = oldContracts.get(c.contract_key);
    if (!old) changes.push({ id: c.student_id, entity: 'contrato', kind: 'novo', incoming: c });
    else for (const field of Object.keys(c)) if (String(old[field] ?? '') !== String(c[field] ?? '')) changes.push({ id: c.student_id, entity: 'contrato', field, previous: old[field], incoming: c[field] });
  }
  return { students: [...students.values()], contracts: [...contracts.values()], permanence, warnings, errors, absent, changes,
    counts: { students: students.size, contracts: contracts.size, newStudents: [...students.keys()].filter(id => !oldStudents.has(id)).length, absent: absent.length, warnings: warnings.length, errors: errors.length } };
}
