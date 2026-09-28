import { parseReport } from './import-model.mjs';
self.onmessage = async event => {
  try {
    const files = event.data;
    if (files.length !== 4) throw new Error('Selecione os quatro arquivos da semana.');
    const reports = [], types = new Set();
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) throw new Error(file.name + ': limite de 8 MB por arquivo.');
      const report = parseReport(await file.text());
      if (types.has(report.type)) throw new Error('Há dois arquivos do mesmo tipo: ' + report.type);
      types.add(report.type);
      const bytes = new TextEncoder().encode(JSON.stringify(report.rows));
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2,'0')).join('');
      reports.push({ ...report, name: file.name, hash });
    }
    self.postMessage({ reports });
  } catch (e) { self.postMessage({ error: e.message }); }
};
