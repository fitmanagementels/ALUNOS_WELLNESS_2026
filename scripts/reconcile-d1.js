const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TABLES = ['students', 'contracts', 'profiles', 'churns', 'newStudents'];

function hashId(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

function metric(value) {
  const ids = Array.from(new Set((value && value.ids || []).map(String))).sort();
  return { ids, valueCents: Number(value && value.valueCents || 0) };
}

function compare(expected, actual) {
  const source = metric(expected);
  const target = metric(actual);
  const sourceIds = new Set(source.ids);
  const targetIds = new Set(target.ids);
  const missing = source.ids.filter((id) => !targetIds.has(id));
  const extra = target.ids.filter((id) => !sourceIds.has(id));
  return {
    matches: missing.length === 0 && extra.length === 0 && source.valueCents === target.valueCents,
    expectedCount: source.ids.length,
    actualCount: target.ids.length,
    missingCount: missing.length,
    extraCount: extra.length,
    missingIdHashes: missing.map(hashId),
    extraIdHashes: extra.map(hashId),
    valueCents: { expected: source.valueCents, actual: target.valueCents, matches: source.valueCents === target.valueCents }
  };
}

function reconcileMetrics(expected, actual) {
  const tables = {};
  TABLES.forEach((name) => { tables[name] = compare(expected && expected[name], actual && actual[name]); });
  return { ok: Object.values(tables).every((table) => table.matches), tables };
}

function required(name) {
  const position = process.argv.indexOf(name);
  const value = position === -1 ? '' : process.argv[position + 1];
  if (!value) throw new Error(`Argumento obrigatório ausente: ${name}`);
  return path.resolve(value);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  const expected = readJson(required('--expected'));
  const actual = readJson(required('--actual'));
  const report = reconcileMetrics(expected, actual);
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) {
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
}

module.exports = { reconcileMetrics, hashId, TABLES };
