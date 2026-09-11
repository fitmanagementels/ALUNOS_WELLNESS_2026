# Confiabilidade de Salvamento dos Perfis de Alunos

## Objetivo

Permitir que as configurações dos perfis sejam gravadas no PWA com confirmação real do servidor e impedir que uma publicação deixe o frontend incompatível com o Apps Script.

## Fluxo diário

1. A pessoa abre o perfil, ajusta responsável, pagamento, etiquetas ou observações e seleciona salvar.
2. O PWA mantém o diálogo aberto enquanto a solicitação é enviada.
3. Em sucesso, o diálogo fecha e o rodapé mostra `Salvo`.
4. Em falha, o diálogo permanece aberto, restaura o estado anterior e informa uma mensagem segura com a ação de tentar novamente.

## Contrato de dados

- O patch `perfilAluno` mantém o formato atual: `{ tipo: 'perfilAluno', valores: { id, aluno, professorResponsavel, perfilPagamento, observacaoPagamento, etiquetasPublico, etiquetasComerciais, observacoesGerais } }`.
- `salvarMutacoesDashboard` confirma a escrita antes de o PWA considerar o formulário salvo.
- Erros públicos permanecem sem detalhes internos ou dados de alunos; o PWA converte os códigos seguros em orientação operacional.

## Sincronização e publicação

- A fila de mutações devolve uma Promise por alteração, resolvida apenas após resposta positiva do Worker.
- O serviço de publicação do Apps Script deixa de ter sucesso silencioso: sem as credenciais necessárias, o workflow falha e bloqueia a publicação correspondente.
- O workflow de Pages verifica a capacidade de salvamento de perfis da API antes de publicar o PWA. Uma versão de frontend não será disponibilizada se o backend ativo não anunciar suporte a `perfilAluno`.
- Alterações que envolvam Apps Script e PWA usam o mesmo contrato de capacidade, validado por testes automatizados.

## Critérios de aceite

- Uma falha de gravação não fecha o perfil nem apresenta `Salvo`.
- Um sucesso de gravação fecha o perfil somente após a confirmação remota.
- O Apps Script anuncia explicitamente a capacidade `perfilAluno` na resposta de versão.
- O CI falha se o Apps Script não estiver configurado para publicação ou se a API publicada não tiver a capacidade necessária ao PWA.
- Os testes locais cobrem os estados de sucesso, falha e o contrato de publicação.
