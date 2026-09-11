(function () {
  var state = { page: 'home', subpage: 'planos', bootstrap: null, filters: {}, leadFilter: 'todos', followCategory: '', settingsSection: 'alertas', settingsAlertKind: 'prescricoes', settingsDirty: false, settingsAlertDraft: null, settingsHomeDraft: null, profilesExpanded: false, mutationQueue: [], failedMutations: [], saving: false, churnFilters: null, churnCharts: [], churnAnalyticsRequest: 0, churnAnalyticsCache: Object.create(null), backgroundSyncTimer: null };
  var cacheKey = 'xsteam-dashboard-bootstrap-v5:publico';
  var labels = { home: 'Home', financeiro: 'Financeiro', acompanhamento: 'Acompanhamento', fluxo: 'Fluxo', configuracoes: 'Configurações' };

  function el(tag, className, text) { var node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = String(text); return node; }
  function clear(node) { node.replaceChildren(); }
  function money(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0); }
  function number(v) { return new Intl.NumberFormat('pt-BR').format(Number(v) || 0); }
  function parseDate(v) { var parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || '')); return parts ? new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]), 12) : null; }
  function dayDiff(a, b) { if (!a) return null; return Math.round((b - a) / 86400000); }
  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); }
  function inputDate(v) { var d=parseDate(v); return d ? d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') : ''; }
  function dashboardDate(v) { var p=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v||'')); return p ? p[3]+'/'+p[2]+'/'+p[1] : ''; }
  function inicioSemana(v) { var d=v instanceof Date ? new Date(v.getTime()) : parseDate(v); if(!d)return null;d.setDate(d.getDate()-((d.getDay()+6)%7));return d; }
  function inputDateFromDate(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function filtrosChurnPadrao() { var inicio=inicioSemana(today()), fim=new Date(inicio.getFullYear(),inicio.getMonth(),inicio.getDate()+6,12), primeiro=new Date(inicio.getFullYear(),inicio.getMonth(),inicio.getDate()-(25*7),12);return{mesInicio:'',mesFim:'',semanaInicio:inputDateFromDate(primeiro),semanaFim:inputDateFromDate(fim)}; }
  function filtrosChurn() { if(!state.churnFilters)state.churnFilters=filtrosChurnPadrao();return state.churnFilters; }
  function safeCacheGet() { try { return JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch (e) { return null; } }
  function safeCacheSet(v) { try { localStorage.setItem(cacheKey, JSON.stringify(v)); } catch (e) {} }
  function call(name, argument) { var actions={ obterBootstrapDashboard:'bootstrap', obterVersaoDashboard:'versao', salvarMutacoesDashboard:'salvarMutacoes', obterAnaliseChurnsDashboard:'analiseChurn' }; return XsteamApi.call(actions[name], argument); }
  function setProgress(value) { document.getElementById('loading-progress').style.width = value + '%'; }
  function finishLoading() { setProgress(100); setTimeout(function () { document.getElementById('loading-screen').hidden = true; }, 180); }
  function setSave(text) { document.getElementById('saveStatus').textContent = text || ''; }
  function setRetryVisible(visible) { var button=document.getElementById('retryMutations'); if(button)button.hidden=!visible; }
  function writeOption(select, value, text) { var o = el('option', '', text); o.value = value; select.appendChild(o); }
  function isEnrolledStatus(status) {
    var normalized = String(status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    return ['ativo', 'bloqueado', 'licenca', 'em licenca'].indexOf(normalized) !== -1;
  }

  function filtered() {
    var base = state.bootstrap || { alunos: [], contratos: [] };
    var students = base.alunos.filter(function (p) {
      return !state.filters.status || (state.filters.status === '__matriculados__'
        ? isEnrolledStatus(p.status)
        : p.status === state.filters.status);
    });
    var ids = Object.create(null); students.forEach(function (p) { ids[p.id] = true; });
    var contracts = base.contratos.filter(function (c) { return ids[c.id] && (!state.filters.polo || c.polo === state.filters.polo); });
    var contractIds = Object.create(null); contracts.forEach(function (c) { contractIds[c.id] = true; });
    return { alunos: students.filter(function (p) { return contractIds[p.id]; }), contratos: contracts };
  }
  function groupedContracts(contracts) { return contracts.reduce(function (m, c) { (m[c.id] || (m[c.id] = [])).push(c); return m; }, Object.create(null)); }
  function profileMap() { return (state.bootstrap.configuracao.perfisPagamento || []).reduce(function (m, p) { m[p.id] = p; return m; }, Object.create(null)); }
  function classify(person, kind, rulesOverride) {
    var data = parseDate(kind === 'prescricoes' ? person.dataFicha : person.dataAvaliacao); var days = dayDiff(data, today());
    var r = rulesOverride || state.bootstrap.configuracao.alertas[kind] || {};
    if (days === null) return { state: kind === 'prescricoes' ? 'sem_ficha' : 'sem_avaliacao', days: null, priority: 0 };
    if (days <= r.laranja) return { state: 'verde', days: days, priority: 5 };
    if (days <= r.vermelho) return { state: 'laranja', days: days, priority: 4 };
    if (days <= r.roxo) return { state: 'vermelho', days: days, priority: 3 };
    if (kind === 'avaliacoes' && days > r.critico) return { state: 'falha_critica', days: days, priority: 1 };
    return { state: 'roxo', days: days, priority: 2 };
  }
  function chip(value) { return el('span', 'chip estado-' + value, stateLabel(value)); }
  function stateLabel(v) { return ({ verde:'Em dia', laranja:'Atenção', vermelho:'Prioridade alta', roxo:'Prioridade máxima', falha_critica:'Falha crítica de processo', sem_ficha:'Sem ficha registrada', sem_avaliacao:'Sem avaliação registrada' })[v] || v; }
  function followDefinitions(kind) {
    return kind === 'prescricoes' ? [
      { state: 'sem_ficha', label: 'Sem ficha', note: 'Nunca registrada' },
      { state: 'roxo', label: 'Crítico', note: 'Acima do maior limite' },
      { state: 'vermelho', label: 'Muito atrasado', note: 'Intervenção necessária' },
      { state: 'laranja', label: 'Atrasado', note: 'Entrou na fila de revisão' }
    ] : [
      { state: 'sem_avaliacao', label: 'Sem avaliação', note: 'Nunca registrada' },
      { state: 'falha_critica', label: 'Falha crítica', note: 'Acima do limite crítico' },
      { state: 'roxo', label: 'Crítico', note: 'Prioridade máxima' },
      { state: 'vermelho', label: 'Muito atrasada', note: 'Intervenção necessária' },
      { state: 'laranja', label: 'Atrasada', note: 'Entrou na fila de revisão' }
    ];
  }
  function groupFollowQueue(kind, people) {
    return followDefinitions(kind).map(function (definition) {
      return Object.assign({}, definition, {
        people: people.filter(function (person) {
          return person.classification.state === definition.state;
        })
      });
    });
  }
  function openFollowQueue(kind, stateName) {
    state.subpage = kind;
    state.followCategory = stateName || '';
    activate('acompanhamento');
  }
  function card(label, value, note, action) { var b = el('button', 'kpi'); b.type = 'button'; b.appendChild(el('span', 'label', label)); b.appendChild(el('strong', '', value)); if (note) b.appendChild(el('em', '', note)); if (action) b.addEventListener('click', action); return b; }
  function section(title) { var box = el('section', 'section-card'); box.appendChild(el('h3', '', title)); return box; }
  function barList(items, select) { var list = el('div', 'bar-list'); var max = Math.max.apply(null, items.map(function (x) { return x.value; }).concat([1])); items.forEach(function (item) { var row = el('button', 'bar-row'); row.type = 'button'; row.appendChild(el('span', '', item.label)); var bar = el('span', 'bar'); var fill = el('span'); fill.style.width = (item.value / max * 100) + '%'; bar.appendChild(fill); row.appendChild(bar); row.appendChild(el('strong', '', number(item.value))); if (select) row.addEventListener('click', function () { select(item); }); list.appendChild(row); }); return list; }

  function showDetail(title, people) {
    var dialog = document.getElementById('detailDialog'); var target = document.getElementById('detailContent'); clear(target); document.getElementById('detailTitle').textContent = title;
    if (!people.length) target.appendChild(el('p', 'body-copy', 'Nenhum registro neste recorte.'));
    people.forEach(function (item) { var row = el('article', 'student-row'); row.appendChild(el('h3', '', item.aluno)); if (item.classification) row.appendChild(chip(item.classification.state)); row.appendChild(el('p', 'body-copy', (item.classification && item.classification.days !== null ? item.classification.days + ' dias • ' : '') + money(item.valorMensal || 0) + ' • ' + (item.profile || 'Sem histórico'))); var list = el('ul', 'contract-list'); (item.contratos || []).forEach(function (c) { list.appendChild(el('li', '', (c.contrato || c.frequencia || 'Contrato') + ' — ' + money(c.valor) + (c.vencimento ? ' — ' + c.vencimento : ''))); }); row.appendChild(list); target.appendChild(row); }); dialog.showModal();
  }
  function peopleFor(kind) { var f = filtered(), byId = groupedContracts(f.contratos), profiles = profileMap(); return f.alunos.map(function (p) { var cs = byId[p.id] || []; return { id:p.id, aluno:p.aluno, status:p.status, lastDate:kind === 'prescricoes' ? p.dataFicha : p.dataAvaliacao, contratos:cs, valorMensal:cs.reduce(function(s,c){return s+c.valor;},0), profile:(profiles[p.id]||{}).perfilPagamento || 'Sem histórico', classification: classify(p, kind) }; }).sort(function(a,b){ var daysA=a.classification.days==null?-1:a.classification.days,daysB=b.classification.days==null?-1:b.classification.days;return a.classification.priority-b.classification.priority || daysB-daysA || a.aluno.localeCompare(b.aluno,'pt-BR'); }); }
  function valorPorAula(contrato) {
    var match = /^(\d+)\s*x\b/i.exec(String(contrato.frequencia || '').trim());
    var vezesSemana = match ? Number(match[1]) : 0;
    return vezesSemana ? Number(contrato.valor || 0) / (vezesSemana * 4.33) : null;
  }
  function showFinancialDetail(title, contracts) {
    var dialog = document.getElementById('detailDialog'), target = document.getElementById('detailContent'), byId = groupedContracts(contracts);
    clear(target); document.getElementById('detailTitle').textContent = title;
    target.appendChild(el('p', 'body-copy', 'Faturamento do recorte: ' + money(contracts.reduce(function (sum, contract) { return sum + Number(contract.valor || 0); }, 0)) + ' • ' + number(contracts.length) + ' contrato(s)'));
    Object.keys(byId).map(function (id) { return (state.bootstrap.alunos || []).filter(function (person) { return person.id === id; })[0] || { id: id, aluno: id }; }).sort(function (a, b) { return a.aluno.localeCompare(b.aluno, 'pt-BR'); }).forEach(function (person) {
      var row = el('article', 'student-row'), list = el('ul', 'contract-list');
      row.appendChild(el('h3', '', person.aluno));
      byId[person.id].forEach(function (contract) { list.appendChild(el('li', '', (contract.frequencia || 'Frequência não informada') + ' — ' + money(contract.valor))); });
      row.appendChild(list); target.appendChild(row);
    });
    dialog.showModal();
  }
  function showHourlyValueDetail(contracts) {
    var dialog = document.getElementById('detailDialog'), target = document.getElementById('detailContent'), people = Object.create(null), valid = contracts.map(valorPorAula).filter(function (value) { return value !== null; });
    (state.bootstrap.alunos || []).forEach(function (person) { people[person.id] = person; });
    clear(target); document.getElementById('detailTitle').textContent = 'Valor por hora-aula';
    target.appendChild(el('p', 'body-copy', 'Hora-aula média: ' + (valid.length ? money(valid.reduce(function (sum, value) { return sum + value; }, 0) / valid.length) : '—')));
    contracts.slice().sort(function (a, b) { return String((people[a.id] || {}).aluno || a.id).localeCompare(String((people[b.id] || {}).aluno || b.id), 'pt-BR'); }).forEach(function (contract) {
      var person = people[contract.id] || { aluno: contract.id }, row = el('article', 'student-row'), hourly = valorPorAula(contract);
      row.appendChild(el('h3', '', person.aluno));
      row.appendChild(el('p', 'body-copy', 'Valor do plano: ' + money(contract.valor)));
      row.appendChild(el('p', 'body-copy', 'Valor por hora-aula: ' + (hourly === null ? '—' : money(hourly))));
      target.appendChild(row);
    });
    dialog.showModal();
  }
  function renderPlans(data) {
    var grid = el('div', 'kpi-grid'), unique = Object.create(null), total = data.contratos.reduce(function (sum, contract) { unique[contract.id] = true; return sum + Number(contract.valor || 0); }, 0), frequencies = {}, hourlyValues = data.contratos.map(valorPorAula).filter(function (value) { return value !== null; });
    data.contratos.forEach(function (contract) { var label = contract.frequencia || 'Não informado'; frequencies[label] = (frequencies[label] || 0) + 1; });
    grid.appendChild(card('Faturamento', money(total), 'Contratos no filtro', function () { showFinancialDetail('Contratos no filtro', data.contratos); }));
    grid.appendChild(card('Alunos', number(Object.keys(unique).length), 'Pessoas únicas'));
    grid.appendChild(card('Contratos', number(data.contratos.length), 'Ativos no recorte'));
    grid.appendChild(card('Ticket por aluno', money(Object.keys(unique).length ? total / Object.keys(unique).length : 0), 'Hora-aula média: ' + (hourlyValues.length ? money(hourlyValues.reduce(function (sum, value) { return sum + value; }, 0) / hourlyValues.length) : '—'), function () { showHourlyValueDetail(data.contratos); }));
    var box = section('Distribuição por frequência');
    box.appendChild(barList(Object.keys(frequencies).sort().map(function (label) { return { label: label, value: frequencies[label] }; }), function (item) { showFinancialDetail('Plano ' + item.label, data.contratos.filter(function (contract) { return (contract.frequencia || 'Não informado') === item.label; })); }));
    return [grid, box];
  }
  function dueBuckets(data) { var h=today(), result={previous:[],today:[],next:[], timeline:[], month:[0,0,0,0]}; for(var i=-5;i<=5;i++)result.timeline.push({label:i===0?'Hoje':(i<0?Math.abs(i)+'d atrás':'+'+i+'d'),value:0,day:i}); data.contratos.forEach(function(c){var d=dayDiff(parseDate(c.vencimento),h)*-1; if(d>=-5&&d<=-1)result.previous.push(c); if(d===0)result.today.push(c); if(d>=1&&d<=5)result.next.push(c); result.timeline.forEach(function(x){if(x.day===d)x.value++;}); var date=parseDate(c.vencimento); if(date&&date.getFullYear()===h.getFullYear()&&date.getMonth()===h.getMonth()){var q=date.getDate()<=7?0:date.getDate()<=15?1:date.getDate()<=23?2:3;result.month[q]++;}}); return result; }
  function detailsForContracts(title, contracts) { var by=groupedContracts(contracts), people=(state.bootstrap.alunos||[]).filter(function(p){return by[p.id];}).map(function(p){return{aluno:p.aluno,contratos:by[p.id],valorMensal:by[p.id].reduce(function(s,c){return s+c.valor;},0),profile:(profileMap()[p.id]||{}).perfilPagamento||'Sem histórico'};}); showDetail(title,people); }
  function contractsForMonthQuartile(contracts, quartile) {
    var ranges = [[1, 7], [8, 15], [16, 23], [24, 31]], range = ranges[Number(quartile)], current = today();
    if (!range) return [];
    return contracts.filter(function (contract) {
      var date = parseDate(contract.vencimento);
      return date && date.getFullYear() === current.getFullYear() && date.getMonth() === current.getMonth() && date.getDate() >= range[0] && date.getDate() <= range[1];
    });
  }
  function renderDue(data) {
    var b = dueBuckets(data), grid = el('div', 'kpi-grid');
    [['Últimos 5 dias', b.previous], ['Vencem hoje', b.today], ['Próximos 5 dias', b.next]].forEach(function (item) { grid.appendChild(card(item[0], number(item[1].length), 'contratos', function () { detailsForContracts(item[0], item[1]); })); });
    var timeline = section('Linha do tempo — 11 dias');
    timeline.appendChild(barList(b.timeline, function (item) { detailsForContracts(item.label, data.contratos.filter(function (contract) { return -dayDiff(parseDate(contract.vencimento), today()) === item.day; })); }));
    var heat = section('Mapa do mês');
    heat.appendChild(barList(['1–7', '8–15', '16–23', '24–fim'].map(function (label, index) { return { label: label, value: b.month[index], quartile: index }; }), function (i) { detailsForContracts(i.label, contractsForMonthQuartile(data.contratos, i.quartile)); }));
    return [grid, timeline, heat];
  }
  function showPermanenceDetail(title, rows) {
    var dialog = document.getElementById('detailDialog'), target = document.getElementById('detailContent');
    clear(target); document.getElementById('detailTitle').textContent = title;
    if (!rows.length) target.appendChild(el('p', 'body-copy', 'Nenhum cliente neste recorte.'));
    rows.forEach(function (item) {
      var row = el('article', 'student-row permanence-detail');
      row.appendChild(el('h3', '', item.aluno || item.id));
      row.appendChild(el('p', 'body-copy', 'Cliente desde: ' + (item.clienteDesde || 'Sem data')));
      row.appendChild(el('p', 'body-copy', 'Tempo na empresa: ' + item.relationship));
      row.appendChild(el('p', 'body-copy', 'Status: ' + (item.status || 'Não informado')));
      row.appendChild(el('p', 'body-copy', 'Coorte: ' + item.cohortLabel));
      row.appendChild(el('p', 'body-copy', 'Contratos históricos: ' + number(item.historicalContracts)));
      var packages = el('div', 'permanence-packages');
      if (!item.packages.length) packages.appendChild(el('span', '', 'Sem pacote atual'));
      item.packages.forEach(function (entry) {
        packages.appendChild(el('span', '', 'Pacote atual: ' + (entry.name || 'Não informado') + ' — ' + money(entry.value)));
      });
      row.appendChild(packages); target.appendChild(row);
    });
    dialog.showModal();
  }
  function renderPermanence(data) {
    var analysis = window.XSteamPermanencia.buildAnalysis({
      permanence: state.bootstrap.permanencia || [],
      currentStudents: data.alunos || [],
      contracts: data.contratos || [],
      events: state.bootstrap.eventosPermanencia || []
    }, today());
    function rowsFor(ids) {
      var selected = Object.create(null); (ids || []).forEach(function (id) { selected[String(id)] = true; });
      return analysis.historicalRows.filter(function (row) { return selected[row.id]; });
    }
    var intro = el('section', 'permanence-intro');
    intro.appendChild(el('span', 'eyebrow', 'RELACIONAMENTO COM CLIENTES'));
    intro.appendChild(el('h2', '', 'Há quanto tempo cada aluno está conosco'));
    intro.appendChild(el('p', 'body-copy', 'Tempo na empresa e pacote atual são apresentados separadamente. A cobertura indica quantos alunos do recorte têm data de entrada conhecida.'));
    var grid = el('div', 'kpi-grid');
    grid.appendChild(card('Cobertura da entrada', number(analysis.kpis.coveragePercent) + '%', number(analysis.kpis.withStartDate) + ' de ' + number(analysis.kpis.currentStudents) + ' alunos'));
    grid.appendChild(card('Tempo mediano', analysis.kpis.medianMonths == null ? '—' : window.XSteamPermanencia.relationshipLabel(analysis.kpis.medianMonths), 'Alunos atuais com data'));
    grid.appendChild(card('Novos no último lote', number(analysis.kpis.newInLastBatch), 'Sem contar a carga inicial'));
    grid.appendChild(card('Mudanças de status', number(analysis.kpis.statusChangesInLastBatch), number(analysis.kpis.absentInLastBatch) + ' ausente(s) no último lote'));
    var distributions = el('div', 'permanence-grid');
    var bands = section('Faixas de relacionamento');
    bands.appendChild(barList(analysis.bands, function (item) {
      showPermanenceDetail(item.label, rowsFor(item.ids));
    }));
    var cohorts = section('Coortes de entrada');
    var cohortList = el('div', 'permanence-cohort-list');
    if (!analysis.cohorts.length) cohortList.appendChild(el('p', 'body-copy', 'Ainda não há datas de entrada válidas.'));
    analysis.cohorts.slice().reverse().forEach(function (cohort) {
      var button = el('button', 'permanence-cohort'); button.type = 'button';
      button.appendChild(el('strong', '', cohort.label));
      button.appendChild(el('span', '', number(cohort.total) + ' clientes'));
      button.appendChild(el('em', '', number(cohort.observedRetentionPercent) + '% matriculados observados'));
      button.addEventListener('click', function () { showPermanenceDetail('Coorte ' + cohort.label, rowsFor(cohort.ids)); });
      cohortList.appendChild(button);
    });
    cohorts.appendChild(cohortList); distributions.appendChild(bands); distributions.appendChild(cohorts);
    var list = section('Clientes por tempo de relacionamento'), rows = el('div', 'permanence-list');
    if (!analysis.rows.length) rows.appendChild(el('p', 'body-copy', 'Nenhum aluno no recorte atual.'));
    analysis.rows.forEach(function (item) {
      var row = el('button', 'permanence-row'); row.type = 'button';
      var identity = el('span', 'permanence-identity');
      identity.appendChild(el('strong', '', item.aluno || item.id));
      identity.appendChild(el('small', '', item.clienteDesde || 'Sem data de entrada'));
      row.appendChild(identity);
      row.appendChild(el('span', '', item.relationship));
      row.appendChild(el('span', '', item.status || 'Status não informado'));
      var packages = el('span', 'permanence-packages');
      if (!item.packages.length) packages.appendChild(el('span', '', 'Sem pacote atual'));
      item.packages.forEach(function (entry) { packages.appendChild(el('span', '', (entry.name || 'Pacote') + ' — ' + money(entry.value))); });
      row.appendChild(packages);
      row.appendChild(el('span', 'permanence-action', 'Ver detalhes'));
      row.addEventListener('click', function () { showPermanenceDetail(item.aluno || item.id, [item]); });
      rows.appendChild(row);
    });
    list.appendChild(rows);
    return [intro, grid, distributions, list];
  }
  function showFollowDetail(kind, person) {
    var dialog = document.getElementById('detailDialog'), target = document.getElementById('detailContent');
    clear(target);
    document.getElementById('detailTitle').textContent = kind === 'prescricoes' ? 'Detalhe da ficha' : 'Detalhe da avaliação';
    var row = el('article', 'student-row follow-detail');
    row.appendChild(el('h3', '', person.aluno));
    row.appendChild(el('p', 'body-copy', person.id + ' • ' + (person.status || 'Status não informado')));
    row.appendChild(chip(person.classification.state));
    row.appendChild(el('p', 'body-copy', person.classification.days == null ? 'Sem registro interno' : person.classification.days + ' dias desde o último registro'));
    row.appendChild(el('p', 'body-copy', 'Último registro: ' + (person.lastDate || '—')));
    target.appendChild(row);
    dialog.showModal();
  }
  function renderFollowFilters(kind, groups) {
    var filters = el('div', 'follow-filter-row'), total = groups.reduce(function (sum, group) { return sum + group.people.length; }, 0);
    [{ state: '', label: 'Todas', people: new Array(total) }].concat(groups).forEach(function (group) {
      var button = el('button', 'follow-filter' + (state.followCategory === group.state ? ' active' : ''));
      button.type = 'button';
      button.setAttribute('aria-pressed', String(state.followCategory === group.state));
      button.appendChild(el('span', '', group.label));
      button.appendChild(el('strong', '', number(group.people.length)));
      button.addEventListener('click', function () { state.followCategory = group.state; render(); });
      filters.appendChild(button);
    });
    return filters;
  }
  function renderFollowList(kind, people) {
    var box = el('section', 'section-card follow-list-card'), list = el('div', 'follow-list');
    if (!people.length) {
      list.appendChild(el('p', 'body-copy follow-empty', 'Nenhuma pendência neste recorte.'));
    }
    people.forEach(function (person) {
      var row = el('article', 'follow-row'), identity = el('div', 'follow-identity');
      identity.appendChild(el('strong', '', person.aluno));
      identity.appendChild(el('small', '', person.id + ' • ' + (person.status || 'Status não informado')));
      row.appendChild(identity);
      row.appendChild(chip(person.classification.state));
      row.appendChild(el('span', 'follow-days', person.classification.days == null ? 'Sem registro' : person.classification.days + ' dias'));
      row.appendChild(el('span', 'follow-date', person.lastDate || '—'));
      var action = el('button', 'secondary', kind === 'prescricoes' ? 'Ver ficha' : 'Ver avaliação');
      action.type = 'button';
      action.addEventListener('click', function () { showFollowDetail(kind, person); });
      row.appendChild(action);
      list.appendChild(row);
    });
    box.appendChild(list);
    return box;
  }
  function renderFollow(kind) {
    var all = peopleFor(kind), groups = groupFollowQueue(kind, all), actionable = [];
    groups.forEach(function (group) { actionable = actionable.concat(group.people); });
    var selected = state.followCategory ? actionable.filter(function (person) { return person.classification.state === state.followCategory; }) : actionable;
    var hero = el('section', 'follow-hero');
    hero.appendChild(el('span', 'eyebrow', 'PRIORIDADES DE HOJE'));
    hero.appendChild(el('h2', '', kind === 'prescricoes' ? 'Fichas / prescrições' : 'Avaliações'));
    hero.appendChild(el('p', 'body-copy', number(actionable.length) + ' registros precisam de revisão.'));
    return [hero, renderFollowFilters(kind, groups), renderFollowList(kind, selected)];
  }
  function renderHomeQueue(kind, people) {
    var isPrescription = kind === 'prescricoes';
    var queue = groupFollowQueue(kind, people);
    var total = queue.reduce(function (sum, group) { return sum + group.people.length; }, 0);
    var box = el('section', 'section-card home-queue home-queue-' + kind);
    var head = el('div', 'home-queue-head');
    var copy = el('div');
    copy.appendChild(el('span', 'label', isPrescription ? 'FICHAS / PRESCRIÇÕES' : 'AVALIAÇÕES'));
    copy.appendChild(el('h3', '', number(total) + ' precisam de revisão'));
    var open = el('button', isPrescription ? 'primary' : 'secondary', isPrescription ? 'Abrir fichas' : 'Abrir avaliações');
    open.type = 'button';
    open.addEventListener('click', function () { openFollowQueue(kind, ''); });
    head.appendChild(copy);
    head.appendChild(open);
    box.appendChild(head);
    queue.forEach(function (group) {
      var row = el('button', 'home-priority-row');
      row.type = 'button';
      row.dataset.priority = group.state;
      row.appendChild(el('span', 'priority-dot estado-' + group.state));
      var text = el('span');
      text.appendChild(el('strong', '', group.label));
      text.appendChild(el('small', '', group.note));
      row.appendChild(text);
      row.appendChild(el('b', '', number(group.people.length) + ' ›'));
      row.addEventListener('click', function () { openFollowQueue(kind, group.state); });
      box.appendChild(row);
    });
    return box;
  }
  function renderFinancialHome(data) {
    var due = dueBuckets(data), box = section('Agenda financeira'), summary = el('div', 'financial-home-summary');
    [['Últimos 5 dias', due.previous], ['Vencem hoje', due.today], ['Próximos 5 dias', due.next]].forEach(function (item) {
      var button = el('button', 'financial-home-item');
      button.type = 'button';
      button.appendChild(el('span', '', item[0]));
      button.appendChild(el('strong', '', number(item[1].length)));
      button.addEventListener('click', function () { detailsForContracts(item[0], item[1]); });
      summary.appendChild(button);
    });
    box.classList.add('financial-home');
    box.appendChild(summary);
    return box;
  }
  function renderHome(data) {
    var prescriptions = peopleFor('prescricoes'), evaluations = peopleFor('avaliacoes');
    var configured = state.bootstrap.configuracao.homeCards || [];
    var operationalBlocks = [
      { chave: 'fila_prescricoes', ativo: true, ordem: 1 },
      { chave: 'fila_avaliacoes', ativo: true, ordem: 2 },
      { chave: 'agenda_financeira', ativo: true, ordem: 3 }
    ];
    configured.forEach(function (item) {
      var block = operationalBlocks.find(function (candidate) { return candidate.chave === item.chave; });
      if (!block) return;
      block.ativo = item.ativo !== false;
      block.ordem = Number(item.ordem) || block.ordem;
    });
    operationalBlocks.sort(function (a, b) { return a.ordem - b.ordem; });
    var intro = el('section', 'home-operation-intro');
    intro.appendChild(el('span', 'eyebrow', 'OPERAÇÃO DE HOJE'));
    intro.appendChild(el('h2', '', 'O que precisa de ação'));
    intro.appendChild(el('p', 'body-copy', 'Prioridades calculadas com o último lote válido da planilha.'));
    var grid = el('div', 'home-operation-grid');
    operationalBlocks.forEach(function (block) {
      if (!block.ativo) return;
      if (block.chave === 'fila_prescricoes') grid.appendChild(renderHomeQueue('prescricoes', prescriptions));
      if (block.chave === 'fila_avaliacoes') grid.appendChild(renderHomeQueue('avaliacoes', evaluations));
      if (block.chave === 'agenda_financeira') grid.appendChild(renderFinancialHome(data));
    });
    return [
      intro,
      grid,
      window.XSteamStudentProfiles.renderSection({
        data: data,
        bootstrap: state.bootstrap,
        permanence: window.XSteamPermanencia,
        expanded: state.profilesExpanded,
        onExpandedChange: function (expanded) { state.profilesExpanded = expanded; },
        onSave: enqueue
      })
    ];
  }
  function markSettingsDirty() {
    state.settingsDirty = true;
    setSave('Alterações não salvas');
  }
  function validateAlertRules(kind, rules) {
    var fields = kind === 'avaliacoes' ? ['laranja', 'vermelho', 'roxo', 'critico'] : ['laranja', 'vermelho', 'roxo'];
    var previous = 0;
    for (var i = 0; i < fields.length; i += 1) {
      var value = Number(rules[fields[i]]);
      if (!Number.isInteger(value) || value <= previous) return { ok: false, message: 'Use dias inteiros, positivos e crescentes.' };
      previous = value;
    }
    return { ok: true, message: '' };
  }
  function ensureAlertSettingsDraft() {
    if (state.settingsAlertDraft) return state.settingsAlertDraft;
    state.settingsAlertDraft = {
      prescricoes: Object.assign({}, state.bootstrap.configuracao.alertas.prescricoes),
      avaliacoes: Object.assign({}, state.bootstrap.configuracao.alertas.avaliacoes)
    };
    return state.settingsAlertDraft;
  }
  function alertFields(kind) {
    return kind === 'avaliacoes' ? [
      { key: 'laranja', label: 'Em dia até' },
      { key: 'vermelho', label: 'Atenção até' },
      { key: 'roxo', label: 'Prioridade alta até' },
      { key: 'critico', label: 'Prioridade máxima até' }
    ] : [
      { key: 'laranja', label: 'Em dia até' },
      { key: 'vermelho', label: 'Atenção até' },
      { key: 'roxo', label: 'Prioridade alta até' }
    ];
  }
  function renderAlertPreview(kind, rules) {
    var box = el('div', 'settings-preview'), counts = Object.create(null);
    filtered().alunos.forEach(function (person) {
      var classification = classify(person, kind, rules);
      counts[classification.state] = (counts[classification.state] || 0) + 1;
    });
    box.appendChild(el('span', 'label', 'Prévia da Home'));
    var values = el('div', 'settings-preview-values');
    followDefinitions(kind).forEach(function (definition) {
      var item = el('span');
      item.appendChild(el('small', '', definition.label));
      item.appendChild(el('strong', '', number(counts[definition.state] || 0)));
      values.appendChild(item);
    });
    box.appendChild(values);
    return box;
  }
  function renderAlertSettings() {
    var kind = state.settingsAlertKind, drafts = ensureAlertSettingsDraft(), rules = drafts[kind], panel = section('Prazos das fichas');
    panel.classList.add('settings-panel');
    panel.appendChild(el('p', 'body-copy', 'Defina quando cada processo muda de prioridade. As faixas são exclusivas e calculadas automaticamente.'));
    var tabs = el('div', 'settings-tabs');
    [['prescricoes', 'Fichas / prescrições'], ['avaliacoes', 'Avaliações']].forEach(function (item) {
      var tab = el('button', 'settings-tab' + (kind === item[0] ? ' active' : ''), item[1]);
      tab.type = 'button';
      tab.addEventListener('click', function () { state.settingsAlertKind = item[0]; render(); });
      tabs.appendChild(tab);
    });
    panel.appendChild(tabs);
    var list = el('div', 'settings-rule-list'), fields = alertFields(kind);
    fields.forEach(function (field, index) {
      var row = el('label', 'settings-rule-row'), copy = el('span');
      copy.appendChild(el('strong', '', field.label));
      var previous = index ? Number(rules[fields[index - 1].key]) + 1 : 0;
      copy.appendChild(el('small', '', index ? previous + '–' + Number(rules[field.key]) + ' dias' : '0–' + Number(rules[field.key]) + ' dias'));
      var inputWrap = el('span', 'settings-days-input'), input = el('input');
      input.type = 'number'; input.min = '1'; input.step = '1'; input.value = rules[field.key];
      inputWrap.appendChild(input); inputWrap.appendChild(el('span', '', 'dias'));
      row.appendChild(copy); row.appendChild(inputWrap); row.appendChild(el('span', 'settings-order', String(index + 1)));
      input.addEventListener('input', function () {
        rules[field.key] = input.value === '' ? '' : Number(input.value);
        markSettingsDirty();
      });
      input.addEventListener('change', render);
      list.appendChild(row);
    });
    panel.appendChild(list);
    panel.appendChild(renderAlertPreview(kind, rules));
    var validation = validateAlertRules(kind, rules), message = el('p', 'form-message', validation.message);
    panel.appendChild(message);
    var save = el('button', 'primary', kind === 'prescricoes' ? 'Salvar prazos das fichas' : 'Salvar prazos das avaliações');
    save.type = 'button';
    save.disabled = !validation.ok;
    save.addEventListener('click', function () {
      var result = validateAlertRules(kind, rules);
      if (!result.ok) { message.textContent = result.message; return; }
      var values = {}; values[kind] = Object.assign({}, rules);
      state.bootstrap.configuracao.alertas[kind] = Object.assign({}, rules);
      state.settingsDirty = false;
      enqueue({ tipo: 'configAlertas', valores: values }).catch(function () {});
    });
    panel.appendChild(save);
    return panel;
  }
  function homeSettingDefinitions() {
    return [
      { chave: 'fila_prescricoes', titulo: 'Fichas / prescrições', helper: 'Fila de fichas por prioridade' },
      { chave: 'fila_avaliacoes', titulo: 'Avaliações', helper: 'Fila independente de avaliações' },
      { chave: 'agenda_financeira', titulo: 'Agenda financeira', helper: 'Resumo secundário de vencimentos' }
    ];
  }
  function ensureHomeSettingsDraft() {
    if (state.settingsHomeDraft) return state.settingsHomeDraft;
    var stored = Object.create(null);
    (state.bootstrap.configuracao.homeCards || []).forEach(function (item) { stored[item.chave] = item; });
    state.settingsHomeDraft = homeSettingDefinitions().map(function (definition, index) {
      var current = stored[definition.chave];
      return Object.assign({}, definition, { ativo: current ? current.ativo : true, ordem: current ? current.ordem : index + 1 });
    }).sort(function (a, b) { return a.ordem - b.ordem; });
    return state.settingsHomeDraft;
  }
  function moveHomeSetting(index, direction) {
    var draft = ensureHomeSettingsDraft(), target = index + direction;
    if (target < 0 || target >= draft.length) return;
    var current = draft[index]; draft[index] = draft[target]; draft[target] = current;
    markSettingsDirty(); render();
  }
  function renderHomeSettings() {
    var panel = section('Prioridades da Home'), list = el('div', 'settings-home-list'), draft = ensureHomeSettingsDraft();
    panel.classList.add('settings-panel');
    panel.appendChild(el('p', 'body-copy', 'Escolha quais blocos aparecem e ajuste sua ordem sem misturar fichas, avaliações e financeiro.'));
    draft.forEach(function (item, index) {
      var row = el('div', 'settings-home-row'), toggle = el('label', 'settings-home-toggle'), active = el('input'), copy = el('span'), actions = el('span', 'settings-order-actions');
      active.type = 'checkbox'; active.checked = item.ativo;
      copy.appendChild(el('strong', '', item.titulo)); copy.appendChild(el('small', '', item.helper));
      toggle.appendChild(active); toggle.appendChild(copy); row.appendChild(toggle);
      var up = el('button', 'secondary', 'Subir'), down = el('button', 'secondary', 'Descer');
      up.type = 'button'; down.type = 'button'; up.disabled = index === 0; down.disabled = index === draft.length - 1;
      up.addEventListener('click', function () { moveHomeSetting(index, -1); });
      down.addEventListener('click', function () { moveHomeSetting(index, 1); });
      actions.appendChild(up); actions.appendChild(down); row.appendChild(actions);
      active.addEventListener('change', function () { item.ativo = active.checked; markSettingsDirty(); });
      list.appendChild(row);
    });
    panel.appendChild(list);
    var save = el('button', 'primary', 'Salvar prioridades da Home');
    save.type = 'button';
    save.addEventListener('click', function () {
      var cards = draft.map(function (item, index) { return { chave: item.chave, ativo: item.ativo, ordem: index + 1, titulo: item.titulo, estados: [] }; });
      state.bootstrap.configuracao.homeCards = cards.slice();
      state.settingsDirty = false;
      enqueue({ tipo: 'configDashboard', valores: { homeCards: cards } }).catch(function () {});
    });
    panel.appendChild(save);
    return panel;
  }
  function renderPaymentSettings() {
    var panel = section('Perfis de pagamento'), list = el('div', 'settings-home-list');
    panel.classList.add('settings-panel');
    panel.appendChild(el('p', 'body-copy', 'Opções disponíveis para todos os perfis de alunos. A classificação individual agora é feita no perfil do aluno na Home.'));
    (state.bootstrap.catalogoPerfisAlunos || []).filter(function (item) {
      return item.ativo && item.tipo === 'perfil_pagamento' && item.grupo === 'global';
    }).sort(function (a, b) {
      return a.ordem - b.ordem || a.titulo.localeCompare(b.titulo, 'pt-BR');
    }).forEach(function (item) {
      var row = el('div', 'settings-home-row'), copy = el('span');
      copy.appendChild(el('strong', '', item.titulo));
      copy.appendChild(el('small', '', 'Opção global ativa'));
      row.appendChild(copy);
      list.appendChild(row);
    });
    if (!list.childNodes.length) list.appendChild(el('p', 'body-copy', 'Nenhuma opção ativa.'));
    panel.appendChild(list);
    return panel;
  }
  function renderSettings() {
    var shell = el('div', 'settings-shell'), nav = el('nav', 'settings-nav'), content = el('div', 'settings-content');
    nav.setAttribute('aria-label', 'Áreas de configuração');
    [['alertas', 'Prazos das fichas'], ['home', 'Prioridades da Home'], ['pagamentos', 'Perfil de pagamento']].forEach(function (item) {
      var button = el('button', state.settingsSection === item[0] ? 'active' : '', item[1]);
      button.type = 'button';
      button.addEventListener('click', function () { state.settingsSection = item[0]; render(); });
      nav.appendChild(button);
    });
    if (state.settingsSection === 'home') content.appendChild(renderHomeSettings());
    else if (state.settingsSection === 'pagamentos') content.appendChild(renderPaymentSettings());
    else content.appendChild(renderAlertSettings());
    shell.appendChild(nav); shell.appendChild(content);
    return [shell];
  }
  function fluxoCampo(form, label, key, value, type, options, obrigatorio) {
    var box=el('label',obrigatorio?'field-required':''), caption=el('span','field-label',label), isDate=type==='date', input=el(options?'select':(type==='texto'?'textarea':'input'));
    input.name=key;
    if(obrigatorio){ input.required=true; input.dataset.required='true'; input.setAttribute('aria-required','true'); caption.appendChild(el('span','required-marker','*')); }
    if(options){options.forEach(function(option){writeOption(input,option,option);});input.value=value||'';}
    else{input.type=type||'text';input.value=isDate?inputDate(value):value||'';if(isDate)input.dataset.date='true';}
    input.addEventListener('input',function(){ input.removeAttribute('aria-invalid'); box.classList.remove('has-error'); });
    input.addEventListener('change',function(){ input.removeAttribute('aria-invalid'); box.classList.remove('has-error'); });
    box.appendChild(caption);box.appendChild(input);form.appendChild(box);
  }
  function validarFormularioFluxo(tipo, values) {
    var campos=tipo==='lead' ? [['nome','Nome'],['telefone','Telefone'],['primeiroContato','Primeiro contato'],['status','Status']] : [['alunoId','ID do aluno'],['nome','Nome'],['dataSaida','Data da saída']];
    var ausentes=campos.filter(function(campo){return !String(values[campo[0]]||'').trim();});
    return {ok:!ausentes.length, campos:ausentes.map(function(campo){return campo[0];}), mensagem:ausentes.length?'Preencha: '+ausentes.map(function(campo){return campo[1];}).join(', ')+'.':''};
  }
  function mostrarErroFormularioFluxo(form, validacao) {
    var mensagem=form.querySelector('.form-message');
    mensagem.textContent=validacao.mensagem;
    validacao.campos.forEach(function(nome){var input=form.querySelector('[name="'+nome+'"]');if(input){input.setAttribute('aria-invalid','true');input.parentNode.classList.add('has-error');}});
    var primeiro=form.querySelector('[aria-invalid="true"]');if(primeiro)primeiro.focus();
  }
  function novoIdFluxo(tipo) { return tipo+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10); }
  function abrirFormularioFluxo(tipo, registro) {
    var dialog=document.getElementById('detailDialog'), target=document.getElementById('detailContent'), form=el('form','settings-grid fluxo-form');
    clear(target);document.getElementById('detailTitle').textContent=(registro?'Editar ':'Novo ')+(tipo==='lead'?'Lead':'Churn');var lead=tipo==='lead';form.noValidate=true;
    if(lead){
      fluxoCampo(form,'Nome','nome',registro&&registro.nome,null,null,true);fluxoCampo(form,'Telefone','telefone',registro&&registro.telefone,null,null,true);fluxoCampo(form,'Origem','origem',registro&&registro.origem);fluxoCampo(form,'Indicação','indicacao',registro&&registro.indicacao);fluxoCampo(form,'Primeiro contato','primeiroContato',registro&&registro.primeiroContato,'date',null,true);fluxoCampo(form,'Experimental','experimental',registro&&registro.experimental,'date');fluxoCampo(form,'Professor experimental','professorExperimental',registro&&registro.professorExperimental);fluxoCampo(form,'Entrada como cliente','entradaComoCliente',registro&&registro.entradaComoCliente,'date');fluxoCampo(form,'Status','status',registro&&registro.status,'text',['Novo','Em contato','Esfriando','Experimental agendado','Experimental realizado','Convertido','Perdido'],true);fluxoCampo(form,'Plano contratado','planoContratado',registro&&registro.planoContratado,'text',['','Pacote 5x','Pacote 10x','1x/sem','2x/sem','3x/sem','4x/sem','5x/sem','6x/sem']);fluxoCampo(form,'Valor do pacote','valorPacote',registro&&registro.valorPacote,'number');fluxoCampo(form,'Minirrelatório comercial','minirrelatorioVenda',registro&&registro.minirrelatorioVenda,'texto');
    }else{
      fluxoCampo(form,'ID do aluno','alunoId',registro&&registro.alunoId,null,null,true);fluxoCampo(form,'Nome','nome',registro&&registro.nome,null,null,true);fluxoCampo(form,'Telefone','telefone',registro&&registro.telefone);fluxoCampo(form,'Data da saída','dataSaida',registro&&registro.dataSaida,'date',null,true);fluxoCampo(form,'Profissional responsável','profissionalResponsavel',registro&&registro.profissionalResponsavel,'text',['','Elohim','Xico','Cadu','Ruan','Iranildo']);fluxoCampo(form,'Último personal','ultimoPersonal',registro&&registro.ultimoPersonal,'text',['','Elohim','Xico','Cadu','Ruan','Iranildo','Wallyson','Genuca','Yasmin','Wanderson Fabrício','Leonardo','Jackson','Vitória','Maria','Clara','Thomas','Max','Sávio','Cristian','Rafael']);fluxoCampo(form,'Motivo da saída','motivoSaida',registro&&registro.motivoSaida,'texto');fluxoCampo(form,'Sinais/contexto percebido','sinaisContexto',registro&&registro.sinaisContexto,'texto');fluxoCampo(form,'Ação de retenção realizada','acaoRetencao',registro&&registro.acaoRetencao,'texto');
    }
    var message=el('p','form-message');message.setAttribute('role','alert');form.appendChild(message);var actions=el('div','form-actions'),save=el('button','primary','Salvar');save.type='submit';actions.appendChild(save);form.appendChild(actions);
    form.addEventListener('submit',function(event){event.preventDefault();var values={id:registro&&registro.id};Array.prototype.forEach.call(form.elements,function(item){if(item.name)values[item.name]=item.dataset.date==='true'?dashboardDate(item.value):item.value;});var validacao=validarFormularioFluxo(tipo,values);if(!validacao.ok){mostrarErroFormularioFluxo(form,validacao);return;}if(!values.id){values.id=novoIdFluxo(lead?'lead':'churn');values.criar=true;}enqueue({tipo:lead?'fluxoLead':'fluxoChurn',valores:values}).catch(function(){});dialog.close();});target.appendChild(form);dialog.showModal();
  }
  function destruirGraficosChurn() { (state.churnCharts||[]).forEach(function(chart){chart.destroy();});state.churnCharts=[]; }
  function churnsDoMes(items, chave) { return items.filter(function(item){var data=parseDate(item.dataSaida);return data&&data.getFullYear()+'-'+String(data.getMonth()+1).padStart(2,'0')===chave;}); }
  function churnsDaSemana(items, inicio, fim) { var a=parseDate(inicio),b=parseDate(fim);return items.filter(function(item){var data=parseDate(item.dataSaida);return data&&a&&b&&data>=a&&data<=b;}); }
  function linhaDetalheChurnFluxo(item) { var row=el('article','churn-detail-row'),cabecalho=el('div','churn-detail-heading'),detalhes=el('ul','churn-detail-notes'),acoes=el('div','record-actions'),edit=el('button','secondary','Editar'),remove=el('button','danger','Apagar');cabecalho.appendChild(el('h3','',item.nome||'Churn sem nome'));cabecalho.appendChild(el('span','churn-detail-date',item.dataSaida?'Saída em '+item.dataSaida:'Data não informada'));row.appendChild(cabecalho);row.appendChild(el('p','churn-detail-meta','ID do aluno: '+(item.alunoId||'Não informado')));[['Profissional responsável',item.profissionalResponsavel],['Último personal',item.ultimoPersonal],['Motivo',item.motivoSaida],['Sinais/contexto',item.sinaisContexto],['Ação de retenção',item.acaoRetencao]].forEach(function(detalhe){if(detalhe[1])detalhes.appendChild(el('li','',detalhe[0]+': '+detalhe[1]));});if(detalhes.childNodes.length)row.appendChild(detalhes);edit.type='button';edit.addEventListener('click',function(){abrirFormularioFluxo('churn',item);});remove.type='button';remove.addEventListener('click',function(){if(window.confirm('Apagar este churn? Esta ação não pode ser desfeita.'))enqueue({tipo:'excluirFluxoChurn',valores:{id:item.id}}).catch(function(){});});acoes.appendChild(edit);acoes.appendChild(remove);row.appendChild(acoes);return row; }
  function abrirListaChurnsFluxo(titulo, itens) { var dialog=document.getElementById('detailDialog'),target=document.getElementById('detailContent');clear(target);document.getElementById('detailTitle').textContent=titulo;if(!itens.length)target.appendChild(el('p','body-copy','Nenhum churn neste recorte.'));itens.slice().sort(function(a,b){return (parseDate(b.dataSaida)||0)-(parseDate(a.dataSaida)||0);}).forEach(function(item){target.appendChild(linhaDetalheChurnFluxo(item));});dialog.showModal(); }
  function campoFiltroChurn(rotulo, id, tipo, valor, aoMudar) { var label=el('label','',rotulo),input=el('input');input.id=id;input.type=tipo;input.value=valor;input.addEventListener('change',function(){aoMudar(input.value);});label.appendChild(input);return label; }
  function criarGraficoChurn(canvas, tipo, serie, itens, porPeriodo) { if(typeof Chart!=='function')return null;var chart=new Chart(canvas,{type:tipo,data:{labels:serie.map(function(item){return item.label;}),datasets:[{label:'Saídas',data:serie.map(function(item){return item.valor;}),borderColor:'#dfff22',backgroundColor:tipo==='line'?'rgba(223,255,34,.16)':'rgba(223,255,34,.72)',borderWidth:2,fill:tipo==='line',tension:.28,pointRadius:tipo==='line'?4:0,pointHoverRadius:tipo==='line'?7:0,borderRadius:tipo==='bar'?7:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:function(context){var item=serie[context.dataIndex];if(tipo!=='bar'||item.variacaoAbsoluta===null)return '';var percentual=item.variacaoPercentual===null?'—':item.variacaoPercentual+'%';return 'MoM: '+(item.variacaoAbsoluta>0?'+':'')+item.variacaoAbsoluta+' • '+percentual;}}}},scales:{x:{ticks:{color:'#95a1a1',maxRotation:0,autoSkip:true},grid:{display:false}},y:{beginAtZero:true,ticks:{precision:0,color:'#95a1a1'},grid:{color:'rgba(255,255,255,.07)'}}},onClick:function(event,elements,instance){var hit=instance.getElementsAtEventForMode(event,'nearest',{intersect:true},true)[0];if(!hit)return;var periodo=serie[hit.index];porPeriodo(periodo,itens);}}});state.churnCharts.push(chart);return chart; }
  function renderDiagnosticosChurnFluxo(target, diagnosticos) { var bloco=section('Diagnósticos de auditoria'), grade=el('div','flow-diagnostics');var motivos=el('div',''),responsaveis=el('div',''),retencao=el('div','');motivos.appendChild(el('h3','','Motivos registrados'));motivos.appendChild(diagnosticos.motivos.length?barList(diagnosticos.motivos.map(function(item){return{label:item.chave,value:item.valor};})):el('p','body-copy','Nenhum motivo registrado.'));responsaveis.appendChild(el('h3','','Profissional responsável'));responsaveis.appendChild(diagnosticos.responsaveis.length?barList(diagnosticos.responsaveis.map(function(item){return{label:item.chave,value:item.valor};})):el('p','body-copy','Sem responsável informado.'));retencao.appendChild(el('h3','','Cobertura de retenção'));retencao.appendChild(el('p','body-copy',number(diagnosticos.retencao.coberturaPercentual)+'% dos churns têm ação de retenção registrada.'));retencao.appendChild(barList([{label:'Com ação',value:diagnosticos.retencao.comAcao},{label:'Sem ação',value:diagnosticos.retencao.semAcao}]));grade.appendChild(motivos);grade.appendChild(responsaveis);grade.appendChild(retencao);bloco.appendChild(grade);target.appendChild(bloco); }
  function chaveCacheAnaliseChurnCliente(filtros) { return [filtros.mesInicio,filtros.mesFim,filtros.semanaInicio,filtros.semanaFim].join('|'); }
  function renderChurnAnalytics(items) {
    var host=document.getElementById('churnAnalytics');if(!host)return;destruirGraficosChurn();clear(host);
    var filtros=filtrosChurn(),acoes=el('div','flow-analytics-controls'),resultado=el('div','flow-analytics-results');
    acoes.appendChild(campoFiltroChurn('Mês inicial','churnMonthStart','month',filtros.mesInicio,function(valor){filtros.mesInicio=valor;renderChurnAnalytics(items);}));acoes.appendChild(campoFiltroChurn('Mês final','churnMonthEnd','month',filtros.mesFim,function(valor){filtros.mesFim=valor;renderChurnAnalytics(items);}));acoes.appendChild(campoFiltroChurn('Início semanal','churnWeekStart','date',filtros.semanaInicio,function(valor){filtros.semanaInicio=valor;renderChurnAnalytics(items);}));acoes.appendChild(campoFiltroChurn('Fim semanal','churnWeekEnd','date',filtros.semanaFim,function(valor){filtros.semanaFim=valor;renderChurnAnalytics(items);}));host.appendChild(acoes);host.appendChild(resultado);
    var requisicao=++state.churnAnalyticsRequest,chaveCache=chaveCacheAnaliseChurnCliente(filtros),analiseCache=state.churnAnalyticsCache[chaveCache];
    function mostrarAnalise(analise) {
      if(requisicao!==state.churnAnalyticsRequest||state.page!=='fluxo'||state.subpage!=='churns')return;
      clear(resultado);var mensal=section('Churn mensal (MoM)'),semanal=section('Churn semanal (WoW)'),canvasMensal=el('canvas','flow-chart'),canvasSemanal=el('canvas','flow-chart'),areaMensal=el('div','flow-chart-wrap'),areaSemanal=el('div','flow-chart-wrap');areaMensal.appendChild(canvasMensal);areaSemanal.appendChild(canvasSemanal);mensal.appendChild(areaMensal);semanal.appendChild(areaSemanal);resultado.appendChild(mensal);resultado.appendChild(semanal);criarGraficoChurn(canvasMensal,'bar',analise.mensal,items,function(periodo,linhas){abrirListaChurnsFluxo('Churns — '+periodo.label,churnsDoMes(linhas,periodo.chave));});criarGraficoChurn(canvasSemanal,'line',analise.semanal,items,function(periodo,linhas){abrirListaChurnsFluxo('Churns — '+periodo.label,churnsDaSemana(linhas,periodo.inicio,periodo.fim));});renderDiagnosticosChurnFluxo(resultado,analise.diagnosticos);
    }
    if(analiseCache){mostrarAnalise(analiseCache);return;}
    resultado.appendChild(el('p','body-copy','Carregando análises de churn…'));
    call('obterAnaliseChurnsDashboard',{mesInicio:filtros.mesInicio,mesFim:filtros.mesFim,semanaInicio:dashboardDate(filtros.semanaInicio),semanaFim:dashboardDate(filtros.semanaFim)}).then(function(analise){state.churnAnalyticsCache[chaveCache]=analise;mostrarAnalise(analise);}).catch(function(){if(requisicao===state.churnAnalyticsRequest){clear(resultado);resultado.appendChild(el('p','body-copy','Não foi possível carregar as análises de churn.'));}});
  }
  function grupoLeadFluxo(item) { var status=String((item||{}).status||''); if(status==='Perdido')return 'perdidos'; if(status==='Esfriando')return 'perdendo'; if(status==='Convertido')return 'convertidos'; return 'em_trabalho'; }
  function classeStatusLead(item) { return ({ 'Convertido':'convertido', 'Experimental realizado':'experimental', 'Esfriando':'esfriando', 'Perdido':'perdido', 'Novo':'novo' })[String((item||{}).status||'')] || 'atencao'; }
  function iconeWhatsapp() { var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),bubble=document.createElementNS(ns,'path'),phone=document.createElementNS(ns,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');bubble.setAttribute('d','M20.5 11.5a8.4 8.4 0 0 1-11.9 7.6L3.5 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.5Z');phone.setAttribute('d','M9.2 7.5c.2-.5.5-.6.9-.4l1.2.6c.3.2.4.5.3.8l-.5 1.1c.7 1.4 1.8 2.5 3.2 3.2l1.1-.5c.3-.1.6 0 .8.3l.6 1.2c.2.4.1.7-.4.9-.6.3-1.3.4-2 .2-3.4-.9-6-3.5-6.9-6.9-.2-.7-.1-1.4.2-2.1Z');svg.appendChild(bubble);svg.appendChild(phone);return svg; }
  function cardFiltroLead(titulo, grupo, itens, descricao) { var botao=el('button','lead-filter-card'+(state.leadFilter===grupo?' active':''));botao.type='button';botao.setAttribute('aria-pressed',String(state.leadFilter===grupo));botao.appendChild(el('span','label',titulo));botao.appendChild(el('strong','',number(itens.length)));botao.appendChild(el('em','',descricao));botao.addEventListener('click',function(){state.leadFilter=grupo;render();});return botao; }
  function renderFluxoLeads(items) {
    var grupos={todos:items,convertidos:[],perdidos:[],perdendo:[],em_trabalho:[]},grid=el('div','lead-filter-grid'),box=section('Acompanhamento de leads'),add=el('button','primary','+ Novo lead'),lista=el('div','lead-list-grid');
    items.forEach(function(item){grupos[grupoLeadFluxo(item)].push(item);});
    [['Todos','todos','Todos os registros'],['Convertidos','convertidos','Status manual'],['Perdidos','perdidos','Encerrados'],['Perdendo','perdendo','Precisam de atenção'],['Em trabalho','em_trabalho','Funil atual']].forEach(function(definicao){grid.appendChild(cardFiltroLead(definicao[0],definicao[1],grupos[definicao[1]],definicao[2]));});
    add.addEventListener('click',function(){abrirFormularioFluxo('lead',null);});box.appendChild(add);box.appendChild(el('p','lead-list-summary',(state.leadFilter==='todos'?'Todos os leads':({convertidos:'Leads convertidos',perdidos:'Leads perdidos',perdendo:'Leads esfriando',em_trabalho:'Leads em trabalho'})[state.leadFilter])+' • '+number(grupos[state.leadFilter].length)+' registro(s)'));
    grupos[state.leadFilter].slice().sort(function(a,b){return String(a.primeiroContato).localeCompare(String(b.primeiroContato));}).forEach(function(item){
      var row=el('article','lead-row'),header=el('div','lead-row-header'),acoes=el('div','lead-row-actions'),edit=el('button','secondary','Editar');
      header.appendChild(el('h3','',item.nome||'Lead sem nome'));header.appendChild(el('span','lead-status lead-status-'+classeStatusLead(item),item.status||'Sem status'));row.appendChild(header);row.appendChild(el('p','body-copy',(item.primeiroContato||'Data não informada')+' • '+(item.origem||'Sem origem')));
      if(String(item.telefone||'').replace(/\D/g,'').length>=10){var whats=el('a','whatsapp-button');whats.href='https://wa.me/55'+String(item.telefone).replace(/\D/g,'');whats.target='_blank';whats.rel='noopener noreferrer';whats.setAttribute('aria-label','Abrir conversa no WhatsApp com '+(item.nome||'este lead'));whats.appendChild(iconeWhatsapp());acoes.appendChild(whats);}
      edit.type='button';edit.addEventListener('click',function(){abrirFormularioFluxo('lead',item);});acoes.appendChild(edit);row.appendChild(acoes);lista.appendChild(row);
    });
    if(!lista.childNodes.length)lista.appendChild(el('p','body-copy','Nenhum lead neste recorte.'));box.appendChild(lista);return[grid,box];
  }
  function renderFluxoChurns(items) { var grid=el('div','kpi-grid'),analytics=section('Análises de churn'),add=el('button','primary','+ Novo churn');grid.appendChild(card('Saídas registradas',number(items.length),'Base manual',function(){abrirListaChurnsFluxo('Todos os churns',items);}));grid.appendChild(card('Com motivo',number(items.filter(function(x){return x.motivoSaida;}).length),'Auditoria'));grid.appendChild(card('Com retenção',number(items.filter(function(x){return x.acaoRetencao;}).length),'Auditoria'));add.addEventListener('click',function(){abrirFormularioFluxo('churn',null);});analytics.appendChild(add);var resultados=el('div','flow-analytics-results');resultados.id='churnAnalytics';analytics.appendChild(resultados);return[grid,analytics]; }
  function renderFluxo() { var lead=state.subpage==='leads',items=((state.bootstrap.fluxo||{})[lead?'leads':'churns']||[]);return lead?renderFluxoLeads(items):renderFluxoChurns(items); }
  function render() { if(!state.bootstrap)return; var content=document.getElementById('pageContent');if(!(state.page==='fluxo'&&state.subpage==='churns')){state.churnAnalyticsRequest+=1;destruirGraficosChurn();}clear(content);var data=filtered(), nodes=[];document.getElementById('pageTitle').textContent=labels[state.page];document.getElementById('lastUpdate').textContent=state.bootstrap.atualizadoEm?'Base atualizada em '+state.bootstrap.atualizadoEm:'Nenhuma importação válida';var sub=document.getElementById('subnav'), global=document.querySelector('.global-filters');sub.hidden=!(state.page==='financeiro'||state.page==='acompanhamento'||state.page==='fluxo');if(global)global.hidden=state.page==='fluxo';sub.querySelectorAll('button').forEach(function(b){var finance=b.dataset.subpage==='planos'||b.dataset.subpage==='vencimentos'||b.dataset.subpage==='permanencia', follow=b.dataset.subpage==='prescricoes'||b.dataset.subpage==='avaliacoes', flow=b.dataset.subpage==='leads'||b.dataset.subpage==='churns';b.hidden=(state.page==='financeiro')?!finance:(state.page==='acompanhamento')?!follow:(state.page==='fluxo')?!flow:true;b.classList.toggle('active',b.dataset.subpage===state.subpage);});if(state.page==='home')nodes=renderHome(data);else if(state.page==='financeiro')nodes=state.subpage==='planos'?renderPlans(data):state.subpage==='vencimentos'?renderDue(data):renderPermanence(data);else if(state.page==='acompanhamento')nodes=renderFollow(state.subpage);else if(state.page==='fluxo')nodes=renderFluxo();else nodes=renderSettings();nodes.forEach(function(n){content.appendChild(n);});if(state.page==='fluxo'&&state.subpage==='churns')renderChurnAnalytics((state.bootstrap.fluxo||{}).churns||[]); }
  function syncFilters() { var status=document.getElementById('globalStatus'), polo=document.getElementById('globalPolo'), b=state.bootstrap;clear(status);clear(polo);var statuses=Array.from(new Set(b.alunos.map(function(p){return p.status;}))).sort();var polos=Array.from(new Set(b.contratos.map(function(c){return c.polo;}))).sort();writeOption(status,'__matriculados__','Matriculados');statuses.forEach(function(v){writeOption(status,v,v);});polos.forEach(function(v){writeOption(polo,v,v);});status.value=state.filters.status||'';polo.value=state.filters.polo||''; }
  function activate(page) { if(state.page==='configuracoes'&&page!=='configuracoes'&&state.settingsDirty&&!window.confirm('Descartar alterações não salvas?'))return;state.page=page;if(page==='financeiro'&&['planos','vencimentos','permanencia'].indexOf(state.subpage)<0)state.subpage='planos';if(page==='acompanhamento'&&['prescricoes','avaliacoes'].indexOf(state.subpage)<0)state.subpage='prescricoes';if(page==='fluxo'&&['leads','churns'].indexOf(state.subpage)<0)state.subpage='leads';document.querySelectorAll('[data-page]').forEach(function(b){b.classList.toggle('active',b.dataset.page===page);});render(); }
  function applyBootstrap(data) { data.perfisAlunos=data.perfisAlunos||[];data.catalogoPerfisAlunos=data.catalogoPerfisAlunos||[];data.permanencia=data.permanencia||[];data.eventosPermanencia=data.eventosPermanencia||[];state.bootstrap=data;state.filters={status:data.filtrosPadrao.status==='Ativo'?'__matriculados__':(data.filtrosPadrao.status||'__matriculados__'),polo:data.filtrosPadrao.polo||'XSTEAM WELLNESS CLUB'};syncFilters();render();safeCacheSet(data);finishLoading(); }
  function aplicarMutacaoOtimista(patch) {
    if(!state.bootstrap||!patch||!patch.valores)return null;
    if(patch.tipo==='perfilAluno'){
      var rollbackPerfil=window.XSteamStudentProfiles.applyProfilePatch(state.bootstrap,patch.valores);
      render();safeCacheSet(state.bootstrap);
      return {tipo:'perfilAluno',valor:rollbackPerfil};
    }
    var fluxo=state.bootstrap.fluxo||(state.bootstrap.fluxo={leads:[],churns:[]}), chave=patch.tipo==='fluxoLead'?'leads':patch.tipo==='fluxoChurn'?'churns':'';
    if(!chave)return null;
    var lista=fluxo[chave]||(fluxo[chave]=[]), valores=patch.valores, indice=lista.findIndex(function(item){return item.id===valores.id;}), anterior=indice===-1?null:Object.assign({},lista[indice]);
    var proximo=Object.assign({},anterior||{},valores);
    if(chave==='leads')proximo.valorPacote=valores.valorPacote===''?0:Number(valores.valorPacote)||0;
    if(indice===-1)lista.push(proximo);else lista[indice]=proximo;
    if(chave==='churns')state.churnAnalyticsCache=Object.create(null);
    render();safeCacheSet(state.bootstrap);
    return {chave:chave,id:valores.id,indice:indice,anterior:anterior};
  }
  function reverterMutacaoOtimista(rollback) {
    if(!rollback||!state.bootstrap)return;
    if(rollback.tipo==='perfilAluno'){
      window.XSteamStudentProfiles.rollbackProfilePatch(state.bootstrap,rollback.valor);
      render();safeCacheSet(state.bootstrap);return;
    }
    if(!state.bootstrap.fluxo)return;
    var lista=state.bootstrap.fluxo[rollback.chave]||[], indice=lista.findIndex(function(item){return item.id===rollback.id;});
    if(rollback.anterior){if(indice===-1)lista.splice(Math.max(0,rollback.indice),0,rollback.anterior);else lista[indice]=rollback.anterior;}
    else if(indice!==-1)lista.splice(indice,1);
    if(rollback.chave==='churns')state.churnAnalyticsCache=Object.create(null);
    render();safeCacheSet(state.bootstrap);
  }
  function criarLoteMutacoes(entries, requestId) { return {requestId:requestId||('dash-'+Date.now()+'-'+Math.random().toString(36).slice(2)),entries:entries}; }
  function agendarSincronizacaoDeFundo() {
    clearTimeout(state.backgroundSyncTimer);state.backgroundSyncTimer=setTimeout(function(){
      call('obterVersaoDashboard').then(function(versao){if(state.bootstrap&&versao.versao!==state.bootstrap.versao)return call('obterBootstrapDashboard');}).then(function(atualizado){if(atualizado)applyBootstrap(atualizado);}).catch(function(){});
    },1200);
  }
  function enviarLoteMutacoes(lote) {
    state.saving=true;setSave('Salvando…');setRetryVisible(false);
    return call('salvarMutacoesDashboard',{requestId:lote.requestId,patches:lote.entries.map(function(entry){return entry.patch;})}).then(function(response){if(lote.entries.some(function(entry){return entry.patch.tipo==='fluxoChurn'||entry.patch.tipo==='excluirFluxoChurn';}))state.churnAnalyticsCache=Object.create(null);lote.entries.forEach(function(entry){entry.resolve(response);});setSave('Salvo');agendarSincronizacaoDeFundo();return response;}).catch(function(error){
      lote.entries.slice().reverse().forEach(function(entry){reverterMutacaoOtimista(entry.rollback);entry.reject(error);});state.failedMutations.push(lote);setSave('Não foi possível salvar. Tentar novamente.');setRetryVisible(true);
    }).finally(function(){state.saving=false;if(state.mutationQueue.length)flushQueue();});
  }
  function enqueue(patch) { return new Promise(function (resolve, reject) { var entry={patch:patch,rollback:aplicarMutacaoOtimista(patch),resolve:resolve,reject:reject};state.mutationQueue.push(entry);setSave('Alteração pendente');flushQueue(); }); }
  function flushQueue() { if(state.saving||!state.mutationQueue.length)return;enviarLoteMutacoes(criarLoteMutacoes(state.mutationQueue.splice(0))); }
  function tentarNovamenteMutacoes() { if(state.saving||!state.failedMutations.length)return;var lote=state.failedMutations.shift();lote.entries.forEach(function(entry){entry.rollback=aplicarMutacaoOtimista(entry.patch);});enviarLoteMutacoes(lote); }
  function start() { setProgress(8);var timer=setInterval(function(){var width=parseFloat(document.getElementById('loading-progress').style.width)||8;setProgress(Math.min(95,width+7));},150);setTimeout(function(){if(!state.bootstrap)document.getElementById('loading-message').textContent='A base está levando mais tempo que o normal…';},5000);var cached=safeCacheGet();if(cached&&cached.versao){applyBootstrap(cached);call('obterVersaoDashboard').then(function(v){if(v.versao!==cached.versao)return call('obterBootstrapDashboard');}).then(function(fresh){if(fresh)applyBootstrap(fresh);setSave('Base sincronizada');}).catch(function(){setSave('Sem conexão com a base. Exibindo dados salvos neste dispositivo.');}).finally(function(){clearInterval(timer);});}else{call('obterBootstrapDashboard').then(function(fresh){applyBootstrap(fresh);setSave('Base sincronizada');}).catch(function(){document.getElementById('loading-message').textContent='Não foi possível conectar à base. Verifique a conexão e tente novamente.';}).finally(function(){clearInterval(timer);});} }
  window.iniciarDashboardPwa=function(){ document.querySelectorAll('[data-page]').forEach(function(b){b.addEventListener('click',function(){activate(b.dataset.page);});});document.getElementById('subnav').addEventListener('click',function(e){if(e.target.dataset.subpage){state.subpage=e.target.dataset.subpage;if(state.page==='acompanhamento')state.followCategory='';render();}});document.getElementById('globalStatus').addEventListener('change',function(e){state.filters.status=e.target.value;render();});document.getElementById('globalPolo').addEventListener('change',function(e){state.filters.polo=e.target.value;render();});document.getElementById('detailClose').addEventListener('click',function(){document.getElementById('detailDialog').close();});var retry=document.getElementById('retryMutations');if(retry)retry.addEventListener('click',tentarNovamenteMutacoes);window.addEventListener('beforeunload',function(event){if(!state.settingsDirty)return;event.preventDefault();event.returnValue='';});start(); };
}());
