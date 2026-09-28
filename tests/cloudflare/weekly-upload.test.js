const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { webcrypto } = require('node:crypto');
globalThis.crypto ||= webcrypto;

function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const f of fs.readdirSync('worker/migrations').filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(fs.readFileSync('worker/migrations/'+f,'utf8'));
  const db = { prepare(sql) { return { async all(){return {results:sqlite.prepare(sql).all()};},bind(...args) { return { async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return sqlite.prepare(sql).run(...args);},sql,args }; } }; }, async batch(statements) {sqlite.exec('BEGIN');try{const result=statements.map(s=>sqlite.prepare(s.sql).run(...s.args));sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}} };
  return {db,sqlite};
}
function reports() {
  return {
    vencimentos:[{codigo:'42',cliente:'ANA', 'status cliente':'Ativo',contrato:'2X - XSTEAM WELLNESS CLUB - PERSONAL',valor:'750,00',inicio:'01/09/2026',vencimento:'01/10/2026','status contrato':'Ativo',modalidade:'MUSCULAÇÃO'}],
    fichas:[{codigo:'42',cliente:'ANA','data inicio':'15/09/2026',contato:'85999990000'}],
    avaliacoes:[{codigo:'42',nome:'ANA','data da avaliacao':'10/09/2026'}],
    permanencia:[{codigo:'42',cliente:'ANA','cliente desde':'01/01/2025','status atual':'Ativo','continuidade (meses)':'20',contratos:'3'}]
  };
}
async function stage(db, data=reports()) {
  const {importAction} = await import('../../worker/src/services/import-service.js');
  const call=(action,payload)=>importAction(db,{email:'test@example.com'},action,payload);
  const hash=async text=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex');
  const files=await Promise.all(Object.entries(data).map(async([type,rows])=>({type,rows:rows.length,name:type+'.xls',hash:await hash(JSON.stringify(rows))})));
  const job=await call('importStart',{reference:'2026-09-28',files});
  for(const [type,rows] of Object.entries(data))await call('importChunk',{id:job.id,type,position:0,rows});
  return {call,job,files};
}
test('parser reconhece HTML/XLS, ignora rodapé e rejeita datas impossíveis',async()=>{
  const {parseReport,date}=await import('../../pwa/js/import-model.mjs');
  const r=parseReport('<table><tr><th>Código</th><th>Cliente</th><th>Data Início</th><th>Contato</th></tr><tr><td>42</td><td>ANA</td><td>15/09/2026</td><td></td></tr><tr><td>Total: 1 registros</td></tr></table>');
  assert.equal(r.type,'fichas');assert.equal(r.rows.length,1);assert.throws(()=>date('31/02/2026'));
  assert.throws(()=>parseReport('not a spreadsheet'));
});
test('modelo preserva dados, detecta nome divergente e usa vencimento mais recente',async()=>{
  const {buildImport}=await import('../../pwa/js/import-model.mjs');
  const data=reports();data.vencimentos.push({...data.vencimentos[0],inicio:'01/08/2026',vencimento:'01/11/2026','status cliente':'Cancelado'});
  const model=buildImport(data,{students:[{student_id:'42',name:'ANA',phone:'manual',prescription_on:'2026-09-20'},{student_id:'99',name:'AUSENTE'}]});
  assert.equal(model.students[0].status,'Cancelado');assert.equal(model.students[0].phone,'manual');assert.equal(model.students[0].prescription_on,'2026-09-20');assert.equal(model.absent[0].id,'99');
  data.fichas[0].cliente='OUTRA PESSOA';assert.ok(buildImport(data).errors.length);
  data.fichas.push({...data.fichas[0],cliente:'ANA','data inicio':'20/09/2026'});assert.ok(buildImport(data).errors.length);
});
test('D1: prévia não grava base; confirmação preserva perfis, é atômica e idempotente',async()=>{
  const {db,sqlite}=database();
  sqlite.exec("INSERT INTO data_versions VALUES(1,'2026-09-01',1,'active','old','old'); INSERT INTO students VALUES('42','ANA','manual','Ativo',NULL,NULL,NULL,1,'old'); INSERT INTO students VALUES('99','AUSENTE','','Cancelado',NULL,NULL,NULL,1,'old'); INSERT INTO student_profiles VALUES('42','Elohim','bom_pagador','nota pagamento','manual importante','old','user');");
  const {call,job,files}=await stage(db);
  const p=await call('importPreview',{id:job.id});assert.equal(p.counts.newStudents,0);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM contracts').get().n,0);
  await assert.rejects(call('importConfirm',{id:job.id}),/backup/);
  const backup=await call('importBackup',{id:job.id});assert.equal(backup.tables.student_profiles[0].general_notes,'manual importante');
  const realBatch=db.batch;db.batch=async statements=>realBatch([...statements,db.prepare('INSERT INTO table_does_not_exist VALUES(1)').bind()]);
  await assert.rejects(call('importConfirm',{id:job.id}));
  assert.equal(sqlite.prepare("SELECT version_id FROM data_versions WHERE status='active'").get().version_id,1);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM contracts').get().n,0);
  db.batch=realBatch;await call('importConfirm',{id:job.id});await call('importConfirm',{id:job.id});
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM contracts').get().n,1);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM students').get().n,2);
  assert.equal(sqlite.prepare('SELECT general_notes FROM student_profiles').get().general_notes,'manual importante');
  assert.equal((await call('importStart',{reference:'2026-09-28',files})).status,'applied');
});
test('D1: lote incompleto, alteração concorrente e acesso por outra conta são bloqueados',async()=>{
  const {db,sqlite}=database();const {call,job}=await stage(db);
  const {importAction}=await import('../../worker/src/services/import-service.js');
  await assert.rejects(importAction(db,{email:'other@example.com'},'importPreview',{id:job.id}),/não encontrada/);
  sqlite.prepare("DELETE FROM weekly_upload_chunks WHERE type='fichas'").run();await assert.rejects(call('importPreview',{id:job.id}),/incompleto/);
  await call('importChunk',{id:job.id,type:'fichas',position:0,rows:reports().fichas});
  await call('importPreview',{id:job.id});await call('importBackup',{id:job.id});
  sqlite.exec("INSERT INTO data_versions VALUES(1,'2026-09-28',1,'active','now','now')");
  await assert.rejects(call('importConfirm',{id:job.id}),/mudou/);
});
test('data corrigida cria preparação nova para os mesmos arquivos ainda não aplicados',async()=>{
  const {db}=database();const {call,job,files}=await stage(db);
  const corrected=await call('importStart',{reference:'2026-09-27',files});assert.notEqual(corrected.id,job.id);
});
