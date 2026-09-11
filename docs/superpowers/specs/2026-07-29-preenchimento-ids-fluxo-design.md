# Preenchimento de IDs pendentes — Fluxo

**Data:** 29/07/2026
**Estado:** desenho aprovado; aguardando revisão do documento

## Objetivo

Permitir que registros inseridos manualmente em `FLUXO_LEADS` e `FLUXO_CHURNS` recebam IDs internos sem precisar abrir o PWA.

## Operação

O menu da planilha receberá o comando **TecnoFit → Preencher IDs pendentes de Fluxo**. Ao executá-lo, o Apps Script garante a estrutura das abas, lê as duas tabelas e identifica somente linhas que atendam às duas condições:

1. A coluna A (ID interno) está vazia.
2. A linha possui pelo menos um valor preenchido nas demais colunas do respectivo cabeçalho.

Cada linha elegível recebe um UUID novo na coluna A. IDs existentes nunca são modificados, linhas totalmente vazias são ignoradas e nenhum outro campo é alterado. Ao final, a planilha exibe uma confirmação com a quantidade de IDs preenchida em Leads e em Churns.

## Regras de Churn

`churn_id` é o ID interno da coluna A e é o único valor preenchido por este comando. `aluno_id`, na coluna B, é mantido exatamente como registrado manualmente. Espera-se que ele corresponda ao ID de `VISAO_MESTRE`, mas a etapa atual não valida nem sinaliza divergências.

## Integridade e testes

- A escrita ocorre somente na coluna A e somente para linhas elegíveis.
- A função usa UUIDs gerados pelo Apps Script, evitando colisões com IDs já gravados.
- Uma nova execução sem IDs pendentes não altera a planilha e informa zero para ambas as abas.
- Testes cobrirão Leads, Churns, linhas vazias, IDs preservados e preservação de `aluno_id`.
