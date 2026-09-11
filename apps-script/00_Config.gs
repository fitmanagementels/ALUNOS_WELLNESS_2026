var CONFIG = Object.freeze({
  planilhaId: '1I63DuNBk1mR-U5gNe9EvGhSu-QryqXxfVrG0RC0vtfM',
  pastaEntradaId: '1-kQzPkz4aGkby2fgOG7tOmWUPVjZ7A0R',
  pastaProcessadosId: '1t8GJKi_VDI8kSEzxv1Q0wxk1evzOPSUr',
  pastaRejeitadosId: '1ttdgt5lvXwEacgkDYurhuMoZ09yPENNb',
  fusoHorario: 'America/Fortaleza',
  dashboard: Object.freeze({
    diasFicha: 30,
    diasAvaliacao: 90,
    cacheSegundos: 300,
    chartJsUrl: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
    propriedadeVersao: 'tecnofit.dashboard.versao',
    propriedadeVersaoChurn: 'tecnofit.dashboard.churn.versao',
    propriedadeUrlPwa: 'tecnofit.dashboard.public_url'
  }),
  tiposObrigatorios: Object.freeze(['vencimentos', 'fichas', 'avaliacao_fisica', 'permanencia']),
  abas: Object.freeze({
    alunos: 'BASE_ALUNOS',
    contratos: 'CONTRATOS',
    visaoMestre: 'VISAO_MESTRE',
    basePermanencia: 'BASE_PERMANENCIA',
    historicoPermanencia: 'HISTORICO_PERMANENCIA',
    importacoes: 'IMPORTACOES',
    configDashboard: 'CONFIG_DASHBOARD',
    configAlertas: 'CONFIG_ALERTAS',
    gestaoPagamentos: 'GESTAO_PAGAMENTOS',
    perfisAlunos: 'PERFIS_ALUNOS',
    configPerfisAlunos: 'CONFIG_PERFIS_ALUNOS',
    fluxoLeads: 'FLUXO_LEADS',
    fluxoChurns: 'FLUXO_CHURNS'
  }),
  cabecalhos: Object.freeze({
    alunos: Object.freeze([
      'id', 'aluno', 'contato', 'status', 'inicio_plano', 'data_ficha',
      'data_avaliacao', 'importacao_id'
    ]),
    contratos: Object.freeze([
      '_chave_contrato', 'id', 'contrato_completo', 'contrato_x_sem', 'valor',
      'inicio_corrente', 'vencimento', 'status_contrato', 'polo', 'modalidade',
      'importacao_id'
    ]),
    visaoMestre: Object.freeze([
      'id', 'aluno', 'contato', 'status', 'contrato_x_sem', 'valor',
      'inicio_plano', 'inicio_corrente', 'vencimento', 'polo', 'data_ficha',
      'data_avaliacao', '_chave_contrato'
    ]),
    basePermanencia: Object.freeze([
      'id', 'aluno', 'cliente_desde', 'status_permanencia', 'continuidade_meses_origem',
      'quantidade_contratos_origem', 'primeira_observacao_em', 'ultima_observacao_em',
      'presente_ultimo_lote', 'importacao_id'
    ]),
    historicoPermanencia: Object.freeze([
      'evento_id', 'id', 'data_referencia', 'tipo_evento', 'campo', 'valor_anterior',
      'valor_novo', 'importacao_id', 'registrado_em'
    ]),
    importacoes: Object.freeze([
      'execucao_id', 'data_hora_inicio', 'data_hora_fim', 'tipo_arquivo',
      'nome_arquivo', 'drive_file_id', 'data_referencia', 'revisao',
      'linhas_lidas', 'linhas_validas', 'linhas_rejeitadas', 'status', 'mensagem'
    ]),
    configDashboard: Object.freeze([
      'tipo', 'chave', 'ativo', 'ordem', 'valor', 'titulo', 'estados'
    ]),
    configAlertas: Object.freeze([
      'tipo', 'chave', 'ativo', 'ordem', 'valor', 'titulo', 'estados'
    ]),
    gestaoPagamentos: Object.freeze([
      'id', 'aluno', 'perfil_pagamento', 'observacao', 'atualizado_em'
    ]),
    perfisAlunos: Object.freeze([
      'id', 'aluno', 'professor_responsavel', 'ultimos_professores', 'perfil_pagamento',
      'observacao_pagamento', 'etiquetas_publico', 'etiquetas_comerciais',
      'observacoes_gerais', 'atualizado_em'
    ]),
    configPerfisAlunos: Object.freeze([
      'tipo', 'grupo', 'chave', 'titulo', 'ativo', 'ordem'
    ]),
    fluxoLeads: Object.freeze([
      'lead_id', 'nome', 'telefone', 'origem', 'indicacao', 'primeiro_contato',
      'experimental', 'professor_experimental', 'entrada_como_cliente', 'status',
      'plano_contratado', 'valor_pacote', 'minirrelatorio_venda', 'criado_em', 'atualizado_em'
    ]),
    fluxoChurns: Object.freeze([
      'churn_id', 'aluno_id', 'nome', 'telefone', 'data_saida', 'profissional_responsavel',
      'ultimo_personal', 'motivo_saida', 'sinais_contexto', 'acao_retencao', 'criado_em', 'atualizado_em'
    ])
  })
});

var CABECALHOS_ORIGEM = Object.freeze({
  vencimentos: Object.freeze([
    'codigo', 'cliente', 'status cliente', 'contrato', 'valor', 'inicio',
    'vencimento', 'status contrato', 'modalidade'
  ]),
  fichas: Object.freeze(['codigo', 'data inicio', 'contato']),
  avaliacao_fisica: Object.freeze(['codigo', 'data da avaliacao']),
  permanencia: Object.freeze([
    'codigo', 'cliente', 'cliente desde', 'status atual', 'continuidade (meses)', 'contratos'
  ])
});
