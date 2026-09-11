# Churn e cancelados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** Acrescentar telefone, frequência e polo ao Churn, migrar a aba existente com segurança e entregar um export de cancelados separado em colunas.

**Architecture:** O schema de Churn recebe três colunas após nome; uma migração reconhece o cabeçalho antigo e desloca campos existentes. Funções puras identificam frequência e o maior polo conhecido, sendo reutilizadas pela cópia local do export.

**Tech Stack:** Google Apps Script, Node.js e HTML `.xls` compatível com Excel.

## Global Constraints

- Não criar importador do export de cancelados.
- Não alterar `aluno_id`.
- O arquivo de origem permanece intacto.

### Task 1: Schema e migração segura

**Files:** `apps-script/00_Config.gs`, `apps-script/04_PlanilhaRepositorio.gs`, `apps-script/15_DashboardFluxo.gs`, `tests/planilha-repositorio.test.js`, `tests/dashboard-fluxo.test.js`

- [ ] Escrever teste de header legado `churn_id,aluno_id,nome,polo,data_saida,...` que exige migração para `churn_id,aluno_id,nome,telefone,contrato_x_sem,polo,data_saida,...` preservando polo e data.
- [ ] Rodar `node tests/planilha-repositorio.test.js` e observar falha.
- [ ] Alterar schema e criar `migrarSchemaChurnFluxo_` que usa o header antigo como sinal, prepara linhas com três strings vazias após nome e regrava a aba uma vez.
- [ ] Rodar `node tests/planilha-repositorio.test.js tests/dashboard-fluxo.test.js` e observar sucesso.

### Task 2: Payload, mutação e export tratado

**Files:** `apps-script/14_DashboardMutacoes.gs`, `apps-script/DashboardClient.html`, `tests/dashboard-mutacoes.test.js`, `scripts/preparar-cancelados.js`

- [ ] Escrever testes que mantêm `telefone`, `contrato_x_sem` e `polo` ao salvar um Churn.
- [ ] Rodar `node tests/dashboard-mutacoes.test.js` e observar falha.
- [ ] Acrescentar os três campos opcionais ao payload e à linha de Churn; atualizar formulário/lista.
- [ ] Criar o script que lê o HTML, insere duas células por linha, extrai frequência e maior polo reconhecido e grava uma cópia `.xls` no workspace.
- [ ] Rodar `npm test`, `git diff --check` e conferir manualmente o cabeçalho e amostras da cópia gerada.
