# Perfis de alunos na Home

Data: 18 de agosto de 2026

## Contexto

O PWA XSTEAM usa a Home como visão operacional da base TecnoFit. O gestor precisa localizar alunos do recorte global, consultar dados detalhados e manter informações manuais que não podem ser perdidas nas importações periódicas.

Este projeto será implementado no repositório `/home/elohimlima/Downloads/VSCODE|ANTIGRAVITY/BASE_TECNOFIT`. O repositório atual guarda a especificação e o plano. Existe outro trabalho em andamento que reorganiza a Home e as Configurações; por isso, a integração deste recurso deve ocorrer depois dessa alteração e com módulos isolados.

## Objetivo

Adicionar à Home uma seção de perfis dos alunos que respeite os filtros globais. Cada cartão abre um diálogo com uma aba de informações e outra de configuração manual do aluno.

## Recorte inicial

- O PWA inicia com `Matriculados` e `XSTEAM WELLNESS CLUB` selecionados.
- A seção respeita os filtros globais de status e polo.
- `Matriculados` representa os status já tratados pelo PWA como ativo, bloqueado ou licença.
- O campo de busca da seção encontra por nome ou ID.
- A primeira página mostra 24 cartões; `Mostrar mais` acrescenta outros 24.

## Cartões

Em telas largas, a grade usa quatro colunas; em tablet, duas; no celular, uma. Cada cartão inteiro é acionável e apresenta:

- nome;
- ID;
- status;
- frequência do contrato principal;
- professor responsável, ou `Sem responsável`;
- até três etiquetas e a quantidade excedente.

O contrato principal é o contrato ativo com vencimento mais recente. Na ausência dele, usa-se o contrato com vencimento mais recente. Alunos sem contrato no polo selecionado não aparecem, preservando a interseção já usada pelos filtros globais.

## Diálogo do perfil

O diálogo possui duas abas e preserva foco, navegação por teclado e fechamento por `Esc`. No celular ocupa a tela disponível.

### Informações

Somente leitura:

- nome e ID;
- contato;
- status do aluno;
- contrato;
- frequência;
- valor;
- vencimento;
- polo;
- modalidade;
- data da ficha/prescrição;
- data da avaliação.

Quando houver mais de um contrato, o contrato principal aparece primeiro e os demais ficam em uma relação secundária.

### Configuração

Campos editáveis:

- professor responsável único;
- perfil de pagamento;
- etiquetas do grupo `Público`;
- etiquetas do grupo `Comercial`;
- observação de pagamento, preservada da estrutura antiga;
- observações gerais, com até 3.000 caracteres.

A agenda aparece desabilitada com o texto `Em breve`. A primeira versão não cria campos de agenda na planilha.

O formulário tem uma ação `Salvar configurações`. Durante o envio, o botão informa `Salvando…`; sucesso e erro usam o mecanismo de feedback e nova tentativa já existente.

## Catálogos iniciais

Os catálogos ficam na planilha, não espalhados como constantes na interface.

### Professores para matriculados

- Iranildo
- Elohim
- Xico
- Aquiles
- Ruan
- Cadu

### Professores para cancelados

- Iranildo
- Elohim
- Xico
- Ruan
- Cadu
- Wallyson
- Lucas
- Genuca

### Etiquetas do grupo Público

- Idoso
- Saúde
- Estética
- Dores
- Corrida

### Etiquetas do grupo Comercial

- Risco de Churn
- Sem fidelização
- Elohim

Um aluno pode receber várias etiquetas dos dois grupos. Um professor histórico que deixou o catálogo permanece visível e não é apagado automaticamente; ele só é substituído por escolha explícita.

## Estrutura da planilha

### `PERFIS_ALUNOS`

Uma linha por ID de aluno:

1. `id`
2. `aluno`
3. `professor_responsavel`
4. `perfil_pagamento`
5. `observacao_pagamento`
6. `etiquetas_publico`
7. `etiquetas_comerciais`
8. `observacoes_gerais`
9. `atualizado_em`

As etiquetas são gravadas como arrays JSON. As linhas são atualizadas por ID, sob o mesmo lock e controle de idempotência usado pelas mutações atuais.

### `CONFIG_PERFIS_ALUNOS`

Catálogo editável:

1. `tipo`
2. `grupo`
3. `chave`
4. `titulo`
5. `ativo`
6. `ordem`

Os tipos iniciais são `professor`, `etiqueta` e `perfil_pagamento`. Os grupos são `matriculados`, `cancelados`, `publico`, `comercial` e `global`, conforme o tipo.

## Migração

Ao garantir as tabelas do dashboard:

1. criar `PERFIS_ALUNOS` e `CONFIG_PERFIS_ALUNOS` se não existirem;
2. semear o catálogo somente quando estiver vazio;
3. se `PERFIS_ALUNOS` estiver vazio, copiar de `GESTAO_PAGAMENTOS` o ID, nome, perfil de pagamento e observação;
4. gravar a observação antiga em `observacao_pagamento`;
5. manter `GESTAO_PAGAMENTOS` intacta como legado e interromper novas escritas da interface nela.

A migração é idempotente e nunca sobrescreve uma linha já existente em `PERFIS_ALUNOS`.

## API e validação

O bootstrap passa a incluir `perfisAlunos` e `catalogoPerfisAlunos`. O aluno seguro passa a fornecer `contato`, necessário para a aba Informações. O contato não deve aparecer em logs ou mensagens de erro.

Uma nova mutação `perfilAluno` faz upsert por ID. O servidor valida:

- ID e nome obrigatórios;
- perfil de pagamento ativo no catálogo;
- etiquetas ativas e pertencentes ao grupo correto;
- professor ativo no grupo correspondente ao status atual, ou valor histórico já salvo;
- limites de 1.000 caracteres para observação de pagamento e 3.000 para observações gerais.

O tipo antigo `perfilPagamento` permanece aceito temporariamente para compatibilidade, mas a nova interface não o envia.

## Configurações globais

A edição individual de perfil de pagamento sai de Configurações. A página mantém somente o catálogo global de opções de pagamento. Os filtros persistidos antigos com status `Ativo` são interpretados como `__matriculados__`, evitando que um cache antigo abra com um recorte menor.

## Estados e recuperação

- Carregamento: usar esqueleto ou mensagem, sem cartões falsos.
- Sem resultados: mostrar `Nenhum aluno neste recorte` e manter busca/filtros disponíveis.
- Perfil sem linha manual: abrir com valores vazios e perfil `Sem histórico`.
- Salvamento otimista: atualizar cartão e diálogo imediatamente.
- Falha: restaurar o perfil anterior, manter o lote para nova tentativa e informar o erro.
- Catálogo alterado: valores históricos continuam legíveis mesmo quando inativos.

## Concorrência com a outra atualização da Home

- Não iniciar a execução em paralelo sobre os mesmos arquivos.
- Incorporar primeiro a atualização geral da Home.
- Criar `pwa/js/student-profiles.js`, `pwa/css/student-profiles.css` e `apps-script/18_DashboardPerfisAlunos.gs` como unidades próprias.
- Fazer alterações mínimas em `dashboard.js`, `index.html`, configuração, bootstrap e roteador de mutações.
- Antes de cada alteração compartilhada, executar `git status --short` e `git diff -- <arquivo>`; adaptar o encaixe ao código já incorporado.
- Nunca substituir por inteiro `renderHome`, `renderSettings` ou a fila de mutações sem preservar a implementação concorrente.

## Critérios de aceitação

- A abertura inicial seleciona `Matriculados` e `XSTEAM WELLNESS CLUB`.
- A grade muda imediatamente quando status, polo ou busca mudam.
- Cada cartão abre o aluno correto e mostra as duas abas.
- O professor disponível muda entre o catálogo de matriculados e cancelados.
- Várias etiquetas podem ser salvas e reabertas sem perda.
- Perfil de pagamento e observações permanecem após nova importação TecnoFit.
- A agenda aparece como `Em breve` e não cria colunas prematuras.
- O formulário individual de pagamento não aparece mais em Configurações.
- A interface funciona em desktop, tablet, celular e por teclado.
- A migração preserva todos os dados existentes em `GESTAO_PAGAMENTOS`.

## Verificação

- Testes de criação de abas, cabeçalhos, catálogo e migração idempotente.
- Testes de leitura, serialização, validação e upsert de perfil.
- Testes do bootstrap e da compatibilidade com `perfilPagamento`.
- Testes do filtro inicial, busca, paginação, seleção de contrato e renderização do diálogo.
- Teste de rollback e nova tentativa da mutação otimista.
- Verificação visual nas larguras 1440, 1024, 768 e 390 pixels.
- Execução de toda a suíte Node antes da entrega.

## Fora do escopo

- Implementar agenda do aluno.
- Disparar cobranças, mensagens ou contatos automáticos.
- Excluir imediatamente a aba legada `GESTAO_PAGAMENTOS`.
- Alterar as regras de importação das abas TecnoFit.
