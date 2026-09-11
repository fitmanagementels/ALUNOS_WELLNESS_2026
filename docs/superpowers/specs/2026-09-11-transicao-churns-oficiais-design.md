# Transição de Churns para a fonte oficial

## Objetivo

Substituir a lista operacional de Churns pela fonte oficial de cancelamentos, sem perder os dados preenchidos manualmente na lista atual. A lista resultante terá uma linha por aluno, usando o registro oficial com o vencimento mais recente como a última referência daquele aluno no ecossistema.

Esta transição é pontual e controlada: a fonte oficial não entra no repositório, não altera os arquivos fornecidos e não cria um importador semanal.

## Regras de consolidação

1. Normalizar o ID de aluno antes de qualquer comparação, tratando representações equivalentes como `123` e `123.0` como o mesmo ID.
2. Agrupar a fonte oficial por ID e selecionar a linha com o maior `Vencimento`. Ela forma a nova linha daquele aluno em Churns.
3. Dados oficiais prevalecem para nome, contrato/plano, valor, início, vencimento/data de saída, professor e modalidade.
4. Dados manuais existentes são trazidos pelo mesmo ID: telefone, profissional responsável, último personal, motivo de saída, sinais/contexto e ação de retenção.
5. Telefone permanece o valor anterior até uma fonte posterior de telefones atualizá-lo.
6. Não inferir nem mudar automaticamente o status do aluno pela data de vencimento. O vencimento é a referência da última permanência; a interpretação operacional continua humana.
7. Nenhum campo manual será sobrescrito pela fonte oficial. Campos de plano e data da lista anterior deixam de ser referência quando o valor oficial correspondente existir.

## Prévia obrigatória antes da troca

Antes de escrever `FLUXO_CHURNS`, o sistema produzirá uma aba de conferência, por exemplo `PREVIA_TRANSICAO_CHURNS`, sem alteração da lista usada pelo PWA.

O relatório terá uma linha por caso e mostrará, no mínimo: ID, nome anterior e oficial, vencimento anterior e oficial, plano oficial, telefone que será preservado e os indicadores dos campos manuais que serão transferidos.

Os grupos serão:

- **Migrará com dados manuais preservados**: ID presente nas duas listas.
- **Migrará sem dados manuais anteriores**: ID oficial sem registro na lista antiga.
- **Registro antigo sem correspondente oficial**: registro atual que não fará parte da nova lista principal.
- **Divergência para revisão**: ID ausente, vencimento ausente, mais de uma linha antiga manualmente preenchida para o mesmo ID, ou empate de maior vencimento na fonte oficial.

Casos de divergência não recebem uma escolha automática de dados manuais. Permanecem explicitamente identificados para decisão do usuário.

## Aplicação após revisão aprovada

Somente após a revisão do relatório e autorização explícita:

1. Criar uma cópia imutável e datada da `FLUXO_CHURNS` atual, incluindo cabeçalho e todos os dados manuais.
2. Validar novamente a fonte, o relatório e a contagem de IDs antes da escrita.
3. Substituir `FLUXO_CHURNS` pela lista consolidada, em uma única operação de escrita.
4. Registrar no histórico de importações a data, a fonte, as quantidades por grupo e o identificador da cópia de segurança.
5. Invalidar o cache do dashboard para o PWA receber a lista nova na próxima sincronização.

Se a validação falhar, a lista principal não é modificada. A cópia de segurança permite restaurar o estado anterior sem depender do arquivo original.

## Acesso no PWA

A lista de Churns continuará a operar por ID. O perfil do aluno poderá reutilizar os dados persistentes já existentes e apresentar o plano e o vencimento oficial que compõem a nova referência do churn. A tela não exibirá a prévia nem a cópia de segurança como lista operacional.

## Verificação

Antes da aplicação final, os testes devem cobrir:

- normalização e agrupamento por ID;
- escolha exclusiva do maior vencimento oficial;
- preservação de telefone e campos manuais;
- prioridade dos dados oficiais de plano e vencimento;
- classificação dos quatro grupos do relatório;
- ausência de escrita em `FLUXO_CHURNS` durante a prévia;
- criação da cópia de segurança e escrita atômica após aprovação;
- compatibilidade do contrato retornado ao PWA.
