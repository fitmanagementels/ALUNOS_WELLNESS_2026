const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { BACKUP_TABLES } = require('./restore-r2-backup');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const DEFAULT_BUCKET = 'xsteam-gestao-files';

function requireOption(args, name) {
  const index = args.indexOf(name);
  const value = index < 0 ? '' : args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Argumento obrigatório ausente: ${name}`);
  return value;
}

function safeDestination(directory, key) {
  const root = path.resolve(directory);
  const candidate = path.resolve(root, key);
  if (!candidate.startsWith(`${root}${path.sep}`)) throw new Error('Chave de backup inválida.');
  return candidate;
}

function backupPrefix(manifestKey) {
  if (!manifestKey.startsWith('backups/') || !manifestKey.endsWith('/manifest.json')) {
    throw new Error('A chave do manifesto deve apontar para backups/.../manifest.json.');
  }
  return manifestKey.slice(0, -'/manifest.json'.length);
}

async function downloadBackup({ manifestKey, outputDirectory, fetchObject }) {
  const prefix = backupPrefix(manifestKey);
  const manifestFile = safeDestination(outputDirectory, manifestKey);
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  await fetchObject(manifestKey, manifestFile);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (!manifest || manifest.schemaVersion !== 1 || !manifest.tables || typeof manifest.tables !== 'object') {
    throw new Error('Manifesto de backup com schema incompatível.');
  }
  for (const [table, entry] of Object.entries(manifest.tables)) {
    if (!BACKUP_TABLES.includes(table) || !entry || typeof entry.key !== 'string') throw new Error('Entrada de backup inválida.');
    if (!entry.key.startsWith(`${prefix}/`)) throw new Error('Objeto de backup fora do prefixo do manifesto.');
    const destination = safeDestination(outputDirectory, entry.key);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    await fetchObject(entry.key, destination);
  }
  return { manifestFile, tables: Object.keys(manifest.tables).length };
}

function runWranglerFetch(bucket, key, destination) {
  const wrangler = path.join(REPOSITORY_ROOT, 'worker', 'node_modules', '.bin', 'wrangler');
  execFileSync(wrangler, ['r2', 'object', 'get', `${bucket}/${key}`, '--remote', '--file', destination], {
    cwd: path.join(REPOSITORY_ROOT, 'worker'),
    stdio: 'pipe'
  });
}

async function main() {
  const args = process.argv.slice(2);
  const manifestKey = requireOption(args, '--manifest-key');
  const outputDirectory = path.resolve(requireOption(args, '--out-dir'));
  const bucket = args.includes('--bucket') ? requireOption(args, '--bucket') : DEFAULT_BUCKET;
  const result = await downloadBackup({
    manifestKey,
    outputDirectory,
    fetchObject: async (key, destination) => runWranglerFetch(bucket, key, destination)
  });
  process.stdout.write(`Backup baixado: ${result.tables} tabelas verificáveis em diretório local temporário.\n`);
}

if (require.main === module) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2; });
}

module.exports = { backupPrefix, downloadBackup, safeDestination };
