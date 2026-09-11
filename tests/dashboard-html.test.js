const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('shell contém splash, quatro áreas principais, subabas e modal acessível', () => {
  const html = fs.readFileSync('pwa/index.html', 'utf8');
  assert.match(html, /id="loading-screen"/);
  for (const page of ['home', 'financeiro', 'acompanhamento', 'configuracoes']) {
    const buttons = html.match(new RegExp(`<button\\b[^>]*data-page="${page}"[^>]*>`, 'g')) || [];
    assert.equal(buttons.length, 2, `${page} deve existir no menu desktop e no dock mobile`);
  }
  for (const tab of ['planos', 'vencimentos', 'prescricoes', 'avaliacoes']) {
    assert.match(html, new RegExp(`data-subpage="${tab}"`));
  }
  assert.match(html, /<dialog[^>]+id="detailDialog"[^>]+role="dialog"/);
  assert.match(html, /id="globalStatus"/);
  assert.match(html, /id="globalPolo"/);
});

test('Fluxo oferece navegação, operações e atalho de WhatsApp', () => {
  const components = fs.readFileSync('pwa/index.html', 'utf8');
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(components, /data-page="fluxo"/);
  assert.match(components, /data-subpage="leads"/);
  assert.match(components, /data-subpage="churns"/);
  assert.match(client, /fluxo: 'Fluxo'/);
  assert.match(client, /fluxoLead/);
  assert.match(client, /fluxoChurn/);
  assert.match(client, /excluirFluxoChurn/);
  assert.match(client, /wa\.me/);
});

test('Leads têm filtros de situação, status colorido e lista responsiva', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  assert.match(client, /function grupoLeadFluxo\(item\)/);
  for (const grupo of ['Todos', 'Convertidos', 'Perdidos', 'Perdendo', 'Em trabalho']) assert.match(client, new RegExp(`'${grupo}'`));
  assert.match(client, /aria-pressed/);
  assert.match(client, /lead-status-/);
  assert.match(client, /whatsapp-button/);
  assert.match(client, /lead-list-grid/);
  assert.match(css, /\.lead-filter-grid\s*\{[^}]*repeat\(5, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.lead-list-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.lead-status-convertido/);
});

test('dock móvel usa uma linha de cinco ícones acessíveis', () => {
  const components = fs.readFileSync('pwa/index.html', 'utf8');
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  const mobileNav = components.match(/<nav class="mobile-dock"[\s\S]*?<\/nav>/)[0];
  assert.match(mobileNav, /aria-label="Configurações"/);
  assert.equal((mobileNav.match(/class="dock-button/g) || []).length, 5);
  assert.equal((mobileNav.match(/<svg/g) || []).length, 5);
  assert.match(css, /\.mobile-dock[^}]*grid-template-columns:\s*repeat\(5, 1fr\)/s);
  assert.match(css, /\.dock-button svg/);
});

test('Fluxo usa ações semânticas, datas nativas e rodapé de formulário', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  assert.match(client, /record-actions/);
  assert.match(client, /'danger','Apagar'/);
  assert.match(client, /fluxo-form/);
  assert.match(client, /'Primeiro contato',[^\n]*'date'/);
  assert.match(client, /item\.dataset\.date==='true'\?dashboardDate\(item\.value\):item\.value/);
  assert.match(css, /\.churn-detail-row/);
  assert.match(css, /\.fluxo-form \.form-actions/);
  assert.match(css, /\.primary, \.secondary, \.danger\s*\{[^}]*min-height:\s*44px/s);
});

test('formulário de Lead destaca campos obrigatórios e valida antes de entrar na fila', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  assert.match(client, /function fluxoCampo\(form, label, key, value, type, options, obrigatorio\)/);
  assert.match(client, /required-marker/);
  assert.match(client, /input\.required\s*=\s*true/);
  assert.match(client, /function validarFormularioFluxo\(tipo, values\)/);
  assert.match(client, /if\(!validacao\.ok\)\{/);
  assert.match(css, /\.field-required/);
});

test('fila aplica a alteração de fluxo localmente e não repete erro de validação em ciclo', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(client, /function aplicarMutacaoOtimista\(patch\)/);
  assert.match(client, /function reverterMutacaoOtimista\(rollback\)/);
  assert.match(client, /safeCacheSet\(state\.bootstrap\)/);
  assert.match(client, /state\.failedMutations\.push\(lote\)/);
  assert.match(client, /function tentarNovamenteMutacoes\(\)/);
  assert.match(client, /return new Promise\(function \(resolve, reject\)/);
  assert.match(client, /entry\.resolve\(response\)/);
  assert.match(client, /entry\.reject\(error\)/);
  assert.match(client, /if\(state\.mutationQueue\.length\)flushQueue\(\);/);
  assert.match(client, /enqueue\(\{ tipo: 'configAlertas', valores: values \}\)\.catch\(function \(\) \{\}\);/);
  assert.match(client, /enqueue\(\{ tipo: 'configDashboard', valores: \{ homeCards: cards \} \}\)\.catch\(function \(\) \{\}\);/);
  assert.match(client, /enqueue\(\{tipo:lead\?'fluxoLead':'fluxoChurn',valores:values\}\)\.catch\(function\(\)\{\}\);/);
  assert.match(client, /enqueue\(\{tipo:'excluirFluxoChurn',valores:\{id:item\.id\}\}\)\.catch\(function\(\)\{\}\);/);
  assert.doesNotMatch(client, /state\.mutationQueue=patches\.concat\(state\.mutationQueue\);setSave\('Não foi possível salvar\. Tente novamente\.'\);\}\)\.finally\(function\(\)\{state\.saving=false;if\(state\.mutationQueue\.length\)flushQueue\(\);/);
});

test('Churn usa os menus profissionais e não exibe contrato ou polo', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(client, /'Profissional responsável','profissionalResponsavel'/);
  assert.match(client, /'Último personal','ultimoPersonal'/);
  assert.match(client, /diagnosticos\.responsaveis/);
  assert.doesNotMatch(client, /contratoXSem/);
  assert.doesNotMatch(client, /'Polo','polo'/);
});

test('Churns oferece análises MoM e WoW com detalhes clicáveis por período', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  assert.match(client, /churnMonthStart/);
  assert.match(client, /churnMonthEnd/);
  assert.match(client, /churnWeekStart/);
  assert.match(client, /churnWeekEnd/);
  assert.match(client, /obterAnaliseChurnsDashboard/);
  assert.match(client, /abrirListaChurnsFluxo/);
  assert.match(client, /getElementsAtEventForMode/);
  assert.match(client, /pointRadius/);
  assert.match(css, /\.flow-analytics-controls/);
});

test('Churn reaproveita no PWA a análise já calculada para o mesmo recorte', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(client, /churnAnalyticsCache/);
  assert.match(client, /function chaveCacheAnaliseChurnCliente\(filtros\)/);
  assert.match(client, /state\.churnAnalyticsCache\[chaveCache\]/);
});

test('gráficos de churn usam um contêiner de altura fixa para evitar ciclo de redimensionamento', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  assert.match(client, /flow-chart-wrap/);
  assert.match(css, /\.flow-chart-wrap\s*\{[^}]*height:\s*320px/);
  assert.match(css, /\.flow-chart\s*\{[^}]*height:\s*100%/);
  assert.doesNotMatch(css, /\.flow-chart\s*\{[^}]*min-height/);
});

test('filtros globais respeitam hidden ao abrir Fluxo', () => {
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  assert.match(css, /\.global-filters\[hidden\]\s*\{\s*display:\s*none/);
});

test('shell usa a logo oficial XSTEAM em todas as áreas de marca', () => {
  const html = fs.readFileSync('pwa/index.html', 'utf8');
  const logoUses = html.match(/href="#xsteam-logo-symbol"/g) || [];
  assert.equal(logoUses.length, 3);
  assert.match(html, /<symbol id="xsteam-logo-symbol"/);
  assert.match(html, /class="brand-logo brand-logo-splash"/);
  assert.match(html, /class="brand-logo brand-logo-sidebar"/);
  assert.match(html, /class="brand-logo brand-logo-mobile"/);
});

test('tema traz branding escuro, dock móvel e leitura confortável', () => {
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  assert.match(css, /--lime:\s*#dfff22/i);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
  assert.match(css, /\.mobile-dock/);
  assert.match(css, /\.body-copy\s*\{[^}]*font-size:\s*14px/s);
  assert.match(css, /\.detail-dialog/);
});

test('tema premium define superfícies, foco e adaptação de movimento', () => {
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  assert.match(css, /--radius-card:\s*16px/);
  assert.match(css, /--shadow-card:/);
  assert.match(css, /background:\s*radial-gradient/);
  assert.match(css, /\.nav-button:focus-visible/);
  assert.match(css, /\.kpi:hover/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.mobile-dock[^}]*border-radius:/s);
});

test('cliente usa bootstrap local, cache persistente e fila de mutações', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(client, /obterBootstrapDashboard/);
  assert.match(client, /obterVersaoDashboard/);
  assert.match(client, /localStorage/);
  assert.match(client, /mutationQueue/);
  assert.match(client, /salvarMutacoesDashboard/);
  assert.match(client, /XsteamApi\.call/);
  assert.doesNotMatch(client, /google\.script\.run/);
  assert.doesNotMatch(client, /\.contato\b/);
  assert.doesNotMatch(client, /\.x-mark/);
  assert.doesNotMatch(client, /innerHTML\s*=/);
});

test('cliente diferencia dados em cache de dados confirmados pela base', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(client, /Sem conexão com a base\. Exibindo dados salvos neste dispositivo\./);
  assert.match(client, /Não foi possível conectar à base\. Verifique a conexão e tente novamente\./);
});

test('cliente oferece filtro Matriculados e normaliza os três status elegíveis', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(client, /__matriculados__/);
  assert.match(client, /function isEnrolledStatus\(status\)/);
  assert.match(client, /ativo.*bloqueado.*licenca/s);
});

test('cliente mantém filas e categorias independentes para fichas e avaliações', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(client, /function followDefinitions\(kind\)/);
  assert.match(client, /function groupFollowQueue\(kind, people\)/);
  assert.match(client, /function openFollowQueue\(kind, stateName\)/);
  assert.match(client, /followCategory/);
  assert.match(client, /sem_ficha/);
  assert.match(client, /sem_avaliacao/);
});

test('Home renderiza duas filas separadas e financeiro secundário', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  assert.match(client, /function renderHomeQueue\(kind, people\)/);
  assert.match(client, /function renderFinancialHome\(data\)/);
  assert.match(client, /home-operation-grid/);
  assert.match(client, /operationalBlocks\.sort\(function \(a, b\) \{ return a\.ordem - b\.ordem; \}\)/);
  assert.doesNotMatch(client, /var missing = prescriptions[^;]+concat\(evaluations/s);
  assert.match(css, /\.home-operation-grid/);
});

test('Financeiro possui terceira subaba de Permanência sem fórmula de LTV', () => {
  const html = fs.readFileSync('pwa/index.html', 'utf8');
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  const module = fs.readFileSync('pwa/js/permanencia.js', 'utf8');
  assert.match(html, /data-subpage="permanencia"/);
  assert.match(html, /permanencia\.css/);
  assert.match(html, /permanencia\.js/);
  assert.match(client, /function renderPermanence\(data\)/);
  assert.match(client, /function showPermanenceDetail\(title, rows\)/);
  assert.doesNotMatch(client + module, /LTV potencial|valor\s*\*\s*meses|meses\s*\*\s*valor/i);
});

test('perfis usam módulo próprio, diálogo com abas e grade responsiva', () => {
  const html = fs.readFileSync('pwa/index.html', 'utf8');
  const client = fs.readFileSync('pwa/js/student-profiles.js', 'utf8');
  const css = fs.readFileSync('pwa/css/student-profiles.css', 'utf8');
  assert.match(html, /student-profiles\.css/);
  assert.match(html, /student-profiles\.js/);
  assert.match(client, /Perfis dos alunos/);
  assert.match(client, /Informações/);
  assert.match(client, /Configuração/);
  assert.match(client, /Agenda/);
  assert.match(client, /Em breve/);
  assert.match(client, /Mostrar mais/);
  assert.doesNotMatch(client, /innerHTML\s*=/);
  assert.match(css, /grid-template-columns:\s*repeat\(4/);
  assert.match(css, /@media\s*\(max-width:\s*1100px\)/);
  assert.match(css, /@media\s*\(max-width:\s*620px\)/);
});

test('controles operacionais não herdam aparência nativa do navegador', () => {
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  assert.match(css, /button \{[^}]*border: 0;[^}]*background: transparent;/);
  assert.match(css, /\.follow-row \.chip \{ justify-self: start; \}/);
});

test('Acompanhamento usa lista operacional própria sem informações financeiras', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(client, /function renderFollowList\(kind, people\)/);
  assert.match(client, /function showFollowDetail\(kind, person\)/);
  assert.match(client, /follow-list/);
  const detail = client.match(/function showFollowDetail[\s\S]*?\n  \}/)[0];
  assert.doesNotMatch(detail, /money\(|valorMensal|perfilPagamento|contratos/);
  assert.doesNotMatch(client, /b\.valorMensal-a\.valorMensal/);
  assert.match(client, /daysA=a\.classification\.days/);
  assert.match(client, /daysB=b\.classification\.days/);
  assert.match(client, /daysB-daysA/);
});

test('Configurações separa prazos, Home e perfil de pagamento', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  for (const fn of ['renderAlertSettings', 'renderHomeSettings', 'renderPaymentSettings', 'validateAlertRules']) {
    assert.match(client, new RegExp(`function ${fn}\\(`));
  }
  assert.match(client, /settingsSection/);
  assert.match(client, /settingsDirty/);
  assert.match(client, /beforeunload/);
  assert.match(client, /Prévia da Home/);
  assert.match(css, /\.settings-nav/);
});

test('Home integra perfis à fila otimista e Configurações mantém apenas o catálogo', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(client, /XSteamStudentProfiles\.renderSection/);
  assert.match(client, /patch\.tipo\s*===\s*'perfilAluno'/);
  assert.match(client, /XSteamStudentProfiles\.applyProfilePatch/);
  assert.match(client, /XSteamStudentProfiles\.rollbackProfilePatch/);
  assert.match(client, /profilesExpanded:\s*false/);
  assert.match(client, /expanded:\s*state\.profilesExpanded/);
  assert.match(client, /onExpandedChange:\s*function\s*\(expanded\)\s*\{\s*state\.profilesExpanded\s*=\s*expanded;/);
  assert.match(client, /xsteam-dashboard-bootstrap-v5/);
  assert.match(client, /Opções disponíveis para todos os perfis de alunos/);
  assert.doesNotMatch(client, /tipo:'perfilPagamento'/);
  assert.doesNotMatch(client, /settingsPaymentDraft/);
});

test('história operacional conecta Home, filas dedicadas e Configurações', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  const css = fs.readFileSync('pwa/css/dashboard.css', 'utf8');
  assert.match(client, /renderHomeQueue\('prescricoes'/);
  assert.match(client, /renderHomeQueue\('avaliacoes'/);
  assert.match(client, /openFollowQueue\(kind, group\.state\)/);
  assert.match(client, /renderFollowList\(kind,/);
  assert.match(client, /renderAlertSettings\(\)/);
  assert.match(client, /renderHomeSettings\(\)/);
  assert.match(client, /renderPaymentSettings\(\)/);
  assert.match(css, /@media \(max-width: 860px\)[^{]*\{[^}]*\.home-operation-grid/s);
});

test('planos abre detalhes por frequência e informa hora-aula média', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(client, /function valorPorAula\(contrato\)/);
  assert.match(client, /function showFinancialDetail\(title, contracts\)/);
  assert.match(client, /Faturamento do recorte/);
  assert.match(client, /Hora-aula média/);
  assert.match(client, /showHourlyValueDetail\(data\.contratos\)/);
  assert.match(client, /showFinancialDetail\('Plano ' \+ item\.label/);
});

test('mapa mensal encaminha cada quartil ao detalhe dos contratos', () => {
  const client = fs.readFileSync('pwa/js/dashboard.js', 'utf8');
  assert.match(client, /function contractsForMonthQuartile\(contracts, quartile\)/);
  assert.match(client, /detailsForContracts\(i\.label, contractsForMonthQuartile\(data\.contratos, i\.quartile\)\)/);
});
