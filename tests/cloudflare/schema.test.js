const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const requiredTables = [
  'students', 'contracts', 'prescriptions', 'assessments', 'permanence',
  'permanence_events', 'student_profiles', 'student_last_teachers', 'profile_catalog', 'tag_groups',
  'tags', 'student_tags', 'leads', 'churns', 'new_students', 'settings',
  'import_batches', 'import_files', 'import_rows', 'import_errors', 'mutation_log',
  'data_versions', 'usage_counters'
];

test('schema D1 contém entidades, preservação manual e versionamento ativo', () => {
  const core = [
    fs.readFileSync('worker/migrations/0001_core.sql', 'utf8'),
    fs.readFileSync('worker/migrations/0003_profile_catalog.sql', 'utf8')
  ].join('\n');
  const indexes = fs.readFileSync('worker/migrations/0002_indexes.sql', 'utf8');

  requiredTables.forEach((table) => {
    assert.match(core, new RegExp(`CREATE TABLE ${table}\\b`, 'i'));
  });
  assert.match(core, /student_id TEXT PRIMARY KEY/i);
  assert.match(core, /manual_exit_reason/i);
  assert.match(core, /PRIMARY KEY\(student_id, teacher_name\)/i);
  assert.match(core, /PRIMARY KEY\(student_id, tag_key\)/i);
  assert.match(core, /CHECK\(status IN \('staging','active','superseded','rejected'\)\)/i);
  assert.match(indexes, /idx_contracts_student_expiry/i);
  assert.match(indexes, /idx_data_versions_one_active/i);
});

test('schema D1 disponibiliza etiquetas persistentes para perfis de alunos', () => {
  const tags = fs.readFileSync('worker/migrations/0004_tags.sql', 'utf8');
  assert.match(tags, /INSERT INTO tag_groups/);
  assert.match(tags, /'publico'/);
  assert.match(tags, /'comercial'/);
  assert.match(tags, /'comercial:coach'/);
  assert.match(tags, /'publico:performance'/);
});
