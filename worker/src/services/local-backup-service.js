export const LOCAL_BACKUP_TABLES = Object.freeze([
  'students', 'contracts', 'prescriptions', 'assessments', 'permanence', 'permanence_events',
  'student_profiles', 'student_last_teachers', 'tag_groups', 'tags', 'student_tags', 'leads',
  'churns', 'new_students', 'settings', 'import_batches', 'import_files', 'import_rows',
  'import_errors', 'mutation_log', 'data_versions', 'usage_counters'
]);

async function readTable(db, table) {
  const result = await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
  return result && result.results || [];
}

export async function buildLocalBackup(db, now = new Date()) {
  const tables = {};
  for (const table of LOCAL_BACKUP_TABLES) tables[table] = await readTable(db, table);
  return { format: 'xsteam-local-backup', version: 1, createdAt: now.toISOString(), tables };
}
