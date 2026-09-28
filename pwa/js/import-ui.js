(function () {
  var panel, message, previewBox, controls, historyBox, busy = false, id = '', preview = null, backedUp = false;
  var labels = {vencimentos:'Vencimentos',fichas:'Fichas',avaliacoes:'Avaliação física',permanencia:'Clientes por permanência'};
  var fields = {name:'Nome',status:'Status',phone:'Telefone',plan_started_on:'Cliente desde',prescription_on:'Data da ficha',assessment_on:'Data da avaliação',full_name:'Contrato',frequency:'Frequência',value_cents:'Valor em centavos',current_started_on:'Início do contrato',expires_on:'Vencimento',contract_status:'Status do contrato',location:'Polo',modality:'Modalidade',student_id:'ID',customer_since:'Cliente desde',permanence_status:'Status de permanência',source_continuity_months:'Continuidade em meses',source_contract_count:'Quantidade de contratos',contract_key:'Identificação do contrato'};
  function describe(value) { if(value == null)return 'Não informado';if(typeof value!=='object')return String(value);return Object.keys(value).filter(function(k){return k!=='contract_key';}).map(function(k){return (fields[k]||k)+': '+describe(value[k]);}).join('; '); }
  var status = document.createElement('div'); status.className = 'upload-status'; status.hidden = true; status.setAttribute('role','status'); document.body.appendChild(status);
  function el(tag, text) { var n=document.createElement(tag); if(text)n.textContent=text;return n; }
  function say(text) { message.textContent=text;status.textContent=text;status.hidden=false; }
  function button(text, fn) { var b=el('button',text);b.type='button';b.addEventListener('click',fn);return b; }
  function setBusy(value) { busy=value;controls.disabled=value; }
  function download(value, name) { var url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000); }
  async function history() {
    try {var jobs=await window.XsteamApi.call('importHistory');historyBox.replaceChildren(el('h3','Importações recentes'));
      jobs.forEach(function(job){var row=el('p',job.reference_date+' — '+({uploading:'Envio em preparação',preview:'Prévia pronta',applied:'Aplicada'}[job.status]));
        row.appendChild(button('Abrir',async function(){if(busy)return;id=job.id;await refreshPreview();}));historyBox.appendChild(row);});
    }catch(e){historyBox.textContent='Histórico indisponível: '+e.message;}
  }
  function details(title, data) { var box=el('details'),summary=el('summary',title+' ('+data.length+')');box.appendChild(summary);
    data.forEach(function(item){box.appendChild(el('p', [item.id,item.name,item.reason,item.entity,fields[item.field]||item.field,item.kind,item.previous != null ? 'Anterior: '+describe(item.previous):'',item.incoming != null ? 'Novo: '+describe(item.incoming):'',item.value].filter(Boolean).join(' · ')));});return box; }
  async function refreshPreview() {
    setBusy(true);say('Comparando com a base atual…');
    try { preview=await window.XsteamApi.call('importPreview',{id:id});backedUp=false;showPreview();say(preview.status==='applied'?'Este lote já foi aplicado.':'Prévia pronta. Confira as mudanças antes de confirmar.');await history(); }
    catch(e){say(e.message);}finally{setBusy(false);}
  }
  function showPreview() {
    previewBox.replaceChildren(el('h3','Prévia — '+preview.reference));
    preview.files.forEach(function(f){previewBox.appendChild(el('p',labels[f.type]+': '+f.rows+' registros — '+f.name));});
    previewBox.appendChild(el('p',preview.counts.students+' alunos no lote; '+preview.counts.contracts+' contratos; '+preview.counts.newStudents+' alunos novos.'));
    previewBox.appendChild(details('Mudanças',preview.changes));previewBox.appendChild(details('Avisos',preview.warnings));previewBox.appendChild(details('Inconsistências que bloqueiam a importação',preview.errors));previewBox.appendChild(details('Ausentes no lote — cadastros preservados',preview.absent));
    previewBox.appendChild(button('Baixar relatório',function(){download(preview,'xsteam-importacao-'+preview.reference+'.json');}));
    if(preview.status==='applied'||preview.errors.length)return;
    var password=el('input'),confirmation=el('input');password.type=confirmation.type='password';password.autocomplete=confirmation.autocomplete='new-password';
    var pwLabel=el('label','Senha para proteger o backup anterior à importação'),confirmLabel=el('label','Repita a senha');pwLabel.appendChild(password);confirmLabel.appendChild(confirmation);previewBox.appendChild(pwLabel);previewBox.appendChild(confirmLabel);
    var backup=button('Baixar backup criptografado',async function(){
      if(busy)return;setBusy(true);backup.disabled=true;
      try{window.XsteamLocalBackup.validatePasswordPair(password.value,confirmation.value);say('Preparando backup da base atual…');var snapshot=await window.XsteamApi.call('importBackup',{id:id});var file=await window.XsteamLocalBackup.createEncryptedFile(snapshot,password.value);window.XsteamLocalBackup.download(file,'xsteam-antes-importacao-'+preview.reference+'.xsteam-backup');password.value='';confirmation.value='';backedUp=true;apply.disabled=false;say('Backup baixado. Guarde-o com a senha antes de confirmar.');}
      catch(e){say(e.message);}finally{setBusy(false);backup.disabled=false;}
    });previewBox.appendChild(backup);
    var apply=button('Confirmar atualização da base',async function(){
      if(busy||!backedUp)return;setBusy(true);apply.disabled=true;say('Aplicando atualização. Você pode continuar navegando no PWA…');
      try {await window.XsteamApi.call('importConfirm',{id:id});preview.status='applied';showPreview();say('Importação concluída. Atualizando os dados exibidos…');window.dispatchEvent(new Event('xsteam-import-complete'));await history();say('Importação concluída. Relatório disponível em Importar dados.');}
      catch(e){say(e.message+' Você pode gerar uma nova prévia ou tentar novamente.');apply.disabled=false;}
      finally{setBusy(false);}
    });apply.className='primary';apply.disabled=true;previewBox.appendChild(apply);previewBox.appendChild(button('Gerar nova prévia',function(){if(!busy)refreshPreview();}));
  }
  async function upload(files, reference) {
    if(busy)return;if(!reference){say('Informe a data de referência dos relatórios.');return;}
    setBusy(true);previewBox.replaceChildren();say('Lendo os quatro arquivos…');
    try {
      var reports=await new Promise(function(resolve,reject){var reader=new Worker('./js/import-reader.mjs',{type:'module'});reader.onmessage=function(e){reader.terminate();if(e.data.error)reject(new Error(e.data.error));else resolve(e.data.reports);};reader.onerror=function(){reader.terminate();reject(new Error('Não foi possível ler os arquivos.'));};reader.postMessage(Array.from(files));});
      var job=await window.XsteamApi.call('importStart',{reference:reference,files:reports.map(function(r){return {type:r.type,name:r.name,rows:r.rows.length,hash:r.hash};})});id=job.id;
      if(job.status==='uploading') {
        var total=reports.reduce(function(n,r){return n+Math.ceil(r.rows.length/100);},0),sent=0;
        for(var r of reports)for(var pos=0;pos<r.rows.length;pos+=100){say('Enviando dados: '+Math.round(sent/total*100)+'%. Pode continuar navegando.');await window.XsteamApi.call('importChunk',{id:id,type:r.type,position:pos/100,rows:r.rows.slice(pos,pos+100)});sent++;}
      }
      await refreshPreview();
    }catch(e){say(e.message+' Para retomar, selecione os mesmos arquivos.');}finally{setBusy(false);}
  }
  function render() {
    if(panel)return panel;
    panel=el('section');panel.className='upload-panel';panel.appendChild(el('h2','Importar dados da semana'));
    panel.appendChild(el('p','Selecione os quatro relatórios originais enviados pelo administrador. Dados manuais e cadastros ausentes serão preservados.'));
    var help=el('details');help.appendChild(el('summary','Como preparar os arquivos'));help.appendChild(el('p','Use Vencimentos, Fichas, Avaliação física e Clientes por permanência do mesmo envio. Aceitamos os arquivos XLS/HTML originais do TecnoFit, até 8 MB cada. Não é necessário renomeá-los. A data informada representa a referência do lote; as datas internas de contratos e avaliações são preservadas. Guarde os originais no seu computador.'));panel.appendChild(help);
    controls=el('fieldset');var ref=el('input');ref.type='date';var label=el('label','Data de referência do lote');label.appendChild(ref);controls.appendChild(label);
    var input=el('input');input.type='file';input.multiple=true;input.accept='.xls,.html,.htm';var fileLabel=el('label','Selecione ou arraste os quatro arquivos');fileLabel.appendChild(input);controls.appendChild(fileLabel);
    var selected=el('p');input.addEventListener('change',function(){selected.textContent=Array.from(input.files).map(function(f){return f.name;}).join(' · ');});controls.appendChild(selected);
    controls.appendChild(button('Preparar prévia',function(){upload(input.files,ref.value);}));
    controls.addEventListener('dragover',function(e){e.preventDefault();});controls.addEventListener('drop',function(e){e.preventDefault();if(!busy)upload(e.dataTransfer.files,ref.value);});
    panel.appendChild(controls);message=el('p');message.setAttribute('role','status');panel.appendChild(message);previewBox=el('div');panel.appendChild(previewBox);historyBox=el('div');panel.appendChild(historyBox);history();return panel;
  }
  window.addEventListener('beforeunload',function(e){if(busy){e.preventDefault();e.returnValue='';}});
  window.XsteamImport={render:render};
}());
