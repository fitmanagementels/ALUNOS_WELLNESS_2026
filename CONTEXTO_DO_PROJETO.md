# Contexto do Projeto — Base Central TecnoFit / PWA XSTEAM

Última atualização: **11/09/2026 17:30 — America/Fortaleza (UTC−03:00)**

> Memória portátil canônica. Este repositório não deve conter planilhas reais, contatos, tokens, secrets ou credenciais.

## Resumo executivo

- `fitmanagementels/ALUNOS_WELLNESS_2026` é, por decisão do usuário, o repositório canônico do projeto completo e do PWA XSTEAM.
- O histórico e a árvore funcional de `BASE_TECNOFIT_WELLNESS` no commit `bc378e7` foram incorporados ao destino, preservando todo o histórico Git.
- A solução consolida quatro relatórios TecnoFit: vencimentos, fichas/prescrições, avaliações físicas e permanência.
- O PWA contém Home, Financeiro, Acompanhamento, Fluxo e Configurações; a fonte única da interface é `pwa/`.
- A arquitetura pública é `GitHub Pages -> Cloudflare Worker -> Apps Script Web App -> Google Sheets`.
- Home mantém fichas/prescrições e avaliações em filas independentes; Financeiro possui a subaba Permanência.
- Permanência exibe tempo de empresa e pacote atual separadamente. Não estima LTV ou receita histórica multiplicando o plano atual.
- A suíte completa passou em 11/09/2026: **206 testes aprovados e nenhuma falha**.
- A transição da lista de Churns agora tem uma prévia auditável em `PREVIA_TRANSICAO_CHURNS`; `FLUXO_CHURNS` permanece intacta até a decisão final da gestão.
- O estado anterior da antiga Gestão de Agenda permanece recuperável pela tag `agenda-legacy-2026-09-11`.

## Objetivo do projeto

- **Objetivo principal:** manter uma base confiável de alunos e contratos e transformar esses dados em decisões diárias para a equipe XSTEAM Wellness Club.
- **Resultado esperado:** importação semanal segura, rastreável e reversível; PWA responsivo; dados manuais persistentes; publicação reproduzível.
- **Usuários:** gestão e equipe operacional autorizada da XSTEAM.
- **Critérios de sucesso:** lote válido substitui a base atomicamente; lote inválido preserva a última base; filas não misturam processos; mutações persistem; PWA e backend mantêm contrato compatível; testes passam antes de publicar.

## Estado atual

| Item | Situação observada |
|---|---|
| Repositório canônico | `fitmanagementels/ALUNOS_WELLNESS_2026`, branch `main` |
| Fonte migrada | `fitmanagementels/BASE_TECNOFIT_WELLNESS`, commit `bc378e7` |
| Migração | Incorporada ao remoto desde `c24d950`; publicação robustecida em `89ea800` |
| Testes | `npm test`: 206 aprovados, 0 falhas |
| PWA | Código completo em `pwa/`; cache `xsteam-static-v12` |
| PWA publicado | `https://fitmanagementels.github.io/ALUNOS_WELLNESS_2026/` — HTTP 200, dados reais validados |
| Endereço anterior | `https://fitmanagementels.github.io/BASE_TECNOFIT_WELLNESS/`, mantido como redundância |
| Backend | Worker e Apps Script existentes continuam usados; último deploy Apps Script conhecido: versão 38 |
| Onde parei | Prévia de transição de Churns gerada; aguarda revisão da gestão antes da substituição definitiva |

## Arquitetura

```text
Relatórios TecnoFit no Drive -> Google Apps Script -> Google Sheets
                                      ^
                                      |
GitHub Pages / PWA -> Cloudflare Worker
```

- `apps-script/`: importação, transformação, planilha, métricas, mutações e APIs.
- `worker/`: proxy público com CORS e segredo somente no servidor.
- `pwa/`: interface única, service worker, manifesto e módulos de UI.
- `.github/workflows/`: publicação independente do PWA, Worker e Apps Script.
- `tests/`: contratos de dados, segurança, importação, UI e implantação.

## Dados e rotina de importação

O lote semanal exige exatamente quatro arquivos com a mesma data e revisão:

```text
vencimentos_AAAA-MM-DD_rNN.xls
fichas_AAAA-MM-DD_rNN.xls
avaliacao_fisica_AAAA-MM-DD_rNN.xls
permanencia_AAAA-MM-DD_rNN.xls
```

Também são aceitos arquivos `.xlsx`. Devem ser exportados completos e colocados sem edição manual em `01_ENTRADA`. Permanência não deve ser filtrada por status, pois também alimenta o histórico.

Principais abas: `BASE_ALUNOS`, `CONTRATOS`, `VISAO_MESTRE`, `BASE_PERMANENCIA`, `HISTORICO_PERMANENCIA`, `IMPORTACOES`, `PERFIS_ALUNOS`, `CONFIG_PERFIS_ALUNOS`, `FLUXO_LEADS` e `FLUXO_CHURNS`.

Na carga inicial validada de permanência foram processados 980 registros; 314 IDs foram ligados ao recorte operacional, 666 permaneceram somente no histórico e 2 alunos operacionais estavam sem início conhecido. São números de referência histórica e mudam com novas importações.

## Funcionalidades atuais

- **Home:** filtro inicial Matriculados/Wellness, filas independentes, perfis persistentes, etiquetas, responsáveis, WhatsApp e salvamento otimista.
- **Financeiro:** vencimentos, planos e Permanência; tempo de empresa e pacote atual separados, sem LTV estimado.
- **Acompanhamento:** listas dedicadas a fichas e avaliações, sem informação financeira desnecessária.
- **Fluxo:** Leads e Churns persistentes, métricas mensais/semanais e diagnósticos.
- **Configurações:** limites independentes, ordem dos blocos da Home e catálogos de perfil.

## Histórico relevante

| Data/commit | Mudança | Impacto |
|---|---|---|
| Jul–Ago/2026 | Importador, snapshots, dashboard e PWA | Base operacional e navegação diária estruturadas |
| `c09142d`–`6ad602f` | Perfis, WhatsApp e salvamento contínuo | Dados manuais persistentes e baixo atrito |
| `953e616` | Integração de permanência | Quarto relatório, histórico e nova visão financeira |
| `bc378e7` | Estado completo da fonte | PWA v11, Apps Script conhecido em versão 38 e executor privado |
| `55688d7` | Backup da antiga Gestão de Agenda | Estado preservado também pela tag de restauração |
| `c24d950` | Projeto e histórico migrados | Código, documentação e PWA reunidos no canônico |
| `557923f` | Publicação no novo GitHub Pages | Cache do PWA elevado para `xsteam-static-v12` |
| `89ea800` | Verificação resiliente da API | Retentativas evitam falhas de deploy por oscilação temporária |
| `e0cb8a4`–`c909264` | Prévia segura de Churns oficiais | Reconciliação por ID, preservação manual e relatório sem alterar a lista ativa |

## Decisões tomadas

- `ALUNOS_WELLNESS_2026` é o repositório canônico; `BASE_TECNOFIT_WELLNESS` permanece temporariamente como redundância.
- `pwa/` é a única fonte da interface; não recriar dashboard paralelo no Apps Script.
- Fichas e avaliações nunca compartilham fila, limites ou classificação.
- Permanência usa a primeira entrada confiável e preserva histórico; ausência não apaga informação antiga.
- Tempo de empresa e pacote atual permanecem separados; não inferir receita passada pelo preço atual.
- Perfis, Leads e Churns são persistentes e não podem ser apagados por importações semanais.
- A fonte oficial de cancelamentos prevalece para nome, contrato, valor, início e vencimento; dados manuais antigos são carregados por ID na transição.
- A seleção oficial usa o maior vencimento por aluno; status não é inferido automaticamente a partir da data.
- A substituição de `FLUXO_CHURNS` só ocorre após revisão explícita de `PREVIA_TRANSICAO_CHURNS`.
- O Worker guarda o segredo; o PWA recebe somente sua URL pública.
- O projeto antigo de Agenda saiu da árvore atual, mas permanece recuperável por tag.

## Memória de decisões e justificativas

| Decisão | Por que | Onde impacta | Como verificar/retomar |
|---|---|---|---|
| Quatro arquivos por lote | Permanência integra a base oficial | importador, POP e testes | Ler instruções e rodar testes de lote |
| Filas independentes | Ficha e avaliação geram ações distintas | Home, Acompanhamento e Configurações | Testes de dashboard/métricas |
| Sem LTV estimado | Plano atual não representa preços históricos | Financeiro/Permanência | Testes de permanência |
| Gravações otimistas | Operação não deve aguardar latência | perfis e Fluxo | Testes de mutações/fila |
| Worker intermediário | Segredo não pode estar no navegador | `worker/`, API do PWA | Testes do Worker/API |
| Repositório canônico novo | Usuário quer tudo no mesmo local | Git, Pages e documentação | Conferir remoto, branch e link |
| Prévia antes de substituir Churns | Proteger observações e dados operacionais manuais | `FLUXO_CHURNS`, `PREVIA_TRANSICAO_CHURNS`, `21_TransicaoChurns.gs` | Conferir quatro grupos e autorizar a migração final |

## Informações importantes capturadas do chat

- O usuário quer execução direta e o mínimo possível de autenticações ou trabalhos manuais pequenos.
- As próximas planilhas entram pela pasta de entrada; não deve haver transposição manual.
- Planilhas reais não entram no GitHub.
- Ausência de ficha/avaliação é diferente de atraso extremo; os dois processos permanecem separados.
- Com poucos meses de dados de Fluxo, análises devem evitar conclusões fortes ou projeções prematuras.
- A carga inicial de permanência foi autorizada e executada a partir do arquivo real fornecido.
- A lista oficial de Churns é atualizada fora do backend; a base principal recebe somente a prévia/reconciliação e, após aprovação, a lista consolidada.
- Telefones legados foram preservados quando o ID coincide; a gestão fornecerá posteriormente uma lista oficial para atualização de contatos.

## Último marco concluído

- **Resultado:** prévia de transição gerada na aba `PREVIA_TRANSICAO_CHURNS`, com 165 linhas e filtro de revisão.
- **Conciliação:** 151 registros preservam dados manuais, 9 entram sem histórico manual, 3 registros antigos não têm par oficial e 2 divergências requerem decisão.
- **Verificação:** cabeçalho, grupos, totais, filtro e formatação da aba foram conferidos; `FLUXO_CHURNS` não sofreu mutação.
- **Cuidado ao continuar:** não executar a etapa definitiva enquanto a gestão não revisar a prévia. O executor remoto do Apps Script está restrito por permissão, mas o código foi publicado; a prévia foi gravada diretamente na planilha mestre de forma controlada.

## Próximos passos

1. Revisar os grupos da aba `PREVIA_TRANSICAO_CHURNS`, especialmente os 2 itens de divergência e os 3 registros sem correspondente oficial.
2. Autorizar ou ajustar as regras para a substituição definitiva e arquivamento da lista atual de Churns.
3. Atualizar telefones quando a lista oficial de contatos for fornecida.
4. Estruturar a nova subaba de alunos novos em Fluxo e, depois, adicionar ordenação a todas as listagens.

## Arquivos e pastas importantes

| Caminho | Função | Observação |
|---|---|---|
| `LEIA-ME.md` | Visão operacional | Atualizado para a rotina de quatro relatórios |
| `apps-script/00_Config.gs` | Abas, cabeçalhos e constantes | Ponto inicial do modelo |
| `apps-script/03_Permanencia.gs` | Regras de permanência | Estado, eventos e métricas |
| `apps-script/07_ImportacaoService.gs` | Orquestração do lote | Atomicidade e rollback |
| `apps-script/12_DashboardApi.gs` | Bootstrap do PWA | Contrato principal de leitura |
| `apps-script/14_DashboardMutacoes.gs` | Escritas idempotentes | Perfis e Fluxo |
| `apps-script/18_DashboardPerfisAlunos.gs` | Perfis e catálogo | Preserva valores históricos |
| `apps-script/21_TransicaoChurns.gs` | Prévia de transição de Churns | Não altera `FLUXO_CHURNS`; usa fonte oficial configurável |
| `tests/transicao-churns.test.js` | Regras da reconciliação | Garante prioridade oficial e preservação manual por ID |
| `PREVIA_TRANSICAO_CHURNS` | Relatório na planilha mestre | Staging para a decisão da gestão; não é aba operacional do PWA |
| `pwa/index.html` | Shell do PWA | Interface pública principal |
| `pwa/js/dashboard.js` | Navegação e visões | Home, Financeiro, Acompanhamento, Fluxo e Configurações |
| `pwa/js/permanencia.js` | Interface de permanência | Não calcula LTV estimado |
| `pwa/sw.js` | Cache instalável | `xsteam-static-v12` |
| `worker/src/index.js` | Ponte pública segura | Valida origem e ações |
| `.github/workflows/deploy-pages.yml` | Publicação do PWA | Usa Worker atual como fallback |
| `tests/` | Regressões automatizadas | Executar `npm test` |
| `docs/superpowers/specs/2026-09-11-migracao-repositorio-canonico-design.md` | Design da migração | Inclui rollback e segurança |

## Riscos, bloqueios e pendências

- **Secrets:** valores de Cloudflare e Apps Script não são legíveis nem transferíveis; deploys sensíveis ficam protegidos por variáveis de habilitação.
- **Redundância:** o repositório anterior continua online, mas novas alterações devem ocorrer somente no canônico.
- **Privacidade:** não versionar `.xls/.xlsx`, contatos, planilhas oficiais ou configurações locais.
- **Histórico de planos:** não há fonte confiável de todos os preços históricos; não estimar LTV.
- **Transição de Churns:** o passo definitivo ainda é pendente; preservar backup e confirmação humana antes de trocar a aba ativa.
- **Execução remota Apps Script:** a credencial atual publica código, mas não executa funções privadas; verificar permissões do Execution API se for necessário rodar menus remotamente.

## Como retomar o trabalho

1. Leia este arquivo e `CONTEXTO_DO_PROJETO.html`.
2. Confirme o remoto `fitmanagementels/ALUNOS_WELLNESS_2026` e execute `git status --short --branch`.
3. Execute `npm test` antes e depois de alterações; a referência atual é 206 aprovados.
4. Para dados, leia `00_Config.gs`, `03_Permanencia.gs`, `07_ImportacaoService.gs` e testes relacionados.
5. Para interface, leia `dashboard.js`, `student-profiles.js`, `permanencia.js` e CSS associados.
6. Ao alterar `pwa/`, aumente o cache em `pwa/sw.js`.
7. Para Churns, leia `21_TransicaoChurns.gs` e a prévia antes de tocar em `FLUXO_CHURNS`.
8. Ao alterar o contrato backend/PWA, publique e valide Apps Script, Worker e Pages na ordem segura.

## Contexto para outro chat ou IA

- **Objetivo essencial:** Base Central TecnoFit com PWA XSTEAM, quatro relatórios e persistência de perfis/Fluxo.
- **Repositório canônico:** `fitmanagementels/ALUNOS_WELLNESS_2026`, branch `main`.
- **Estado atual:** prévia de Churns oficiais está pronta para revisão; 206 testes aprovados; a lista ativa não foi alterada.
- **Arquivos a ler:** este contexto, `docs/superpowers/specs/2026-09-11-transicao-churns-oficiais-design.md`, `docs/superpowers/plans/2026-09-11-previa-transicao-churns.md`, `apps-script/21_TransicaoChurns.gs` e `tests/transicao-churns.test.js`.
- **Não desfazer:** filas independentes; importação atômica; persistência manual; segredo apenas no Worker; permanência sem LTV inferido; transição de Churns por ID com fonte oficial vencendo dados de plano.
- **Próxima ação:** revisar a aba de prévia e decidir a política para divergências e registros antigos sem par oficial antes da migração final.
- **Rollback:** tag `agenda-legacy-2026-09-11` para a Agenda antiga; commit `bc378e7` no repositório anterior para o PWA pré-migração.
