# Contexto do Projeto — Base Central TecnoFit / XSTEAM

Última atualização: **21/08/2026 — America/Fortaleza (UTC−03:00)**

> Memória portátil canônica. Atualizar junto com `CONTEXTO_DO_PROJETO.html` ao encerrar cada marco relevante. Não incluir arquivos fonte com dados pessoais.

## Resumo executivo

- A Base Central TecnoFit alimenta um PWA operacional XSTEAM para Wellness, publicado no GitHub Pages e conectado ao Google Apps Script por Worker público autenticado por segredo de servidor.
- A interface única fica em `pwa/`; Apps Script contém importação, planilha, API interna e persistência. O PWA tem Home, Financeiro, Acompanhamento, Fluxo e Configurações.
- Perfis de alunos na Home são persistentes, começam recolhidos, preservam seu estado durante o uso e fecham o modal imediatamente após salvar, mantendo a fila de gravação em segundo plano.
- O perfil registra responsável, múltiplos últimos professores, pagamento, etiquetas e observações. As novas etiquetas públicas/comerciais são `Performance` e `Coach`.
- Fluxo possui Leads e Churns em abas manuais persistentes. Churn já tem análise mensal/semanal, diagnósticos e detalhamento, mas sua lista precisa de uma reorganização para escalar.
- A próxima etapa é um pacote de evolução de Fluxo: histórico oficial de cancelamentos, subaba de alunos novos, acesso de perfil por ID nos churns, organização das listas, ordenação comum e análise temporal de Leads.

## Objetivo do projeto

- Manter a base operacional semanal importável e segura, sem apagar registros manuais de operação.
- Dar à equipe uma visão diária de alunos, planos, vencimentos, prescrição, avaliação, leads e churns.
- Permitir registros persistentes associados ao ID do aluno, com uso contínuo do PWA e baixo atrito.
- Usuários: gestão e equipe operacional autorizada da XSTEAM Wellness Club.

## Estado atual

| Item | Situação observada |
|---|---|
| Branch e publicação | `main` publicado no GitHub em `6ad602f`; GitHub Pages confirmou deploy com sucesso. |
| PWA | Cache publicado `xsteam-static-v10`; o PWA instalado recebe o novo perfil após recarregar/reativar. |
| Apps Script | Backend enviado e implantação pública estável atualizada para versão 33. |
| Testes | `npm test`: 176 aprovados, 0 falhas. |
| Onde parei | Implementação de Último professor e etiquetas concluída; próximos requisitos de Fluxo foram registrados, ainda sem design/implementação. |
| Arquivos locais | Há itens não rastreados que pertencem ao usuário (`.vscode/`, export de cancelados e feedback comercial). Preservar. |

## Histórico relevante

| Data/commit | Mudança | Impacto |
|---|---|---|
| Jul–Ago/2026 | Importador, snapshots e PWA operacional | Base, contratos, métricas e navegação diária estruturados. |
| `c09142d`–`f70cf86` | Perfil do aluno, WhatsApp e fluxo contínuo de salvamento | Perfil na Home, lista retrátil e operação sem aguardar modal. |
| `3e43bee` | Persistência de últimos professores e catálogo | Nova coluna segura, compatível com perfis antigos; `Performance` e `Coach`. |
| `d4c1c8f` | Seletor múltiplo no PWA | Um único campo compacto para zero ou vários últimos professores. |
| `6ad602f` | Cache PWA, testes e publicação | Service worker `v10`, Pages publicado e backend em Apps Script versão 33. |

## Decisões tomadas

| Decisão | Por que foi tomada | Onde impacta | Como verificar/retomar |
|---|---|---|---|
| PWA é a interface única | Evita divergência com HTML do Apps Script. | `pwa/`, Pages. | Alterar e publicar somente a fonte em `pwa/`. |
| Gravações são otimistas | Mantém fluxo de uso contínuo mesmo com rede/Apps Script lentos. | `pwa/js/dashboard.js`, `student-profiles.js`. | Erros ficam na fila/status global, não no modal fechado. |
| Lista de perfis começa recolhida, mas não alterna após salvar | Organiza a Home sem interromper a navegação da pessoa usuária. | Estado `profilesExpanded`. | Abrir a lista, salvar um perfil e confirmar que ela permanece aberta. |
| Último professor é uma lista compacta | Há casos com mais de um professor e não deve haver duas listas ocupando espaço. | `PERFIS_ALUNOS.ultimos_professores`, perfil PWA. | Selecionar múltiplos nomes e reabrir o perfil. |
| Migração de schema preserva registros | Inserir apenas um cabeçalho deslocaria dados antigos. | `18_DashboardPerfisAlunos.gs`. | Primeiro save migra a coluna e mantém pagamento/etiquetas nos locais corretos. |
| Catálogo de perfil é extensível | Etiquetas e professores precisam de opções controladas, sem texto livre. | `CONFIG_PERFIS_ALUNOS`. | Catálogo padrão é completado sem apagar opções já existentes. |
| Fluxo é persistente e separado do snapshot semanal | Leads e churns não podem ser apagados pela importação de base. | `FLUXO_LEADS`, `FLUXO_CHURNS`. | Importar lote semanal sem modificar as duas abas. |
| Histórico oficial de churn não será um novo importador semanal | O usuário fornecerá uma planilha oficial pontualmente e quer a carga feita na planilha. | Próxima etapa. | Definir aba histórica, mapeamento e deduplicação quando o arquivo chegar. |

## Informações importantes capturadas do chat

- Padrão inicial da Home: **Matriculados** e **XSTEAM Wellness Club**.
- O WhatsApp deve abrir a conversa específica do aluno em desktop e mobile.
- Não usar dados pessoais reais em testes, contexto, commits ou protótipos.
- O usuário quer que mudanças de VS Code não quebrem o salvamento. Mudanças de contrato PWA/backend exigem testes, deploy do Apps Script e aumento do cache do service worker.
- Churns serão enriquecidos por uma planilha oficial de histórico de cancelamentos; o arquivo ainda não foi enviado nesta etapa.
- Uma planilha de alunos novos também será enviada. Ela originará uma nova subaba de Fluxo e exige schema próprio na planilha.

## Etapa atual em desenvolvimento

**Concluído:** perfil de aluno completo, seleção múltipla de Último professor, etiquetas `Performance`/`Coach`, migração de schema, cache PWA e publicação.

**A planejar antes de codificar:**

1. Carga pontual do histórico oficial de cancelamentos em aba persistente da planilha, fora do snapshot semanal.
2. Nova aba e subaba **Alunos novos** em Fluxo, após receber a planilha fonte e mapear as colunas.
3. Abertura do perfil de aluno pelo ID em Churn, reutilizando a ficha básica da Home e exibindo informações de plano disponíveis no tempo.
4. Nova visualização da lista de Churns, adequada a registros longos/preenchidos.
5. Ordenação comum nas listagens de alunos: alfabética e por data de referência contextual.
6. Análise temporal de Leads, equivalente à de Churns, com janela inicial menor e dados de captação/conversão.

## Próximos passos

1. Receber a planilha oficial de cancelamentos e a de alunos novos, sem o usuário precisar transpor ou editar os dados manualmente.
2. Fazer o design do pacote Fluxo em partes: dados históricos, nova subaba, perfil por ID, organização de listas, ordenação e análise de Leads.
3. Antes de carregar as planilhas, definir e testar: colunas canônicas, chave de deduplicação, política para linhas inválidas, aba de relatório de carga e reversibilidade.
4. Confirmar a fonte de “informações de planos no tempo” para churns: os snapshots atuais trazem o retrato importado; histórico de planos só deve ser exibido se existir uma fonte confiável no arquivo/planilha.
5. Implementar por blocos testáveis, atualizar Apps Script + PWA no mesmo marco quando o contrato mudar e publicar no `main`.

## Arquivos e pastas importantes

| Caminho | Função | Observação |
|---|---|---|
| `apps-script/00_Config.gs` | Nomes das abas e cabeçalhos | Inclui schema persistente de perfil e Fluxo. |
| `apps-script/12_DashboardApi.gs` | Bootstrap e API do dashboard | Reúne dados para o PWA. |
| `apps-script/14_DashboardMutacoes.gs` | Escritas idempotentes | Fila de mutações de perfis e Fluxo. |
| `apps-script/15_DashboardFluxo.gs` | Leituras, métricas e análises de Fluxo | Base para Churn e futura análise de Leads. |
| `apps-script/18_DashboardPerfisAlunos.gs` | Perfil persistente e catálogo | Migra schema de perfil e valida escolhas. |
| `pwa/js/dashboard.js` | Navegação, Fluxo, gráficos e fila | Lista Churn atual e futuros controles de ordenação. |
| `pwa/js/student-profiles.js` | Modal de perfil do aluno | Campo múltiplo Último professor e WhatsApp. |
| `pwa/css/student-profiles.css` | Layout do perfil | Grade responsiva e menu múltiplo compacto. |
| `pwa/sw.js` | Cache instalável | Atual: `xsteam-static-v10`; aumentar a cada atualização PWA. |
| `worker/src/index.js` | Ponte pública para Apps Script | Não expor segredo no PWA. |
| `tests/` | Regressões automatizadas | Rodar `npm test` antes de publicar. |
| `docs/superpowers/specs/` | Decisões aprovadas | Inclui design de Último professor. |
| `docs/superpowers/plans/` | Planos executáveis | Inclui plano de Último professor. |

## Riscos, bloqueios e pendências

- **Arquivos pendentes:** as planilhas oficiais de churn e alunos novos não foram anexadas. Não iniciar carga com dados inferidos.
- **Histórico de planos:** requisito de plano “nos tempos” depende de identificar uma fonte histórica confiável, não apenas o contrato vigente do snapshot.
- **Escala da lista de churn:** modal atual cresce com o conteúdo; a nova solução precisa evitar lista longa sem busca/filtro/paginação ou agrupamento.
- **Ordenação:** cada lista deve declarar sua data de referência; não usar uma data genérica que mude o significado de Churn, Lead, aluno ativo ou aluno novo.
- **Privacidade:** telefones e planilhas oficiais são dados operacionais; não os versionar nem reproduzir em documentação/testes.
- **Deploys:** mudança em contrato PWA/Apps Script requer os dois deploys. O workflow de Apps Script no GitHub pode falhar se os secrets não estiverem configurados; o deploy manual validado por `clasp` é o caminho atualmente usado.
- **Diretório compartilhado:** não executar reset, checkout destrutivo ou limpeza ampla; preservar itens não rastreados do usuário.

## Como retomar o trabalho

1. Leia este arquivo e `CONTEXTO_DO_PROJETO.html`.
2. Execute `git status --short --branch` e preserve arquivos não relacionados.
3. Execute `npm test` antes de editar código.
4. Para Fluxo, leia `apps-script/15_DashboardFluxo.gs`, `14_DashboardMutacoes.gs`, `pwa/js/dashboard.js` e os testes `dashboard-fluxo.test.js`/`dashboard-html.test.js`.
5. Ao receber cada planilha, inspecione somente cabeçalhos, quantidade de linhas e exemplos anonimizados antes de propor o mapeamento.
6. Faça design e aprovação por subprojeto antes de mexer em schema, importação ou interface.
7. Ao mudar PWA, aumente a versão do cache; ao mudar backend, publique a implantação Apps Script estável e confirme compatibilidade antes do Pages.

## Contexto para outro chat ou IA

O projeto é a Base Central TecnoFit com PWA XSTEAM para Wellness. A fonte da interface é `pwa/`, publicada em GitHub Pages; Apps Script é backend e planilha; Worker faz a ponte pública sem expor segredos. `main` está no commit `6ad602f`, PWA cache `v10`, Apps Script estável versão 33 e `npm test` passou 176 testes. Não desfazer o fluxo otimista de salvamento nem o estado preservado da lista de perfis. `PERFIS_ALUNOS` contém responsável, `ultimos_professores` em JSON, pagamento, etiquetas e observações; a migração preserva schema antigo. Próximo pacote é Fluxo: receber planilha oficial de churn, criar Alunos novos, reutilizar perfil por ID nos churns, escalar lista de churn, oferecer ordenação em listagens e criar análise temporal de Leads. Não carregar os dois arquivos antes de recebê-los e não inventar histórico de planos; confirmar fonte e mapeamento. Preservar arquivos não rastreados do usuário e não expor PII.
