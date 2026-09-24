const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { gunzipSync } = require('zlib');
const { spawnSync } = require('child_process');

const BACKUP_TABLES = Object.freeze([
  'students', 'contracts', 'prescriptions', 'assessments', 'permanence',
  'permanence_events', 'student_profiles', 'student_last_teachers', 'tag_groups',
  'tags', 'student_tags', 'leads', 'churns', 'new_students', 'settings',
  'import_batches', 'import_files', 'import_rows', 'import_errors', 'mutation_log',
  'data_versions', 'usage_counters'
]);
const TARGET_DATABASE = 'xsteam-gestao';
const REPOSITORY_ROOT = path.resolve(__dirname, '..');

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function assertManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || !manifest.tables || typeof manifest.tables !== 'object') {
    throw new Error('Manifesto de backup com schema incompatível.');
  }
}

function decodeJsonl(bytes) {
  const buffer = Buffer.from(bytes);
  const text = buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer).toString('utf8') : buffer.toString('utf8');
  if (!text.trim()) return [];
  return text.trimEnd().split('\n').map((line) => {
    const row = JSON.parse(line);
    if (!row || Array.isArray(row) || typeof row !== 'object') throw new Error('Linha de backup inválida.');
    return row;
  });
}

async function validateAndDecodeBackup(manifest, readObject) {
  assertManifest(manifest);
  const decoded = {};
  for (const [table, entry] of Object.entries(manifest.tables)) {
    if (!BACKUP_TABLES.includes(table)) throw new Error('Tabela de backup inválida.');
    if (!entry || typeof entry.key !== 'string' || !/^[a-f0-9]{64}$/i.test(entry.sha256 || '')) {
      throw new Error('Entrada de manifesto inválida.');
    }
    const bytes = Buffer.from(await readObject(entry.key));
    if (sha256(bytes) !== entry.sha256.toLowerCase()) throw new Error('Hash inválido para objeto de backup.');
    const rows = decodeJsonl(bytes);
    if (!Number.isInteger(entry.rows) || entry.rows < 0 || rows.length !== entry.rows) {
      throw new Error('Contagem de linhas inválida no backup.');
    }
    decoded[table] = rows;
  }
  return decoded;
}

function quoteIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('Nome de coluna inválido no backup.');
  return `"${value}"`;
}

function quoteValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Número inválido no backup.');
    return String(value);
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `'${text.replaceAll("'", "''")}'`;
}

function buildRestoreSql(rowsByTable) {
  const tables = Object.keys(rowsByTable);
  tables.forEach((table) => {
    if (!BACKUP_TABLES.includes(table) || !Array.isArray(rowsByTable[table])) throw new Error('Tabela de restauração inválida.');
  });
  const lines = ['PRAGMA foreign_keys = OFF;', 'BEGIN IMMEDIATE;'];
  [...tables].reverse().forEach((table) => lines.push(`DELETE FROM ${quoteIdentifier(table)};`));
  tables.forEach((table) => {
    const rows = rowsByTable[table];
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).sort();
    if (!columns.length) return;
    const fields = columns.map(quoteIdentifier).join(', ');
    rows.forEach((row) => {
      const values = columns.map((column) => quoteValue(row[column])).join(', ');
      lines.push(`INSERT INTO ${quoteIdentifier(table)} (${fields}) VALUES (${values});`);
    });
  });
  lines.push('COMMIT;', 'PRAGMA foreign_keys = ON;', '');
  return lines.join('\n');
}

function requireOption(args, name) {
  const index = args.indexOf(name);
  const value = index < 0 ? '' : args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Argumento obrigatório ausente: ${name}`);
  return value;
}

function assertOutsideRepository(file) {
  const absolute = path.resolve(file);
  if (absolute === REPOSITORY_ROOT || absolute.startsWith(`${REPOSITORY_ROOT}${path.sep}`)) {
    throw new Error('A SQL de restauração precisa ser gerada fora do repositório.');
  }
  return absolute;
}

function objectPath(directory, key) {
  const root = path.resolve(directory);
  const candidate = path.resolve(root, key);
  if (!candidate.startsWith(`${root}${path.sep}`)) throw new Error('Caminho de objeto de backup inválido.');
  return candidate;
}

function assertApplyAllowed(args) {
  if (!args.includes('--apply')) return false;
  if (requireOption(args, '--confirm-database') !== TARGET_DATABASE) {
    throw new Error(`Confirmação obrigatória: --confirm-database ${TARGET_DATABASE}`);
  }
  return true;
}

function runD1Restore(sqlFile) {
  const wrangler = path.join(REPOSITORY_ROOT, 'worker', 'node_modules', '.bin', 'wrangler');
  const result = spawnSync(wrangler, ['d1', 'execute', TARGET_DATABASE, '--remote', '--file', sqlFile], {
    cwd: path.join(REPOSITORY_ROOT, 'worker'),
    encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(`Restauração D1 falhou: ${(result.stderr || result.stdout || 'erro desconhecido').trim()}`);
}

async function main() {
  const args = process.argv.slice(2);
  const manifestFile = path.resolve(requireOption(args, '--manifest'));
  const objectsDirectory = path.resolve(requireOption(args, '--backup-dir'));
  const outputFile = assertOutsideRepository(requireOption(args, '--out'));
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const rows = await validateAndDecodeBackup(manifest, async (key) => fs.readFileSync(objectPath(objectsDirectory, key)));
  const sql = buildRestoreSql(rows);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, sql, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  if (assertApplyAllowed(args)) runD1Restore(outputFile);
  process.stdout.write(`Restauração ${args.includes('--apply') ? 'aplicada' : 'preparada'}: ${Object.keys(rows).length} tabelas verificadas.\n`);
}

if (require.main === module) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2; });
}

module.exports = { BACKUP_TABLES, TARGET_DATABASE, validateAndDecodeBackup, buildRestoreSql, assertApplyAllowed };
