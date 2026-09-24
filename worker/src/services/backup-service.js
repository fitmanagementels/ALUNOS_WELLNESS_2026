export const BACKUP_TABLES = Object.freeze([
  'students', 'contracts', 'prescriptions', 'assessments', 'permanence',
  'permanence_events', 'student_profiles', 'student_last_teachers', 'tag_groups',
  'tags', 'student_tags', 'leads', 'churns', 'new_students', 'settings',
  'import_batches', 'import_files', 'import_rows', 'import_errors', 'mutation_log',
  'data_versions', 'usage_counters'
]);

function datePart(now) { return now.toISOString().slice(0, 10); }
function backupId() { return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `backup-${Date.now()}`; }

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function gzip(text) {
  const source = new TextEncoder().encode(text);
  if (typeof CompressionStream === 'undefined') return source;
  return new Uint8Array(await new Response(new Blob([source]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
}

async function readTable(db, table, pageSize) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const result = await db.prepare(`SELECT * FROM ${table} ORDER BY rowid LIMIT ? OFFSET ?`).bind(pageSize, offset).all();
    const page = result && result.results || [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function createBackup(db, files, now = new Date(), options = {}) {
  const tables = options.tables || BACKUP_TABLES;
  const pageSize = options.pageSize || 500;
  const id = options.id || backupId();
  const prefix = `backups/${datePart(now)}/${id}`;
  const manifest = { schemaVersion: 1, id, createdAt: now.toISOString(), tables: {} };

  for (const table of tables) {
    if (!BACKUP_TABLES.includes(table)) throw new Error('Tabela de backup inválida.');
    const rows = await readTable(db, table, pageSize);
    const body = await gzip(rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''));
    const key = `${prefix}/${table}.jsonl.gz`;
    const hash = await sha256(body);
    await files.put(key, body, { httpMetadata: { contentType: 'application/gzip' } });
    manifest.tables[table] = { key, rows: rows.length, sha256: hash };
  }
  const manifestKey = `${prefix}/manifest.json`;
  await files.put(manifestKey, JSON.stringify(manifest), { httpMetadata: { contentType: 'application/json' } });
  return { id, createdAt: manifest.createdAt, manifestKey, tables: manifest.tables };
}
