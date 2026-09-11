# Contexto do Projeto — XSTEAM Gestão de Agenda

Última atualização: 11/09/2026 16:08 (America/Fortaleza)

## Resumo executivo

- Este repositório contém a **Gestão de Agenda fixa semanal** da XSTEAM Wellness Club, executada em Google Apps Script e ligada a uma planilha Google Sheets.
- O fluxo operacional transforma `Base -> Dados -> AGENDA`, preservando por ID os campos manuais de status, professor, dia, horário e observações.
- O aplicativo já oferece mapa de calor, agenda por dia/professor, métricas de professores, busca de alunos e edição de até seis horários por aluno.
- A regra central testada é: atualizar a base ou a agenda não pode apagar as informações manuais de um aluno já existente.
- Em 11/09/2026, `npm test` passou e o código, os testes, os planos e este contexto foram versionados.
- O backup foi conectado a `git@github.com:fitmanagementels/ALUNOS_WELLNESS_2026.git` e enviado para a branch `main`.
- Este projeto não deve ser confundido com o repositório irmão `../BASE_TECNOFIT`, que contém o dashboard Home/Financeiro/Acompanhamento/Fluxo/Configurações e a funcionalidade de permanência.

## Objetivo do projeto

- **Objetivo principal:** apoiar a operação diária da agenda fixa dos alunos e visualizar a ocupação e a carga dos professores.
- **Resultado esperado:** uma PWA Apps Script responsiva, confiável e simples de atualizar a partir da planilha, sem perda de preenchimentos manuais.
- **Usuários/público-alvo:** gestores e equipe operacional da XSTEAM Wellness Club.
- **Critérios de sucesso:** dados da aba `AGENDA` carregam corretamente; filtros e visões funcionam; alterações individuais são persistidas; atualizações automáticas preservam dados manuais; testes do núcleo continuam passando.

## Estado atual

- **Etapa atual:** base funcional da Gestão de Agenda concluída e protegida por backup no GitHub.
- **Status geral:** funcional localmente, teste do núcleo aprovado e branch `main` sincronizada; implantação remota Apps Script não está configurada nesta pasta.
- **Última ação relevante:** histórico local consolidado com o repositório remoto e primeiro backup completo enviado ao GitHub.
- **Próxima decisão necessária:** definir depois se a Gestão de Agenda continuará como produto separado ou será integrada ao dashboard do repositório `BASE_TECNOFIT`.
- **Onde parei:** backup concluído; a próxima evolução técnica pode começar a partir da branch `main`.
- **O que falta para continuar:** escolher a próxima evolução do produto; a recomendação é documentar instalação/deploy e configurar `clasp`.

## Fatos observados no repositório

- Branch local encontrada: `master`.
- HEAD antes do backup: `8d7ffcfef92860519746fd1b1cd86b32d6a4f3cb`.
- Histórico existente antes do backup: dois commits, ambos somente de documentação de design.
- Arquivos rastreados antes do backup: três documentos em `docs/superpowers/`.
- Código em `Appscript/`, teste, `package.json`, `.gitignore` e o contexto legado estavam sem rastreamento.
- Não havia `origin` nem outro remoto configurado.
- Não há `.clasp.json`; a associação desta pasta com um projeto Apps Script remoto não está registrada.
- Não há `README.md` de instalação e implantação.
- Depois da auditoria, o remoto `origin` foi configurado para `fitmanagementels/ALUNOS_WELLNESS_2026` e a branch local foi renomeada de `master` para `main`.

## Histórico relevante

| Data/commit | Mudança | Impacto |
|---|---|---|
| 26/06/2026 | Base funcional da Gestão de Agenda criada localmente | Entregou leitura, transformação, interface e edição da agenda |
| `0511e8d` | Especificação de Home e Configurações operacionais | Registrou decisões para o dashboard de outro repositório |
| `8d7ffcf` | Especificação e plano de perfis de alunos | Documentou uma evolução destinada ao repositório `BASE_TECNOFIT` |
| 11/09/2026 | Contexto canônico atualizado e teste executado | Preparou o projeto para versionamento completo e backup no GitHub |
| `99b23ec` | Código, testes, planos e contexto entraram no histórico | Criou um ponto local completo de restauração |
| `667d348` | Históricos local e remoto foram consolidados e enviados | Tornou `origin/main` um backup completo do estado atual |

## Decisões tomadas

- Manter a planilha como fonte de dados operacional e o Apps Script como backend da interface.
- Isolar regras puras em `AgendaCore.gs` para permitir testes no Node sem depender do Apps Script.
- Usar o ID do aluno como chave de preservação dos campos manuais durante a regeneração da aba `AGENDA`.
- Aceitar até seis blocos de agenda fixa por aluno.
- Tratar este repositório de Gestão de Agenda separadamente do dashboard `BASE_TECNOFIT` até uma decisão explícita de integração.
- Não aplicar aqui, por engano, os planos de Home, Configurações e perfis que apontam explicitamente para `BASE_TECNOFIT`.

## Memória de decisões e justificativas

| Decisão | Por que foi tomada | Onde impacta | Como verificar/retomar |
|---|---|---|---|
| Preservar dados manuais pelo ID | A aba é regenerada a partir da base e não pode apagar o trabalho operacional | `Appscript/Code.gs`, aba `AGENDA` | Rodar `npm test` e revisar `atualizarAbaAgenda()` |
| Separar regras da infraestrutura | Facilita testes determinísticos fora do Google Apps Script | `Appscript/AgendaCore.gs`, `tests/agendaCore.test.js` | Rodar `npm test` |
| Planilha como fonte de verdade | É o banco operacional já usado pela equipe | `Appscript/Code.gs` | Confirmar nomes e cabeçalhos das abas antes de implantar |
| Agenda com seis slots por aluno | Abrange a frequência semanal prevista no modelo atual | `AgendaCore.gs`, `Index.html`, `Script.html` | Conferir `BLOCK_COUNT` e o formulário de edição |
| Manter projetos distintos | O código e a arquitetura desta pasta não correspondem às telas do dashboard TecnoFit | todo o repositório | Comparar com `../BASE_TECNOFIT` antes de portar recursos |

## Informações importantes capturadas do chat

- O usuário prefere execução direta e o mínimo possível de etapas manuais ou aprovações pequenas.
- Antes de sincronizar o projeto com o GitHub, o contexto deve ser atualizado.
- O objetivo imediato do GitHub é manter uma cópia segura na nuvem para reduzir o risco de perda do projeto.
- No dashboard do repositório irmão, fichas/prescrições e avaliações devem permanecer em filas independentes e exclusivas.
- No dashboard do repositório irmão, a planilha de permanência fornece a data de entrada; devem ser exibidos separadamente tempo de empresa e valor do pacote atual, sem estimar receita histórica/LTV pela multiplicação do plano atual.
- A carga inicial de permanência já foi tratada no projeto irmão; esse recurso não existe neste repositório de Gestão de Agenda.

## Etapa atual em desenvolvimento

- **O que está sendo feito:** nenhuma implementação funcional está ativa; o ciclo atual foi encerrado com o backup em nuvem.
- **Arquivos envolvidos:** código em `Appscript/`, testes, configuração do Node, documentação e arquivos canônicos de contexto.
- **O que já está pronto:** inventário, teste, contexto canônico, remoto configurado, históricos consolidados e envio para `origin/main`.
- **O que ainda falta:** documentação de implantação e vínculo com Apps Script; não são necessários para recuperar o código pelo GitHub.
- **Cuidado ao continuar:** não versionar dados pessoais, credenciais, tokens, arquivos de planilha com dados reais nem artefatos temporários de `.superpowers/`.

## Arquitetura e fluxo de dados

1. `atualizarAbaDados()` lê `Base`, filtra o polo `XSTEAM WELLNESS CLUB`, agrupa por ID e mantém o registro mais recente por aluno.
2. `atualizarAbaAgenda()` transforma `Dados` em `AGENDA` e reaplica por ID os campos manuais existentes.
3. `getAgendaAppData()` usa `AgendaCore.buildAgendaAppDataFromValues()` para preparar alunos, aulas, filtros e métricas.
4. O frontend chama o Apps Script por `google.script.run` e renderiza mapa de calor, agenda, professores e alunos.
5. `saveAgendaStudent(payload)` usa lock de documento e altera somente os campos manuais do aluno encontrado.

## Modelo da aba AGENDA

Cabeçalhos esperados:

```text
ID, Nome, Dias, Status,
Prof1, Dia1, Hora1,
Prof2, Dia2, Hora2,
Prof3, Dia3, Hora3,
Prof4, Dia4, Hora4,
Prof5, Dia5, Hora5,
Prof6, Dia6, Hora6,
Observações
```

Regras importantes:

- Um slot só vira aula quando professor, dia e hora estão preenchidos.
- Status ativos aceitam variações `Ativo`, `Ativa` e `Activa`, ignorando caixa e acentos.
- Dias e horários são normalizados pelo núcleo.
- A capacidade visual padrão do mapa de calor é 10 alunos por horário.

## Próximos passos

1. Adicionar um `README.md` com instalação, abas necessárias, teste e publicação Apps Script.
2. Criar/configurar `.clasp.json` com cuidado para não expor credenciais e registrar o fluxo de deploy.
3. Ampliar os testes para `Code.gs` e para os contratos essenciais da interface.
4. Decidir se a Gestão de Agenda será mantida separada ou incorporada ao dashboard `BASE_TECNOFIT`.

## Arquivos e pastas importantes

| Caminho | Função | Observação |
|---|---|---|
| `Appscript/AgendaCore.gs` | Regras puras, normalização e métricas | Principal núcleo testável |
| `Appscript/Code.gs` | Integração com Sheets, menu, Web App e salvamento | Depende do ambiente Apps Script |
| `Appscript/Index.html` | Estrutura da interface | Inclui CSS e JS pelos helpers do Apps Script |
| `Appscript/Script.html` | Estado e comportamento do frontend | Usa `google.script.run` no ambiente real |
| `Appscript/Styles.html` | Identidade visual e responsividade | UI escura com verde-limão XSTEAM |
| `Appscript/appsscript.json` | Manifesto Apps Script | Escopo limitado à planilha atual |
| `tests/agendaCore.test.js` | Teste automatizado do núcleo | Executado por `npm test` |
| `docs/superpowers/` | Especificações e planos | Parte dos documentos aponta para outro repositório |
| `CONTEXTO_DO_PROJETO.md` | Fonte canônica da memória do projeto | Atualizar antes de handoffs relevantes |
| `CONTEXTO_DO_PROJETO.html` | Versão retrátil do contexto | Deve espelhar este Markdown |

## Riscos, bloqueios e pendências

- **Risco:** confundir esta Gestão de Agenda com o dashboard do repositório irmão e implementar planos no código errado.
- **Risco:** atualizar `AGENDA` sem preservar colunas manuais; esta é a principal regressão a evitar.
- **Risco:** dados reais de alunos ou credenciais serem adicionados ao Git; revisar sempre os arquivos antes do commit.
- **Bloqueio atual:** nenhum bloqueio para recuperar ou continuar o código; falta apenas o vínculo `clasp` para automatizar a implantação Apps Script.
- **Pendência:** cobertura automatizada restrita ao `AgendaCore.gs`.
- **Pendência:** navegação lateral de Professores, Performance e Operação é apenas visual.
- **Pendência:** capacidade do mapa de calor fixa em 10 e pequenas diferenças de limites de turno entre núcleo e frontend.
- **Lacuna de contexto:** não está documentado qual implantação Apps Script, URL pública ou planilha de produção corresponde a esta versão.

## Como retomar o trabalho

1. Leia este arquivo e confira a data da última atualização.
2. Execute `git status --short --branch` e confirme branch, remoto e alterações locais.
3. Leia `Appscript/Code.gs` e `Appscript/AgendaCore.gs` antes de alterar regras de dados.
4. Execute `npm test` antes e depois de qualquer mudança no núcleo.
5. Se a solicitação mencionar Home, Financeiro, Acompanhamento, Fluxo, permanência ou LTV, confirme primeiro se o trabalho pertence a `../BASE_TECNOFIT`.

## Contexto para outro chat ou IA

Cole ou anexe este resumo ao continuar em outra máquina, conta ou IA:

- **Objetivo essencial:** manter uma Gestão de Agenda fixa semanal em Apps Script, alimentada por Sheets, sem perder dados manuais nas atualizações.
- **Estado atual:** aplicativo local funcional; teste do núcleo aprovado em 11/09/2026; backup disponível em `fitmanagementels/ALUNOS_WELLNESS_2026`, branch `main`.
- **Arquivos que precisam ser lidos:** `CONTEXTO_DO_PROJETO.md`, `Appscript/Code.gs`, `Appscript/AgendaCore.gs`, `Appscript/Script.html` e `tests/agendaCore.test.js`.
- **Decisões que não devem ser desfeitas:** preservar campos manuais por ID; manter regras puras testáveis; não misturar automaticamente este código com o dashboard `BASE_TECNOFIT`.
- **Próxima ação:** criar a documentação de instalação/deploy ou escolher a próxima evolução funcional.
- **Lacunas a confirmar:** URL/ID do Apps Script, planilha de produção correspondente e decisão futura de integração com o dashboard principal.
