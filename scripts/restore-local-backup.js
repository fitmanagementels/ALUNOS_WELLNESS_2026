const { webcrypto } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BACKUP_TABLES = Object.freeze([
  'students', 'contracts', 'prescriptions', 'assessments', 'permanence',
  'permanence_events', 'student_profiles', 'student_last_teachers', 'tag_groups',
  'tags', 'student_tags', 'leads', 'churns', 'new_students', 'settings',
  'import_batches', 'import_files', 'import_rows', 'import_errors', 'mutation_log',
  'data_versions', 'usage_counters'
]);
const TARGET_DATABASE = 'xsteam-gestao';
const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function fromBase64(value, label) {
  if (typeof value !== 'string' || !value) throw new Error(`Campo ${label} inválido no backup.`);
  try {
    return Uint8Array.from(Buffer.from(value, 'base64'));
  } catch (_) {
    throw new Error(`Campo ${label} inválido no backup.`);
  }
}

function assertEnvelope(envelope) {
  if (!envelope || envelope.format !== 'xsteam-encrypted-backup') {
    throw new Error('Arquivo de backup incompatível.');
  }
  if (envelope.version !== 1) throw new Error('Versão de backup incompatível.');
  if (envelope.algorithm !== 'AES-GCM' || envelope.kdf !== 'PBKDF2-SHA-256' || envelope.iterations !== 600000) {
    throw new Error('Parâmetros criptográficos incompatíveis.');
  }
}

function assertSnapshot(snapshot) {
  if (!snapshot || snapshot.format !== 'xsteam-local-backup' || snapshot.version !== 1 || !snapshot.tables || typeof snapshot.tables !== 'object' || Array.isArray(snapshot.tables)) {
    throw new Error('Conteúdo do backup incompatível.');
  }
  for (const [table, rows] of Object.entries(snapshot.tables)) {
    if (!BACKUP_TABLES.includes(table) || !Array.isArray(rows)) throw new Error('Tabela inválida no backup.');
    rows.forEach((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Linha inválida no backup.');
    });
  }
  return snapshot;
}

async function decryptEnvelope(envelope, password, cryptoApi = webcrypto) {
  assertEnvelope(envelope);
  if (typeof password !== 'string' || password.length < 12) throw new Error('A senha do backup precisa ter ao menos 12 caracteres.');
  try {
    const salt = fromBase64(envelope.salt, 'salt');
    const iv = fromBase64(envelope.iv, 'iv');
    const ciphertext = fromBase64(envelope.ciphertext, 'ciphertext');
    const material = await cryptoApi.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await cryptoApi.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    return assertSnapshot(JSON.parse(decoder.decode(await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext))));
  } catch (error) {
    if (/incompatível|inválid[oa]/i.test(error.message || '')) throw error;
    throw new Error('Não foi possível decifrar o backup. Confira a senha e o arquivo.');
  }
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
      lines.push(`INSERT INTO ${quoteIdentifier(table)} (${fields}) VALUES (${columns.map((column) => quoteValue(row[column])).join(', ')});`);
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

function assertApplyAllowed(args) {
  if (!args.includes('--apply')) return false;
  if (requireOption(args, '--confirm-database') !== TARGET_DATABASE) {
    throw new Error(`Confirmação obrigatória: --confirm-database ${TARGET_DATABASE}`);
  }
  return true;
}

function promptPassword(prompt = 'Senha do backup: ') {
  if (!process.stdin.isTTY) return Promise.reject(new Error('A restauração precisa ser executada em um terminal interativo.'));
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const done = (error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('data', onData);
      process.stdout.write('\n');
      error ? reject(error) : resolve(value);
    };
    const onData = (chunk) => {
      const key = chunk.toString('utf8');
      if (key === '\u0003') return done(new Error('Restauração cancelada.'));
      if (key === '\r' || key === '\n') return done();
      if (key === '\u007f' || key === '\b') { value = value.slice(0, -1); return; }
      value += key;
    };
    process.stdin.on('data', onData);
  });
}

function runD1Restore(sqlFile) {
  const wrangler = path.join(REPOSITORY_ROOT, 'worker', 'node_modules', '.bin', 'wrangler');
  const result = spawnSync(wrangler, ['d1', 'execute', TARGET_DATABASE, '--remote', '--file', sqlFile], {
    cwd: path.join(REPOSITORY_ROOT, 'worker'), encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(`Restauração D1 falhou: ${(result.stderr || result.stdout || 'erro desconhecido').trim()}`);
}

async function main() {
  const args = process.argv.slice(2);
  const input = path.resolve(requireOption(args, '--file'));
  const output = assertOutsideRepository(requireOption(args, '--out'));
  const password = await promptPassword();
  const snapshot = await decryptEnvelope(JSON.parse(fs.readFileSync(input, 'utf8')), password);
  const sql = buildRestoreSql(snapshot.tables);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, sql, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  if (assertApplyAllowed(args)) runD1Restore(output);
  process.stdout.write(`Restauração ${args.includes('--apply') ? 'aplicada' : 'preparada'}: ${Object.keys(snapshot.tables).length} tabelas verificadas.\n`);
}

if (require.main === module) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2; });
}

module.exports = { BACKUP_TABLES, TARGET_DATABASE, decryptEnvelope, buildRestoreSql, assertApplyAllowed };
