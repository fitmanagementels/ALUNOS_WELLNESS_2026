import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const markdownPath = path.join(root, 'CONTEXTO_DO_PROJETO.md');
const htmlPath = path.join(root, 'CONTEXTO_DO_PROJETO.html');
const markdown = fs.readFileSync(markdownPath, 'utf8');

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function sectionBody(title) {
  const marker = `## ${title}\n`;
  const start = markdown.indexOf(marker);
  if (start === -1) return '';
  const body = markdown.slice(start + marker.length);
  const next = body.indexOf('\n## ');
  return (next === -1 ? body : body.slice(0, next)).trim();
}

const externalContext = sectionBody('Contexto completo para IA externa');
const escapedMarkdown = escapeHtml(markdown);
const escapedExternal = escapeHtml(externalContext);

const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Contexto do Projeto — XSTEAM Gestão</title>
  <style>
    :root{color-scheme:dark;--bg:#090c0b;--card:#121816;--active:#1b2420;--overlay:#202723;--text:#f3f6f2;--muted:#aab4af;--soft:#7f8b86;--line:#303b36;--accent:#dcff24;--warn:#ffc45c;--radius:14px;--focus:0 0 0 3px rgba(220,255,36,.24)}
    *{box-sizing:border-box}html{scroll-behavior:smooth;background:var(--bg)}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}body.modal-open{overflow:hidden}button,input,textarea{font:inherit}button,input,textarea,summary{outline:none}button:focus-visible,input:focus-visible,textarea:focus-visible,summary:focus-visible,a:focus-visible{box-shadow:var(--focus)}[hidden]{display:none!important}
    .shell{width:min(1180px,calc(100% - 30px));margin:auto}.header{border-bottom:1px solid var(--line);padding:24px 0}.eyebrow{margin:0;color:var(--accent);font-size:.75rem;font-weight:850;letter-spacing:.13em;text-transform:uppercase}h1{margin:4px 0;font-size:clamp(1.55rem,4vw,2.35rem)}.meta{margin:0;color:var(--muted)}main{padding:22px 0 70px}.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}.card{padding:15px;border:1px solid var(--line);border-radius:var(--radius);background:var(--card)}.card strong{display:block;margin-bottom:5px;color:var(--accent)}.card span{color:var(--muted)}.card.risk{border-color:#775f31}.card.risk strong{color:var(--warn)}
    .toolbar{position:sticky;top:0;z-index:5;display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:10px;padding:10px;margin-bottom:10px;border:1px solid var(--line);border-radius:var(--radius);background:rgba(18,24,22,.96);backdrop-filter:blur(12px)}.search{min-height:44px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text)}.actions{display:flex;flex-wrap:wrap;gap:7px}.button{min-height:44px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:var(--active);color:var(--text);cursor:pointer}.button.primary{border-color:var(--accent);background:var(--accent);color:#101400;font-weight:800}.status{min-height:20px;margin:4px 2px 12px;color:var(--soft);font-size:.82rem}.quick-nav{display:flex;gap:6px;overflow:auto;padding:2px 0 12px}.quick-nav a{flex:0 0 auto;padding:7px 10px;border:1px solid var(--line);border-radius:999px;color:var(--muted);text-decoration:none}
    details{border-top:1px solid var(--line);background:var(--bg)}details:last-child{border-bottom:1px solid var(--line)}details[open]{background:var(--card)}summary{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;cursor:pointer;font-weight:800;list-style:none}summary::-webkit-details-marker{display:none}summary::after{content:"+";color:var(--soft);font-size:1.25rem}details[open]>summary::after{content:"−"}.section-body{margin:0;padding:0 16px 22px;color:var(--muted);white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.62 ui-monospace,SFMono-Regular,Consolas,monospace}.empty{padding:28px;border:1px dashed var(--line);border-radius:var(--radius);text-align:center;color:var(--muted)}
    .viewer{position:fixed;inset:0;z-index:20}.backdrop{position:absolute;inset:0;border:0;background:rgba(0,0,0,.75)}.panel{position:absolute;inset:0 0 0 auto;width:min(900px,92vw);display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:var(--overlay);border-left:1px solid var(--line);box-shadow:-20px 0 60px rgba(0,0,0,.45)}.panel-head,.panel-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 16px;border-bottom:1px solid var(--line)}.panel-foot{border-top:1px solid var(--line);border-bottom:0;justify-content:flex-end}.viewer textarea{width:100%;height:100%;resize:none;border:0;padding:18px;background:var(--card);color:var(--text);font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}.manual{margin-top:12px;padding:14px;border:1px solid var(--line);border-radius:var(--radius);background:var(--active)}.manual textarea{width:100%;min-height:150px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text)}
    @media(max-width:820px){.cards{grid-template-columns:1fr 1fr}.toolbar{position:static;grid-template-columns:1fr}.actions{display:grid;grid-template-columns:1fr 1fr}.panel{width:100%}}@media(max-width:480px){.cards{grid-template-columns:1fr}.shell{width:min(100% - 20px,1180px)}}
  </style>
</head>
<body>
  <header class="header"><div class="shell"><p class="eyebrow">XSTEAM · memória portátil canônica</p><h1>Contexto do Projeto</h1><p class="meta">Atualizado em 24/09/2026 09:05 · PWA operacional + dashboard · migração Cloudflare em desenvolvimento</p></div></header>
  <main class="shell">
    <section class="cards" aria-label="Resumo rápido">
      <div class="card"><strong>Produção</strong><span>Arquitetura Google antiga permanece ativa e funcional.</span></div>
      <div class="card"><strong>Marco revisto</strong><span>1ea33ed · 34 testes locais aprovados.</span></div>
      <div class="card"><strong>Cloudflare</strong><span>D1 populado; Worker, Access e R2 ainda não concluídos.</span></div>
      <div class="card risk"><strong>Gate atual</strong><span>Habilitar R2 e configurar Access antes do deploy protegido.</span></div>
    </section>
    <section class="toolbar" aria-label="Ferramentas">
      <input id="search" class="search" type="search" placeholder="Buscar na memória" aria-label="Buscar na memória">
      <div class="actions"><button class="button" id="expand" type="button">Expandir tudo</button><button class="button" id="collapse" type="button">Recolher</button><button class="button" id="view" type="button">Ver Markdown</button><button class="button primary" id="copyExternal" type="button">Copiar contexto para IA</button><button class="button" id="download" type="button">Baixar .md</button></div>
    </section>
    <div id="searchStatus" class="status" aria-live="polite"></div>
    <nav id="quickNav" class="quick-nav" aria-label="Navegação rápida"></nav>
    <section id="sections" aria-label="Conteúdo do contexto"></section>
    <section id="manualCopy" class="manual" hidden><label for="manualCopyText">Cópia automática indisponível. Selecione o texto:</label><textarea id="manualCopyText" readonly></textarea></section>
  </main>
  <div id="viewer" class="viewer" hidden role="dialog" aria-modal="true" aria-labelledby="viewerTitle"><button class="backdrop" id="closeBackdrop" type="button" aria-label="Fechar"></button><section class="panel"><header class="panel-head"><div><strong id="viewerTitle">Markdown canônico</strong><div class="meta">Conteúdo integral do arquivo</div></div><button class="button" id="close" type="button">Fechar</button></header><textarea id="viewerText" readonly></textarea><footer class="panel-foot"><button class="button primary" id="copyMarkdown" type="button">Copiar Markdown</button></footer></section></div>
  <textarea id="markdownSource" hidden>${escapedMarkdown}</textarea>
  <textarea id="externalContextSource" hidden>${escapedExternal}</textarea>
  <script>
    (function(){
      var source=document.getElementById('markdownSource').value;
      var external=document.getElementById('externalContextSource').value;
      var sections=document.getElementById('sections'),nav=document.getElementById('quickNav');
      var blocks=source.split(/^## /m);blocks.shift();
      function slug(value){return value.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
      blocks.forEach(function(block,index){var lineEnd=block.indexOf('\\n'),title=(lineEnd===-1?block:block.slice(0,lineEnd)).trim(),body=lineEnd===-1?'':block.slice(lineEnd+1).trim(),id=slug(title)||('secao-'+index),details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre'),link=document.createElement('a');details.className='memory-section';details.id=id;details.open=index<2||title==='Estado atual'||title==='Riscos, bloqueios, divergências e pendências'||title==='Contexto para outro chat ou IA';summary.textContent=title;pre.className='section-body';pre.textContent=body;details.append(summary,pre);sections.appendChild(details);link.href='#'+id;link.textContent=title;nav.appendChild(link);});
      var search=document.getElementById('search'),status=document.getElementById('searchStatus');
      search.addEventListener('input',function(){var query=search.value.trim().toLocaleLowerCase('pt-BR'),visible=0;document.querySelectorAll('.memory-section').forEach(function(item){var show=!query||item.textContent.toLocaleLowerCase('pt-BR').includes(query);item.hidden=!show;if(show){visible+=1;if(query)item.open=true;}});status.textContent=query?(visible+' seção(ões) encontrada(s).'):'';});
      document.getElementById('expand').onclick=function(){document.querySelectorAll('.memory-section:not([hidden])').forEach(function(item){item.open=true;});};
      document.getElementById('collapse').onclick=function(){document.querySelectorAll('.memory-section').forEach(function(item){item.open=false;});};
      var viewer=document.getElementById('viewer'),viewerText=document.getElementById('viewerText');viewerText.value=source;
      function openViewer(){viewer.hidden=false;document.body.classList.add('modal-open');document.getElementById('close').focus();}
      function closeViewer(){viewer.hidden=true;document.body.classList.remove('modal-open');document.getElementById('view').focus();}
      document.getElementById('view').onclick=openViewer;document.getElementById('close').onclick=closeViewer;document.getElementById('closeBackdrop').onclick=closeViewer;document.addEventListener('keydown',function(event){if(event.key==='Escape'&&!viewer.hidden)closeViewer();});
      function manual(value){var box=document.getElementById('manualCopy'),area=document.getElementById('manualCopyText');area.value=value;box.hidden=false;area.focus();area.select();}
      async function copy(value){try{await navigator.clipboard.writeText(value);status.textContent='Texto copiado.';}catch(_){manual(value);status.textContent='Use a seleção manual exibida abaixo.';}}
      document.getElementById('copyExternal').onclick=function(){copy(external);};document.getElementById('copyMarkdown').onclick=function(){copy(source);};
      document.getElementById('download').onclick=function(){var url=URL.createObjectURL(new Blob([source],{type:'text/markdown;charset=utf-8'})),anchor=document.createElement('a');anchor.href=url;anchor.download='CONTEXTO_DO_PROJETO.md';anchor.click();setTimeout(function(){URL.revokeObjectURL(url);},0);};
    }());
  </script>
</body>
</html>`;

function decodeEmbedded(value) {
  return value.replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
}

const embeddedMarkdown = html.match(/<textarea id="markdownSource" hidden>([\s\S]*?)<\/textarea>/)?.[1] || '';
const embeddedExternal = html.match(/<textarea id="externalContextSource" hidden>([\s\S]*?)<\/textarea>/)?.[1] || '';
if (decodeEmbedded(embeddedMarkdown) !== markdown) throw new Error('HTML não contém o Markdown integral.');
if (!externalContext || decodeEmbedded(embeddedExternal) !== externalContext) {
  throw new Error('HTML não contém o contexto externo integral.');
}

fs.writeFileSync(htmlPath, html);
