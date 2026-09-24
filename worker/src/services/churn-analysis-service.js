function parseDate(value) {
  const source = String(value || '').trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(source);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(source);
  const parts = br ? [br[3], br[2], br[1]] : iso ? [iso[1], iso[2], iso[3]] : null;
  if (!parts) return null;
  const date = new Date(`${parts.join('-')}T12:00:00Z`);
  return Number.isNaN(date.valueOf()) ? null : date;
}
function iso(date) { return date.toISOString().slice(0, 10); }
function br(date) { return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`; }
function monthKey(date) { return iso(date).slice(0, 7); }
function shiftMonth(key, offset) {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
function monday(date) {
  const result = new Date(date.valueOf());
  const day = result.getUTCDay() || 7;
  result.setUTCDate(result.getUTCDate() - day + 1);
  return result;
}
function countBy(items, accessor) {
  const map = new Map();
  items.forEach((item) => { const key = accessor(item); if (key) map.set(key, (map.get(key) || 0) + 1); });
  return [...map.entries()].map(([chave, valor]) => ({ chave, valor })).sort((a, b) => b.valor - a.valor || a.chave.localeCompare(b.chave, 'pt-BR'));
}
function variation(value, previous) {
  return {
    variacaoAbsoluta: previous == null ? null : value - previous,
    variacaoPercentual: previous == null || previous === 0 ? null : Math.round(((value - previous) / previous) * 100)
  };
}

export async function analyzeChurn(db, filters = {}) {
  const rows = (await db.prepare(`SELECT official_exit_on, manual_exit_reason, responsible_professional, manual_retention_action
    FROM churns WHERE archived_at IS NULL`).bind().all()).results || [];
  const items = rows.map((row) => ({ ...row, date: parseDate(row.official_exit_on) })).filter((row) => row.date);
  const monthStart = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(filters.mesInicio || '')) ? filters.mesInicio : null;
  const monthEnd = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(filters.mesFim || '')) ? filters.mesFim : null;
  const startMonth = monthStart || (items.length ? monthKey(items.reduce((earliest, row) => row.date < earliest ? row.date : earliest, items[0].date)) : monthKey(new Date()));
  const endMonth = monthEnd || (items.length ? monthKey(items.reduce((latest, row) => row.date > latest ? row.date : latest, items[0].date)) : startMonth);
  const monthly = [];
  for (let key = startMonth; key <= endMonth; key = shiftMonth(key, 1)) monthly.push({ chave: key, label: `${key.slice(5)}/${key.slice(0, 4)}`, valor: items.filter((item) => monthKey(item.date) === key).length });
  monthly.forEach((item, index) => Object.assign(item, variation(item.valor, index ? monthly[index - 1].valor : null)));

  const defaultEnd = monday(new Date()); defaultEnd.setUTCDate(defaultEnd.getUTCDate() + 6);
  const weekEnd = parseDate(filters.semanaFim) || defaultEnd;
  const weekStart = parseDate(filters.semanaInicio) || new Date(weekEnd.valueOf() - 25 * 7 * 86400000);
  const weeks = [];
  for (let cursor = monday(weekStart); cursor <= weekEnd; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
    const start = new Date(cursor.valueOf()), end = new Date(cursor.valueOf()); end.setUTCDate(end.getUTCDate() + 6);
    const item = { chave: iso(start), inicio: br(start), fim: br(end), label: `${br(start)} — ${br(end)}`, valor: items.filter((row) => row.date >= start && row.date <= end).length };
    Object.assign(item, variation(item.valor, weeks.length ? weeks[weeks.length - 1].valor : null));
    weeks.push(item);
  }
  const scoped = items.filter((item) => (!monthStart || monthKey(item.date) >= monthStart) && (!monthEnd || monthKey(item.date) <= monthEnd));
  const withRetention = scoped.filter((item) => String(item.manual_retention_action || '').trim()).length;
  return {
    mensal: monthly,
    semanal: weeks,
    diagnosticos: {
      motivos: countBy(scoped, (item) => String(item.manual_exit_reason || '').trim()),
      responsaveis: countBy(scoped, (item) => String(item.responsible_professional || '').trim()),
      retencao: { comAcao: withRetention, semAcao: scoped.length - withRetention, coberturaPercentual: scoped.length ? Math.round((withRetention / scoped.length) * 100) : 0 }
    }
  };
}
