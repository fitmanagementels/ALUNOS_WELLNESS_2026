# Churn — dados de cancelados e separação de contrato

**Data:** 29/07/2026
**Estado:** desenho aprovado; aguardando revisão do documento

## Objetivo

Ampliar o registro manual de `FLUXO_CHURNS` com telefone, frequência contratada e polo. Preparar uma cópia local do export de cancelados do TecnoFit, sem criar um importador nem conectar esse arquivo ao backend.

## Backend de Churn

`FLUXO_CHURNS` passa a ter as colunas abaixo, após `nome`:

1. `telefone`
2. `contrato_x_sem`
3. `polo`

`aluno_id` continua sendo a referência manual à `VISAO_MESTRE`; não será modificado ou validado nesta etapa. O formulário, o payload seguro, as mutações e a lista de Churn passam a carregar e permitir editar os três campos. Telefone, frequência e polo são opcionais, para aceitar registros manuais incompletos.

## Cópia do export de cancelados

O arquivo de origem é um documento HTML exportado com extensão `.xls`. Será gerada uma cópia `.xls` independente, mantendo os dados originais e acrescentando as colunas `Contrato (vezes/semana)` e `Polo`.

O contrato será interpretado assim:

- A frequência é o primeiro trecho antes do primeiro hífen: `3X` em `3X - XSTEAM WELLNESS CLUB - PERSONAL`.
- O polo é o maior prefixo conhecido após a frequência. O catálogo inicial é: `XSTEAM WELLNESS CLUB`, `GREENLIFE RIOMAR`, `GREENLIFE ALDEOTA`, `GREENLIFE CT`, `GREENLIFE`, `CB`, `PACOTE` e `FISIOTERAPIA`.
- Todo texto após o polo é descartado: `PULL`, `PERSONAL`, `RECOVERY`, `REABILITAÇÃO`, anos e observações entre parênteses não entram no polo.
- Contratos sem o padrão frequência–polo, como `AULA EXPERIMENTAL` ou `AULA DE CONSULTORIA`, permanecem com as duas novas colunas vazias.

## Integridade e testes

- A criação de abas preserva registros existentes e não limpa dados manuais.
- Edição de um Churn mantém telefone, frequência e polo; exclusão permanece exclusiva de Churn.
- Testes cobrem schema, payload, mutação, polos compostos e contratos sem padrão.
- A cópia tratada é salva no workspace e não muda o arquivo original enviado pelo usuário.
