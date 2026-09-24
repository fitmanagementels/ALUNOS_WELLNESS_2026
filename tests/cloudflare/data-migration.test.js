const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const XLSX = require('xlsx');
const { build } = require('../../scripts/build-d1-seed');

function workbook(file, sheets) {
  const book = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name));
  XLSX.writeFile(book, file);
}

test('migração usa dados oficiais e preserva campos manuais por ID', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xsteam-seed-test-'));
  const master = path.join(dir, 'master.xlsx');
  const churns = path.join(dir, 'churns.xlsx');
  const newStudents = path.join(dir, 'new.xlsx');
  workbook(master, {
    BASE_ALUNOS: [['id', 'aluno', 'contato', 'status', 'inicio_plano', 'data_ficha', 'data_avaliacao', 'importacao_id'], ['42', 'NOME ANTIGO', '85999999999', 'Ativo', '01/01/2026', '', '', 'batch-1']],
    CONTRATOS: [['_chave_contrato', 'id', 'contrato_completo', 'contrato_x_sem', 'valor', 'inicio_corrente', 'vencimento', 'status_contrato', 'polo', 'modalidade', 'importacao_id'], ['c42', '42', '2X', '2X', 765, '01/01/2026', '01/09/2026', 'Ativo', 'XSTEAM WELLNESS CLUB', 'MUSCULAÇÃO', 'batch-1']],
    BASE_PERMANENCIA: [['id']], HISTORICO_PERMANENCIA: [['evento_id']], PERFIS_ALUNOS: [['id', 'aluno', 'professor_responsavel', 'ultimos_professores', 'perfil_pagamento', 'observacao_pagamento', 'etiquetas_publico', 'etiquetas_comerciais', 'observacoes_gerais', 'atualizado_em'], ['42', 'NOME ANTIGO', 'Elohim', '["Ruan"]', 'Bom pagador', 'Em dia', '["Performance"]', '["Coach"]', 'Observação manual', '01/09/2026']],
    FLUXO_LEADS: [['lead_id']], FLUXO_CHURNS: [['churn_id', 'aluno_id', 'nome', 'telefone', 'data_saida', 'profissional_responsavel', 'ultimo_personal', 'motivo_saida', 'sinais_contexto', 'acao_retencao', 'criado_em', 'atualizado_em'], ['old-42', '42', 'NOME ANTIGO', '85999999999', '01/08/2026', 'Ruan', 'Ruan', 'Manual', 'Contexto', 'Ligação', '', '']],
    CONFIG_DASHBOARD: [['tipo']], CONFIG_ALERTAS: [['tipo']], IMPORTACOES: [['execucao_id', 'data_hora_inicio', 'data_hora_fim', 'tipo_arquivo', 'nome_arquivo', 'drive_file_id', 'data_referencia', 'revisao', 'linhas_lidas', 'linhas_validas', 'linhas_rejeitadas', 'status', 'mensagem'], ['batch-1', '', '', '', '', '', '01/09/2026', 1, '', '', '', 'SUCESSO', '']]
  });
  workbook(churns, { Cancelados: [['Código', 'Cliente', 'Status Cliente', 'Contrato', 'Valor', 'Início', 'Vencimento', 'Status Contrato', 'Consultor', 'Professor', 'Modalidade'], ['42', 'NOME OFICIAL', 'Cancelado', '3X', 850, '01/05/2026', '15/09/2026', 'Cancelado', '', '', 'MUSCULAÇÃO']] });
  workbook(newStudents, { Novos: [['Data da Venda', 'Aluno', 'Código', 'Pacote', 'Polo', 'Valor'], ['10/09/2026', 'ALUNO NOVO', '99', '2X', 'XSTEAM WELLNESS CLUB', 700]] });
  const sql = build(master, churns, newStudents).sql;
  assert.match(sql, /NOME OFICIAL/);
  assert.match(sql, /'Manual'/);
  assert.match(sql, /'Observação manual'/);
  assert.match(sql, /'publico:performance'/);
  assert.match(sql, /'comercial:coach'/);
  assert.match(sql, /'99'/);
  assert.match(sql, /BEGIN TRANSACTION/);
  assert.match(sql, /COMMIT/);
});
