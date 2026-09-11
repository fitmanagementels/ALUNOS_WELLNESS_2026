const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const profiles = require('../pwa/js/student-profiles.js');

test('gera a rota canônica de conversa no WhatsApp Web e wa.me no celular', () => {
  assert.equal(
    profiles.whatsappUrl('(85) 98840-0309', false),
    'https://web.whatsapp.com/send/?phone=5585988400309&text=&type=phone_number&app_absent=0'
  );
  assert.equal(
    profiles.whatsappUrl('+55 (85) 98840-0309', true),
    'https://wa.me/5585988400309'
  );
  assert.equal(profiles.whatsappUrl('9884-0309', false), '');
  assert.equal(profiles.whatsappUrl('', true), '');
});

test('detecta celular por User-Agent Client Hints e por fallback de user agent', () => {
  assert.equal(profiles.isMobileDevice({ userAgentData: { mobile: true } }), true);
  assert.equal(profiles.isMobileDevice({ userAgentData: { mobile: false } }), false);
  assert.equal(profiles.isMobileDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' }), true);
  assert.equal(profiles.isMobileDevice({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }), false);
  assert.equal(profiles.isMobileDevice(null), false);
});

test('contato do perfil oferece ação acessível e segura de WhatsApp', () => {
  const client = fs.readFileSync('pwa/js/student-profiles.js', 'utf8');
  assert.match(client, /function contactInfoItem\(doc, card, navigatorRef\)/);
  assert.match(client, /whatsappUrl\(card\.contato, isMobileDevice\(navigatorRef\)\)/);
  assert.match(client, /options\.navigator \|\| \(typeof navigator !== 'undefined' \? navigator : null\)/);
  assert.match(client, /target\s*=\s*'_blank'/);
  assert.match(client, /rel\s*=\s*'noopener noreferrer'/);
  assert.match(client, /Abrir WhatsApp com/);
  assert.match(client, /student-profile-contact-value/);
});

test('configuração do perfil fecha sem aguardar o servidor e deixa o erro para a fila global', () => {
  const client = fs.readFileSync('pwa/js/student-profiles.js', 'utf8');
  assert.match(client, /function profileSaveErrorMessage\(error\)/);
  assert.match(client, /Promise\.resolve\(options\.onSave\(patch\)\)\.catch\(function \(\) \{\}\);/);
  assert.match(client, /dialog\.close\(\);/);
  assert.doesNotMatch(client, /Promise\.resolve\(options\.onSave\(patch\)\)\.then/);
});

test('perfis começam recolhidos e o controle anuncia os dois estados', () => {
  const attributes = {};
  const classes = new Set();
  const toggle = {
    setAttribute(name, value) { attributes[name] = String(value); },
    classList: {
      toggle(name, active) {
        if (active) classes.add(name);
        else classes.delete(name);
      }
    }
  };
  const panel = { hidden: false };

  profiles.setProfilesExpanded(toggle, panel, false);
  assert.equal(panel.hidden, true);
  assert.equal(attributes['aria-expanded'], 'false');
  assert.equal(attributes['aria-label'], 'Expandir perfis dos alunos');
  assert.equal(classes.has('is-expanded'), false);

  profiles.setProfilesExpanded(toggle, panel, true);
  assert.equal(panel.hidden, false);
  assert.equal(attributes['aria-expanded'], 'true');
  assert.equal(attributes['aria-label'], 'Recolher perfis dos alunos');
  assert.equal(classes.has('is-expanded'), true);
});

test('seção liga o botão retrátil ao painel sem persistir preferência', () => {
  const client = fs.readFileSync('pwa/js/student-profiles.js', 'utf8');
  assert.match(client, /student-profiles-collapse/);
  assert.match(client, /student-profiles-content/);
  assert.match(client, /aria-controls/);
  assert.match(client, /setProfilesExpanded\(toggle, content, options\.expanded === true\)/);
  assert.match(client, /options\.onExpandedChange\(!content\.hidden\)/);
  assert.doesNotMatch(client, /localStorage/);
});

test('cartões contêm nomes e status longos dentro de cada coluna', () => {
  const css = fs.readFileSync('pwa/css/student-profiles.css', 'utf8');
  assert.match(css, /\.student-profile-card\s*\{[^}]*min-width:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.student-profile-card-head\s*\{[^}]*min-width:\s*0[^}]*width:\s*100%/s);
  assert.match(css, /\.student-profile-card-head\s*>\s*span:first-child\s*\{[^}]*flex:\s*1\s+1\s+auto[^}]*min-width:\s*0/s);
  assert.match(css, /\.student-profile-card-head\s*>\s*\.chip\s*\{[^}]*flex:\s*0\s+0\s+auto[^}]*max-width:/s);
});

test('seleciona contrato ativo mais recente e filtra por nome ou ID', () => {
  const cards = profiles.buildStudentCards({
    alunos: [{
      id: '42', aluno: 'MARIA SAÚDE', contato: '85999999999', status: 'Ativo',
      dataFicha: '10/08/2026', dataAvaliacao: '11/08/2026'
    }],
    contratos: [
      { id: '42', statusContrato: 'Cancelado', vencimento: '20/09/2026', frequencia: '1X' },
      { id: '42', statusContrato: 'Ativo', vencimento: '10/09/2026', frequencia: '3X' },
      { id: '42', statusContrato: 'Ativo', vencimento: '30/09/2026', frequencia: '2X' }
    ],
    perfisAlunos: [{
      id: '42', professorResponsavel: 'Elohim', perfilPagamento: 'Bom pagador',
      etiquetasPublico: ['saude'], etiquetasComerciais: []
    }],
    catalogoPerfisAlunos: [
      { tipo: 'etiqueta', grupo: 'publico', chave: 'saude', titulo: 'Saúde', ativo: true, ordem: 10 }
    ]
  });

  assert.equal(cards[0].contratoPrincipal.frequencia, '2X');
  assert.equal(cards[0].etiquetas[0], 'Saúde');
  assert.equal(profiles.filterStudentCards(cards, '42')[0].aluno, 'MARIA SAÚDE');
  assert.equal(profiles.filterStudentCards(cards, 'maria saude').length, 1);
});

test('perfil associa permanência por ID e mantém valor atual separado', () => {
  const cards = profiles.buildStudentCards({
    alunos: [{ id: '42', aluno: 'ALUNO TESTE', status: 'Ativo' }],
    contratos: [{ id: '42', contrato: '3X', valor: 900, statusContrato: 'Ativo' }],
    permanencia: [{
      id: '42', clienteDesde: '10/01/2024', status: 'Ativo', quantidadeContratos: 3
    }],
    perfisAlunos: [], catalogoPerfisAlunos: []
  });
  assert.equal(cards[0].permanencia.clienteDesde, '10/01/2024');
  assert.equal(cards[0].contratoPrincipal.valor, 900);
  assert.equal('ltv' in cards[0], false);
});

test('aplica e reverte criação e atualização otimistas', () => {
  const bootstrap = {
    perfisAlunos: [{ id: '42', professorResponsavel: 'Cadu', etiquetasPublico: [] }]
  };
  const updateRollback = profiles.applyProfilePatch(bootstrap, {
    id: '42', professorResponsavel: 'Elohim', etiquetasPublico: ['saude']
  });
  assert.equal(bootstrap.perfisAlunos[0].professorResponsavel, 'Elohim');
  profiles.rollbackProfilePatch(bootstrap, updateRollback);
  assert.equal(bootstrap.perfisAlunos[0].professorResponsavel, 'Cadu');

  const createRollback = profiles.applyProfilePatch(bootstrap, {
    id: '43', professorResponsavel: 'Wallyson'
  });
  assert.equal(bootstrap.perfisAlunos.length, 2);
  profiles.rollbackProfilePatch(bootstrap, createRollback);
  assert.equal(bootstrap.perfisAlunos.length, 1);
});

test('monta opções por status, preserva professor histórico e cria patch completo', () => {
  const catalog = [
    { tipo: 'professor', grupo: 'matriculados', chave: 'aquiles', titulo: 'Aquiles', ativo: true, ordem: 10 },
    { tipo: 'professor', grupo: 'cancelados', chave: 'wallyson', titulo: 'Wallyson', ativo: true, ordem: 10 },
    { tipo: 'perfil_pagamento', grupo: 'global', chave: 'bom_pagador', titulo: 'Bom pagador', ativo: true, ordem: 10 },
    { tipo: 'etiqueta', grupo: 'publico', chave: 'idoso', titulo: 'Idoso', ativo: true, ordem: 10 },
    { tipo: 'etiqueta', grupo: 'comercial', chave: 'risco_de_churn', titulo: 'Risco de Churn', ativo: true, ordem: 10 }
  ];
  const card = {
    id: '43', aluno: 'ALUNO CANCELADO', status: 'Cancelado',
    perfil: { professorResponsavel: 'Professor antigo', ultimosProfessores: ['Wallyson'] }
  };

  const options = profiles.profileFormOptions(card, catalog);
  assert.deepEqual(options.professores.map(item => item.titulo), ['Wallyson', 'Professor antigo (histórico)']);
  assert.equal(options.pagamentos[0].titulo, 'Bom pagador');

  assert.deepEqual(profiles.createProfilePatch(card, {
    professorResponsavel: 'Wallyson', ultimosProfessores: ['Wallyson'], perfilPagamento: 'Bom pagador',
    observacaoPagamento: 'Paga em dia', etiquetasPublico: ['idoso', 'performance'],
    etiquetasComerciais: ['risco_de_churn', 'coach'], observacoesGerais: 'Treina cedo'
  }), {
    tipo: 'perfilAluno',
    valores: {
      id: '43', aluno: 'ALUNO CANCELADO', professorResponsavel: 'Wallyson', ultimosProfessores: ['Wallyson'],
      perfilPagamento: 'Bom pagador', observacaoPagamento: 'Paga em dia',
      etiquetasPublico: ['idoso', 'performance'], etiquetasComerciais: ['risco_de_churn', 'coach'],
      observacoesGerais: 'Treina cedo'
    }
  });
  const client = fs.readFileSync('pwa/js/student-profiles.js', 'utf8');
  assert.match(client, /Último professor/);
  assert.match(client, /student-profile-multiselect/);
});
