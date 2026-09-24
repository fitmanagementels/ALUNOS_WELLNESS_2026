# Contexto do Projeto — XSTEAM Gestão / Base Central TecnoFit

Última atualização: **24/09/2026 12:05 — America/Fortaleza (UTC−03:00)**
Perfil detectado: **PWA operacional com dashboard de gestão**
Evidência do perfil: `pwa/`, fluxo de perfis/Leads/Churns, dashboards financeiros e de acompanhamento, lote semanal de relatórios e persistência operacional.

> Memória portátil canônica para humanos e IAs. Planilhas reais, tokens, secrets, bancos exportados e credenciais não devem ser versionados. Os dois e-mails operacionais da allowlist aparecem em configuração, testes e documentação e devem ser tratados como dados pessoais ao compartilhar o projeto externamente.

## Resumo executivo

- O XSTEAM Gestão consolida alunos, contratos, vencimentos, prescrições, avaliações, permanência, perfis, Leads e Churns para a operação da XSTEAM Wellness Club.
- O repositório canônico é `fitmanagementels/ALUNOS_WELLNESS_2026`, branch `main`. O estado revisto está no commit `daf9cee`.
- A produção continua na arquitetura antiga e funcional: **GitHub Pages → Worker proxy → Apps Script → Google Sheets/Drive**.
- O endereço canônico em produção continua sendo `https://fitmanagementels.github.io/ALUNOS_WELLNESS_2026/`. A consulta pública em 24/09/2026 retornou HTTP 200 e ainda entregava o cliente antigo apontando para `xsteam-dashboard-api.fitmanagement-els.workers.dev`.
- Está em desenvolvimento uma migração integral para Cloudflare: um Worker entregará o PWA e a API no mesmo domínio; D1 será a fonte única; R2 guardará arquivos e backups; Cloudflare Access fará a autenticação.
- O código local/versionado já contém o runtime completo preparado, esquema D1, identidade nativa do Access, bootstrap, API same-origin, mutações idempotentes, análise de Churn, fila persistente, backup D1→R2 e comparador de reconciliação. Isso ainda **não representa uma versão pronta para corte**: R2 e Access remoto são gates externos, e importação/recuperação operacional ainda não foram concluídas.
- O D1 remoto `xsteam-gestao` recebeu as migrações `0001`–`0004` e a carga inicial validada: 316 alunos, 321 contratos, 21 perfis manuais, 162 churns oficiais conciliados por ID e 231 novos alunos válidos.
- O R2 ainda não está habilitado na conta Cloudflare. O Worker `xsteam-gestao` existe em modo temporário seguro no endereço `https://xsteam-gestao.fitmanagement-els.workers.dev`: retorna HTTP 503 sem assets, D1 ou R2; o Access de produção ainda não foi configurado.
- A suíte local passou com **231 testes, 0 falhas** após a fila persistente, uso da identidade nativa do Access, backup D1→R2, reconciliador e remoção de PII dos logs da API. O PWA same-origin ainda não foi publicado porque o corte depende de R2 e Access.
- O deploy completo em modo seco reconhece os assets do PWA, D1, R2 e o cron de backup; ele não foi publicado para não expor dados antes da proteção de borda.

## Objetivo do projeto

- **Objetivo principal — Confirmado:** manter uma base confiável de alunos e contratos e transformá-la em decisões diárias para a gestão e operação da XSTEAM Wellness Club.
- **Resultado esperado — Decisão registrada:** frontend, backend, autenticação, banco, importações e arquivos operacionais no Cloudflare, sem Google ou GitHub no caminho de execução.
- **Usuário atual — Confirmado pelo usuário:** somente o proprietário, por enquanto. O desenho aprovado permite duas contas pessoais do proprietário: `fitmanagement.els@gmail.com` e `elohimlima15@gmail.com`.
- **Critérios de sucesso — Confirmados:** dados oficiais e manuais preservados; importação atômica, auditável e reversível; PWA responsivo; salvamentos idempotentes e não bloqueantes; sincronização entre dispositivos; backup e rollback verificados; zero dependência Google após o corte.

## Estado atual

| Item | Estado e evidência |
|---|---|
| Status geral | **Em desenvolvimento.** Migração Cloudflare com D1 carregado e runtime preparado; corte aguarda R2 e Access. |
| Commit revisto | `daf9cee` — `fix: remover email de logs da api`; `main` contém os preparativos de backup e reconciliação. |
| Produção ativa | **Validada na arquitetura antiga.** GitHub Pages ainda entrega o PWA v12 e usa o Worker proxy/Apps Script/Sheets. |
| Novo PWA no código | **Implementado localmente, não publicado.** API `/api` same-origin, cache `xsteam-static-v14` e fila IndexedDB desde `e1596aa`. |
| Novo backend | **Implementado e testado localmente.** Roteador D1, bootstrap, mutações, análise de Churn, Access nativo e cron de backup; validação remota protegida ainda pendente. |
| D1 remoto | **Migrado e validado por contagens.** Banco `xsteam-gestao` com migrações `0001`–`0004`, 316 alunos, 321 contratos, 21 perfis, 162 churns e 231 novos alunos. |
| R2 | **Bloqueado.** API Cloudflare retornou código `10042`: R2 precisa ser habilitado no painel. Nenhum bucket foi criado. |
| Worker temporário | **Publicado e verificado.** `xsteam-gestao` responde HTTP 503 sem assets nem bindings de dados, aguardando Cloudflare Access. |
| Worker novo | **Preparado localmente, não implantado.** O mesmo script possui deployment temporário seguro para viabilizar a configuração do Access. |
| Cloudflare Access | Código usa identidade nativa da borda com allowlist; IdP Google e política remotos ainda não foram configurados. |
| Testes locais | **231 testes, 0 falhas** em `npm test` após os preparativos de backup e reconciliação. |
| CI do Pages | Run `35992124636` para `38658db`: **falha no passo `npm test`**; etapas de geração/publicação foram ignoradas. A causa exata do teste não foi extraída; dependências isoladas em `worker/package.json` são uma hipótese a confirmar. |
| Churn oficial | Prévia anterior permanece válida e não substituiu `FLUXO_CHURNS`: 165 linhas; 151 preservadas por ID, 9 novas sem histórico, 3 antigas sem par e 2 divergências. |
| Onde o trabalho parou | Dados oficiais e manuais foram migrados ao D1; o PWA local consome a API same-origin e ganhou fila persistente. R2 e Cloudflare Access ainda impedem criar o bucket, publicar o Worker completo e realizar o corte. |

## Arquitetura atual e arquitetura-alvo

### Produção atual — confirmada

```text
Relatórios TecnoFit → Google Drive → Apps Script → Google Sheets
                                             ↑
GitHub Pages / PWA → Worker proxy público ───┘
```

- O PWA público ainda usa `runtime-config.js` para chamar `https://xsteam-dashboard-api.fitmanagement-els.workers.dev`.
- O Worker antigo limita origem e ações, guarda o segredo e encaminha pedidos ao Apps Script.
- O Apps Script importa quatro relatórios, persiste dados no Sheets, monta o bootstrap e grava perfis/Fluxo.
- Essa arquitetura continua sendo a referência operacional até aprovação explícita do corte.

### Arquitetura-alvo — decisão registrada

```text
Usuário único
  │ login Google
  ▼
Cloudflare Access — allowlist de duas contas do proprietário
  ▼
Worker xsteam-gestao / workers.dev
  ├── Static Assets: PWA
  ├── /api: bootstrap, versão, mutações, análises e importação
  ├── D1: fonte relacional única e auditoria
  └── R2: arquivos brutos, relatórios e backups
```

- GitHub permanece somente como repositório versionado depois da estabilização.
- Não haverá domínio próprio nesta fase.
- O objetivo é permanecer nas franquias gratuitas; nenhuma ativação paga é autorizada automaticamente.
- Google Sheets, Drive e Apps Script permanecem intactos até o corte e depois viram contingência congelada, sem exclusão automática.

## Funcionalidades e evolução

| Funcionalidade | Comportamento | Estado | Evidência | Áreas afetadas | Relações e impacto |
|---|---|---|---|---|---|
| PWA operacional atual | Home, Financeiro, Acompanhamento, Fluxo e Configurações | validada na produção antiga | `pwa/`, URL pública, testes legados | UI/operação | Interface usada diariamente |
| Perfis de alunos | Responsável, últimos professores, pagamento, etiquetas e observações por ID | validada na produção antiga; parcial no D1 | `student-profiles.js`, Apps Script, `mutation-service.js` | UI/dados | Campos manuais nunca devem ser apagados por importação |
| Sincronização entre dispositivos | Cliente verifica versão em segundo plano e recarrega bootstrap quando muda | validada no backend antigo; incompleta no D1 | `pwa/js/dashboard.js` | frontend/backend | O D1 ainda não muda a versão ativa após mutações manuais |
| Permanência | Primeira entrada confiável, histórico e coortes sem estimar LTV | validada na produção antiga; DTO D1 incompatível | `03_Permanencia.gs`, `pwa/js/permanencia.js`, `bootstrap-service.js` | dados/financeiro | Datas e nomes precisam preservar o contrato do PWA |
| Leads | Cadastro manual persistente, filtros e funil | validada na produção antiga; mutação D1 implementada | Apps Script, PWA, `mutation-service.js` | Fluxo/dados | D1 ainda não foi testado com SQLite real |
| Churns | Cadastro, arquivamento, análise mensal/semanal e diagnóstico | validada na produção antiga; parcial no D1 | `churn-analysis-service.js`, `mutations.test.js` | Fluxo/dados | Exclusão D1 vira `archived_at`, não `DELETE` |
| Prévia oficial de Churns | Reconciliada por ID antes da substituição | validada | `21_TransicaoChurns.gs`, `transicao-churns.test.js` | migração/dados | Lista ativa permanece intacta |
| API same-origin | PWA chama `POST /api` com sessão do Access | implementada no código, não implantada | `38658db`, `pwa/js/api.js` | frontend/segurança | Elimina runtime-config e CORS no alvo |
| Autenticação Access | Usa a identidade nativa da borda e allowlist | implementada e testada localmente; IdP/política remotos pendentes | `worker/src/auth.js`, `auth.test.js` | segurança | Dois e-mails autorizados; nenhum e-mail é enviado aos logs da API |
| Bootstrap D1 | Lê tabelas D1 e monta payload do PWA | parcial | `dashboard-repository.js`, `bootstrap-service.js` | API/dados | Possui incompatibilidades de SQL e DTO listadas em riscos |
| Mutações D1 | Perfis, Leads, Churns e configurações com `request_id` | implementada em unidade; integração pendente | `mutation-service.js`, `mutation_log`, testes | API/dados | Lote usa `db.batch()`; precisa teste real de atomicidade |
| Importação pelo PWA | Data/revisão + quatro campos de upload + ajuda + prévia | planejada | design e Tasks 9–10 | UI/R2/D1 | Substituirá a pasta do Drive; ainda não há código |
| Fila IndexedDB | Persistência offline, FIFO e backoff | implementada e testada localmente | `pwa/js/sync-queue.js`, `tests/cloudflare/sync-queue.test.js` | PWA | Persiste antes do envio e retenta após falha; validação remota em produção pendente |
| Backups D1→R2 | Snapshot semanal, JSONL compactado, SHA-256, manifesto, download restrito e SQL de recuperação protegido | implementada/testada localmente; bloqueada por R2 para validação real | `backup-service.js`, `download-r2-backup.js`, `restore-r2-backup.js`, testes, cron | continuidade | Aplicação ao banco requer confirmação explícita |
| Seed e reconciliação D1 | Converte exportação XLSX e relatórios oficiais em SQL privado; compara métricas e hashes de identificadores | implementada e testada localmente | `scripts/build-d1-seed.js`, `scripts/reconcile-d1.js`, testes | migração/dados | Preserva dados manuais por ID; conector recorrente de origem/D1 ainda pendente |
| Corte integral | Worker/Access/D1/R2 em produção sem Google | planejada | Tasks 12–14 | toda a plataforma | Depende de paridade, backup, ensaio e 48 h de validação |

### Evolução recente

- `923dd92`: desenho aprovado para migração integral ao Cloudflare.
- `bf8a47c`: plano executável de 14 Tasks, gates e definição de concluído.
- `bc8579a`: Static Assets, bindings D1/R2 e respostas HTTP seguras preparados.
- `a031fb1`: esquema relacional D1 e índices adicionados.
- `651756f`: autenticação JWT do Cloudflare Access com allowlist.
- `a587d51`: catálogo persistente de professores, etiquetas e perfis de pagamento.
- `84efa70`: repositório e serviço inicial de bootstrap D1.
- `38658db`: cliente PWA convertido para `/api` same-origin e service worker `v13`.
- `c909a55`: Worker deixou de ser proxy do Apps Script no código-alvo; roteador, mutações, etiquetas e análise de Churn foram portados para D1.
- `e1596aa`: fila de sincronização IndexedDB persistente, FIFO e com retentativas.
- `9f1bc29`: autenticação passa a usar identidade nativa do Cloudflare Access.
- `e2d99b3`: backup D1→R2 paginado com manifesto e cron semanal.
- `1a75b82`: comparador seguro de reconciliação por métricas e hashes curtos.
- `daf9cee`: logs de erro da API deixam de registrar e-mail do usuário.

## Entidades, variáveis e associações

| Elemento | Categoria | Significado e origem | Armazenamento-alvo | Associações e invariantes | Evidência |
|---|---|---|---|---|---|
| `student_id` | ID | Código TecnoFit do aluno | `students.student_id` | Chave de conciliação de contratos, permanência, perfis, etiquetas e Fluxo | plano, `0001_core.sql` |
| `students` | entidade oficial | Nome, contato, status e datas operacionais | D1 | Importação substitui campos oficiais; não apaga dados manuais relacionados | `0001_core.sql` |
| `contracts` | entidade oficial | Plano, frequência, valor, vencimento, polo e modalidade | D1; dinheiro em centavos | Muitos contratos por aluno; contrato oficial escolhido pelo maior vencimento quando a visão exige consolidação | plano e schema |
| `prescriptions` / `assessments` | entidade oficial | Datas independentes de ficha e avaliação | D1 | Nunca compartilhar fila, limite ou classificação | decisão registrada |
| `permanence` | entidade histórica | Cliente desde, continuidade e presença no último lote | D1 | Ausência no lote não apaga histórico; menor data confiável prevalece | Apps Script e schema |
| `permanence_events` | histórico | Mudanças de status, reaparecimento e correções | D1 | Evento identificável, ligado ao aluno e à versão de origem | schema |
| `student_profiles` | entidade manual | Responsável, perfil de pagamento e observações | D1 | Um por aluno; `updated_by` registra identidade do Access | schema e mutation service |
| `student_last_teachers` | relação | Lista ordenada de últimos professores | D1 | Muitos nomes por aluno, posição explícita | schema |
| `profile_catalog` | configuração | Professores, perfis de pagamento e catálogo visível | D1 | Chave composta por tipo/grupo/chave | `0003_profile_catalog.sql` |
| `tag_groups` / `tags` | catálogo | Grupos Público/Comercial e etiquetas | D1 | `student_tags.tag_key` referencia `tags.tag_key` | `0001_core.sql`, `0004_tags.sql` |
| `student_tags` | relação | Etiquetas atribuídas ao aluno | D1 | Possui somente `student_id` e `tag_key`; leitura precisa fazer JOIN com `tags` | schema |
| `leads` | entidade manual | Captação, experimental, conversão, plano e relato | D1 | Arquivamento opcional; edição idempotente | schema e mutation service |
| `churns` | entidade híbrida | Campos oficiais de saída/plano e campos manuais de retenção | D1 | Oficiais prevalecem; manuais preservados por ID; exclusão lógica | schema e design |
| `new_students` | entidade oficial futura | Entradas oficiais para nova subaba de Fluxo | D1 | Planejada; importador ainda ausente | schema/Task 10 |
| `data_versions` | estado | Versões staging/active/superseded/rejected | D1 | Apenas uma versão `active`; corte atômico da base oficial | schema/índice único |
| `import_batches/files/rows/errors` | auditoria de importação | Lote, arquivos, staging e erros seguros | D1 + R2 | Quatro arquivos, mesma data/revisão, lote indivisível | schema/Tasks 9–10 |
| `mutation_log` | idempotência | Resultado por `request_id` e autor | D1 | Repetição devolve resultado sem nova escrita | mutation service |
| `settings` | configuração | Filtros, cards e alertas | D1 | Chave `(setting_type, setting_key)` | schema |
| `usage_counters` | telemetria | Leitura/escrita/requisições do aplicativo | D1 | Planejado para alertas de franquia | schema/Task 11 |

### Fluxo atual das informações

1. Quatro relatórios TecnoFit são nomeados com tipo, data e revisão e colocados no Google Drive.
2. Apps Script valida o lote, transforma dados, preserva permanência, substitui abas gerenciadas e incrementa a versão.
3. O Worker proxy autentica o pedido por segredo de servidor e encaminha ações ao Apps Script.
4. O PWA carrega bootstrap, mantém cache local e envia mutações otimistas.
5. Perfis, Leads e Churns ficam em abas persistentes e sobrevivem aos snapshots semanais.

### Fluxo-alvo das informações

1. A pessoa autenticada informa data/revisão e seleciona os quatro relatórios em campos separados no PWA.
2. O navegador identifica e valida arquivos; o Worker registra staging no D1 e objetos brutos no R2.
3. Uma prévia mostra contagens, avisos, rejeições e divergências sem alterar a versão ativa.
4. A promoção válida cria uma nova versão e troca o ponteiro ativo atomicamente.
5. Mutações manuais passam pela API autenticada, usam `request_id`, gravam autor e invalidam a versão consumida pelos demais dispositivos.
6. Backups periódicos exportam D1 para R2 com manifesto e hashes.

### Estados, transições e invariantes

- `staging → ready → active`: somente lote completo, validado e aprovado.
- `active → superseded`: ocorre somente junto da ativação da nova versão.
- Qualquer falha de promoção preserva a versão ativa anterior.
- Um lote rejeitado nunca troca a versão ativa.
- Dados manuais não são removidos por importação oficial.
- Fichas e avaliações são processos independentes.
- Permanência não gera LTV estimado a partir do preço atual.
- Exclusão de Churn no D1 é arquivamento (`archived_at`).
- O segredo legado nunca aparece no navegador; no alvo, a identidade vem do JWT do Access.
- Nenhum dado real ou arquivo operacional é versionado no Git.

## Arquitetura funcional

| Área/módulo | Responsabilidade | Entradas | Saídas | Dependências | Evidência |
|---|---|---|---|---|---|
| `pwa/` | Interface única desktop/mobile e PWA instalável | Bootstrap/API e ações do usuário | Renderização, mutações, cache | Worker/API | testes de shell e módulos |
| `pwa/js/api.js` | Cliente HTTP same-origin do alvo | ação + payload | `data` ou erro seguro | `/api`, sessão Access | `38658db` |
| `pwa/js/dashboard.js` | Estado, filtros, filas, Fluxo e sincronização | bootstrap e mutações | telas e patches | contrato DTO | código atual |
| `worker/src/index.js` | Entrada do Worker e fallback de assets | Request | API ou Static Assets | `router.js`, `ASSETS` | `c909a55` |
| `worker/src/auth.js` | Verificação JWT e allowlist | cabeçalho Access | `{email}` | JWKS, `jose` | testes de auth |
| `worker/src/router.js` | Roteamento das quatro ações atuais | `/api` JSON | envelope `{ok,data}` | auth, D1 services | testes de router |
| `dashboard-repository.js` | Consultas do bootstrap | binding D1 | linhas por entidade | esquema/migrações | código atual |
| `bootstrap-service.js` | Adaptação D1→PWA | linhas D1 | bootstrap | contrato legado do PWA | teste unitário; integração pendente |
| `mutation-service.js` | Validação e gravação de patches | ator, requestId, patches | resultado idempotente | D1 batch/catalog | testes unitários |
| `churn-analysis-service.js` | Séries e diagnósticos | churns + filtros | mensal, semanal, motivos, responsáveis, retenção | D1 | teste unitário |
| `worker/migrations/` | Esquema relacional versionado | SQL | tabelas/índices/catálogos | D1 | `0001`–`0004` |
| `apps-script/` | Backend legado ainda produtivo | Drive/Sheets/API | bootstrap e persistência | Google | produção atual |
| `.github/workflows/` | Deploy legado | push em `main` | Pages/Worker/Apps Script | GitHub Actions | deve ser desativado somente após corte |

## Plano de migração integral

Documento canônico: [`docs/superpowers/plans/2026-09-22-cloudflare-total.md`](docs/superpowers/plans/2026-09-22-cloudflare-total.md). Design aprovado: [`docs/superpowers/specs/2026-09-22-cloudflare-total-design.md`](docs/superpowers/specs/2026-09-22-cloudflare-total-design.md).

| Task | Escopo | Estado revisto em 24/09/2026 |
|---|---|---|
| 1 | Worker único, Assets, D1 e R2 locais | implementada no código; R2 remoto indisponível |
| 2 | Esquema D1 auditável | implementada e aplicada remotamente: `0001`–`0004` |
| 3 | Cloudflare Access e allowlist | identidade nativa e allowlist implementadas/testadas; configuração remota pendente |
| 4 | Bootstrap e roteador D1 | implementada e testada localmente; integração real protegida pendente |
| 5 | Mutações e análise de Churn | implementada/testada localmente; integração protegida pendente |
| 6 | Seed privado e reconciliação | carga inicial concluída; comparador seguro implementado, conectores recorrentes pendentes |
| 7 | PWA same-origin | implementada no código; não publicada |
| 8 | Fila IndexedDB resiliente | implementada no código e testada localmente; validação no Worker protegido pendente |
| 9 | Parser e upload pelo PWA/R2 | não iniciada |
| 10 | Promoção atômica e fontes oficiais | não iniciada |
| 11 | Backup, restauração e franquia | backup/cron e preparo seguro de SQL implementados/testados; R2 e ensaio de recuperação real pendentes |
| 12 | Recursos remotos, Access e deploy vazio | parcial: D1 criado; R2/Access/Worker pendentes |
| 13 | Migração e paridade dos dados reais | parcial: carga inicial oficial concluída e validada por contagens; paridade detalhada e operação recorrente pendentes |
| 14 | Ensaio, corte e 48 h de validação | não iniciada |

## Histórico relevante

| Data/commit | Mudança | Impacto | Evidência |
|---|---|---|---|
| Jul–Ago/2026 | Importador, snapshots, dashboard e PWA | Base operacional estruturada | histórico Git/Apps Script |
| `953e616` | Permanência | Quarto relatório e histórico | Git/testes |
| `c24d950` | Repositório canônico | Código e histórico reunidos | Git |
| `557923f`–`89ea800` | Publicação canônica antiga | GitHub Pages v12 validado | workflow/URL |
| `e0cb8a4`–`57363b4` | Prévia oficial de Churns | Conciliação por ID sem alterar a lista ativa | código/documentação |
| `923dd92`–`bf8a47c` | Migração Cloudflare desenhada e planejada | Define arquitetura, gates e rollback | spec/plan |
| `bc8579a`–`a587d51` | Fundação, schema e Access | Base técnica do novo runtime | Git/testes |
| `84efa70` | Bootstrap D1 inicial | Contrato de leitura começou a ser portado | Git/teste |
| `38658db` | PWA same-origin | Cliente local deixa de depender de runtime-config | Git/testes |
| `c909a55` | Roteador, mutações e Churn D1 | Worker-alvo deixa de ser proxy no código | Git/testes locais |

## Decisões tomadas

- **Decisão registrada:** produção será um único Worker `workers.dev` com Static Assets e API no mesmo domínio.
- **Decisão registrada:** D1 será a fonte única e R2 guardará arquivos originais, relatórios e backups.
- **Decisão registrada:** Cloudflare Access usará login Google e permitirá somente as duas contas aprovadas.
- **Decisão registrada:** o uso é individual por enquanto; a auditoria ainda grava a conta efetiva.
- **Decisão registrada:** GitHub continua como backup de código, não como runtime ou deploy final.
- **Decisão registrada:** nenhuma compra de domínio ou ativação paga automática.
- **Decisão registrada:** lote operacional contém exatamente vencimentos, fichas, avaliação física e permanência, todos com a mesma data e revisão.
- **Decisão registrada:** a futura tela de importação terá data/revisão, quatro campos separados, ícone de ajuda, validação, prévia e publicação explícita; os nomes canônicos poderão ser gerados pelo sistema.
- **Decisão registrada:** o sistema antigo permanece disponível e intacto até paridade e corte aprovados.
- **Decisão registrada:** os dados oficiais prevalecem nos campos oficiais; dados manuais são preservados por ID.
- **Decisão registrada:** a lista ativa de Churns não é substituída sem revisão das divergências da prévia.

## Memória de decisões e justificativas

| Decisão | Por que | Onde impacta | Como verificar/retomar |
|---|---|---|---|
| Um Worker full-stack | Evita CORS e separação de deploy | `wrangler.jsonc`, `index.js`, PWA | testes `runtime-config`, `pwa-api`, `worker-api` |
| D1 relacional | Substitui abas frágeis por chaves e constraints | migrations/repositories | aplicar migrações em banco de teste e consultar schema |
| R2 para arquivos | Substitui Drive e permite retenção/backup | importações/backups | habilitar R2 antes das Tasks 9/11 |
| Access na borda | Usuário único e API protegida antes do código | Access/auth | validar duas contas e bloquear terceira |
| Preview antes da promoção | Evita copiar corrupção ou lote errado | import service/UI | testar lote inválido sem mudar `active` |
| Idempotência por `request_id` | Evita duplicação em retentativas | mutation log/fila | repetir a mesma chamada e comparar escrita |
| Campos oficiais separados dos manuais | Importação não apaga conhecimento operacional | profiles/churns | reconciliação por ID e hashes manuais |
| Sem LTV inferido | Preço atual não representa história | permanência/financeiro | testes e ausência da fórmula |
| Corte tardio | Protege a operação diária | Tasks 12–14 | paridade zero, backup e ensaio antes da URL nova |

## Informações importantes capturadas do chat

- **Confirmado:** o usuário quer o projeto 100% Cloudflare para frontend, backend e banco, sem Google no runtime final.
- **Confirmado:** somente o proprietário usará o sistema por enquanto.
- **Confirmado:** os quatro relatórios serão enviados dentro do PWA.
- **Confirmado:** a tela deve ter um ícone que abre instruções de upload.
- **Confirmado:** sincronização entre desktop e mobile deve ocorrer em até aproximadamente dez segundos.
- **Confirmado:** alterações em outro chat não devem ser sobrescritas durante esta revisão.
- **Confirmado:** planilhas reais e dados pessoais não entram no GitHub nem no ZIP público sem tratamento adequado.
- **Inferência:** as duas contas da allowlist pertencem ao mesmo proprietário; essa relação não foi tecnicamente verificada.

## Etapa atual em desenvolvimento

- **O que está sendo feito:** o código já troca o proxy por serviços D1 e o PWA por API same-origin. A carga inicial oficial foi gerada a partir das exportações e aplicada ao D1 remoto; a etapa corrente é a publicação segura.
- **Arquivos ativos:** `worker/src/`, `worker/migrations/`, `tests/cloudflare/`, `pwa/js/api.js`, `pwa/sw.js` e `scripts/build-d1-seed.js` sustentam o runtime e a carga inicial.
- **O que já está pronto:** esquema relacional, identidade nativa do Access com allowlist, bootstrap, roteador, mutações, análise de Churn, cliente same-origin, fila IndexedDB, carga D1, backup D1→R2 por cron e comparador de reconciliação. A suíte atual reportou 231 testes aprovados e nenhuma falha.
- **O que ainda falta imediatamente:** configurar o Access real, habilitar R2, criar o bucket, publicar o runtime completo protegido e executar a validação de corte. O Worker temporário já existe, mas não entrega o PWA nem acessa dados. Importação pelo PWA/R2, conector recorrente de reconciliação e ensaio real de restauração continuam pendentes.
- **Cuidado ao continuar:** a produção antiga está ativa; não publicar o PWA same-origin no GitHub Pages e não implantar `xsteam-gestao` com dados reais antes dos gates.

## Riscos, bloqueios, divergências e pendências

### Bloqueios externos

- **Confirmado — R2:** a conta ainda não habilitou R2; a API retornou `10042`. Tasks 9 e 11 dependem disso.
- **Confirmado — Worker temporário:** `xsteam-gestao` foi publicado em 24/09/2026 com a versão `af497def-bc8f-4ddd-ab95-13a566c8f137`. A verificação HTTP retornou 503 e a mensagem segura esperada; não há assets, D1 ou R2 no arquivo de deploy temporário.
- **A confirmar — Access:** IdP Google e política de borda para as duas contas ainda não foram comprovados remotamente. O runtime passa a obter a identidade diretamente do Access, sem configurar manualmente audiência ou domínio no Worker.

### Incompatibilidades técnicas confirmadas

- A integração ponta a ponta com o Worker remoto protegido ainda não foi executada; os testes atuais cobrem os serviços com D1 falso e não substituem esse ensaio.
- A fila de mutações agora usa IndexedDB, preserva itens antes do envio e retenta em FIFO com backoff. A validação com o Worker protegido em produção ainda não foi executada.

### CI e publicação

- A suíte local passa porque `worker/node_modules` está instalado separadamente.
- O workflow antigo roda apenas `npm ci` na raiz antes de `npm test`; a execução `35992124636` falhou em `npm test`. **Inferência:** dependências do pacote `worker/` não instaladas no runner podem ser a causa, mas o log detalhado ainda precisa confirmar.
- O fracasso impediu a publicação acidental do PWA same-origin no GitHub Pages. A versão pública antiga continuou funcional na consulta de 24/09/2026.

### Dados e operação

- D1 recebeu a carga inicial por SQL gerado fora do repositório. O comparador de reconciliação já verifica contagens, valores e hashes curtos de identificadores, mas ainda não lê a origem e o D1 remoto diretamente em uma rotina recorrente.
- O seed da Task 6 gera SQL privado, exige saída fora do repositório com modo `0600` e tem teste sintético. A carga inicial foi validada no D1 local e aplicada ao remoto. Ainda faltam evidência de paridade detalhada e conectores para as cargas recorrentes.
- A migração definitiva de Churns continua pendente de decisão sobre 2 divergências e 3 registros antigos sem par.
- Não há fonte confiável para estimar LTV histórico.
- A fila IndexedDB já mantém alterações após fechar o app, com retentativas automáticas. O backup D1→R2 e seu cron estão prontos no código, mas só poderão ser exercitados após habilitar R2; importação pelo PWA/R2 continua planejada.
- Chart.js continua vindo de CDN no HTML; o desenho “sem dependências externas de runtime” precisa decidir se esse arquivo será empacotado localmente.

### Preparação segura do ZIP para uma IA externa

- **Confirmado:** uma busca por extensões encontrou bancos SQLite locais sob `worker/.wrangler/`. Essa pasta está no `.gitignore`, mas entrará em um ZIP criado diretamente da pasta do projeto se não for excluída.
- **Confirmado:** os dois e-mails da allowlist aparecem em `worker/wrangler.jsonc`, testes, design, plano e nestes documentos de contexto. Não são segredos, mas são dados pessoais; mascará-los antes do envio é uma decisão do proprietário.
- Excluir do ZIP, no mínimo: `.git/`, `node_modules/`, `.superpowers/`, `.worktrees/`, `worker/.wrangler/`, `.env`, `.clasp.json`, `.clasprc.json`, `pwa/runtime-config.js`, `coverage/`, `*.log`, `*.xls` e `*.xlsx`.
- Não incluir seeds SQL gerados, exportações D1, relatórios TecnoFit, caches locais ou qualquer arquivo produzido fora do Git. Um ZIP baseado apenas nos arquivos rastreados pelo Git é a opção mais segura, acrescentando separadamente somente estes documentos de contexto ainda não commitados.

## Próximos passos

1. Criar teste de integração contra D1 local real para bootstrap e mutações, cobrindo SQL, joins, constraints e `db.batch()`.
2. Restaurar compatibilidade exata do DTO com o PWA: nomes dos campos, datas brasileiras na borda e configurações completas.
3. Adicionar uma versão de configuração/Fluxo/mutações que mude após qualquer gravação e sustente a sincronização em até dez segundos.
4. Corrigir a instalação de dependências no CI e impedir que o workflow legado publique o cliente same-origin antes do corte.
5. Habilitar R2 no painel com confirmação humana e criar o bucket de arquivos/backups.
6. Configurar Cloudflare Access com IdP Google e política limitada à allowlist.
7. Publicar o Worker protegido, testar o bootstrap e as mutações diretamente no `workers.dev` e só então alterar o runtime legado.
8. Implementar importação pelo PWA/R2, ensaio real de recuperação e conectores recorrentes de reconciliação.

## Arquivos e pastas importantes

| Caminho | Função | Relação com o fluxo atual | Observação |
|---|---|---|---|
| `CONTEXTO_DO_PROJETO.md` | Memória canônica | Handoff para humanos/IAs | Não contém dados pessoais reais |
| `CONTEXTO_DO_PROJETO.html` | Visualização local | Espelha este Markdown | Deve permanecer semanticamente equivalente |
| `docs/superpowers/specs/2026-09-22-cloudflare-total-design.md` | Arquitetura aprovada | Fonte das decisões | Não confundir com estado implementado |
| `docs/superpowers/plans/2026-09-22-cloudflare-total.md` | Plano de 14 Tasks | Sequência e gates | Checkboxes não foram atualizados; usar Git/código como evidência |
| `worker/wrangler.jsonc` | Bindings e runtime-alvo | Assets/D1/R2 | Contém ID do recurso, não credencial |
| `worker/migrations/` | Schema D1 | Entidades, índices e catálogos | `0001`–`0004` aplicadas remotamente |
| `worker/src/index.js` | Entrada full-stack | API + assets | Código-alvo, ainda não implantado |
| `worker/src/router.js` | Contrato HTTP | Quatro ações atuais | Autentica antes de executar |
| `worker/src/auth.js` | Access JWT | Identidade/allowlist | Requer vars remotas |
| `worker/src/repositories/dashboard-repository.js` | Leitura D1 | Bootstrap | Query de etiquetas precisa correção |
| `worker/src/services/bootstrap-service.js` | Adaptador do payload | D1→PWA | DTO ainda incompatível |
| `worker/src/services/mutation-service.js` | Escritas idempotentes | perfis/Fluxo/config | Integração real pendente |
| `worker/src/services/churn-analysis-service.js` | Análises de Churn | mensal/semanal/diagnósticos | Teste unitário aprovado |
| `pwa/js/api.js` | Cliente same-origin | `/api` | Não publicar no Pages antes do corte |
| `pwa/js/dashboard.js` | Consumidor principal do contrato | UI e sincronização | Datas brasileiras e nomes atuais são invariantes |
| `pwa/sw.js` | Cache PWA | `xsteam-static-v14` no código; inclui `sync-queue.js` | Produção pública ainda serve o runtime legado |
| `apps-script/` | Backend legado produtivo | Contingência/fonte atual | Não remover antes do corte |
| `tests/cloudflare/` | Regressões do alvo | Fundação, auth, schema, API | Faltam testes D1 integrados |
| `scripts/build-d1-seed.js` | Gerador privado XLSX→SQL da Task 6 | Migração inicial para D1 | Rascunho não commitado; saída deve ficar fora do repositório |
| `tests/cloudflare/data-migration.test.js` | Teste sintético do seed | Precedência oficial e preservação manual | Rascunho não commitado; não prova paridade em D1 real |
| `.github/workflows/deploy-pages.yml` | Deploy legado | Produção antiga | Falhou em `npm test` após `38658db` |
| `docs/operacao/CONFIGURACAO_PWA_PUBLICO.md` | Operação antiga | Recuperação antes do corte | Será substituído por guia Cloudflare |

## Como retomar o trabalho

1. Leia este arquivo, o design e o plano Cloudflare de 22/09/2026.
2. Execute `git status --short --branch` e confirme se outro chat deixou trabalho ativo.
3. Consulte o último commit e não presuma que checkboxes do plano representam conclusão.
4. Rode `npm test` e um teste D1 local real antes de alterar o contrato do bootstrap.
5. Compare cada DTO novo com o consumo em `pwa/js/dashboard.js`, `student-profiles.js` e `permanencia.js`.
6. Preserve a produção antiga e os dados Google até corte explícito.
7. Não habilite cobrança, não publique dados reais e não aplique migrações destrutivas sem backup e reconciliação.

## Contexto para outro chat ou IA

- **Projeto:** XSTEAM Gestão, PWA operacional e dashboard da Wellness.
- **Canônico:** `fitmanagementels/ALUNOS_WELLNESS_2026`, `main`, marco revisto `daf9cee`.
- **Produção:** ainda é GitHub Pages → Worker proxy → Apps Script → Sheets/Drive; está funcional e não foi cortada.
- **Migração:** código versionado do Worker full-stack, D1, Access, bootstrap, mutações, PWA same-origin, fila IndexedDB, backup e comparador de reconciliação está em andamento. A suíte atual tem 231 testes aprovados; a carga inicial D1 está concluída.
- **Cloudflare remoto:** D1 migrado com `0001`–`0004` e carga inicial; R2 desabilitado pelo código `10042`; há Worker temporário seguro; Access não comprovado.
- **Alertas críticos:** falta ativar R2 e Access antes do deploy completo; importação PWA/R2, ensaio real de recuperação e reconciliação recorrente não estão concluídos; CI legado requer revisão antes de qualquer alteração do fluxo GitHub Pages.
- **Não desfazer:** preservação de dados manuais, importação atômica, filas separadas de ficha/avaliação, permanência sem LTV inferido, Churn oficial por ID, sistema antigo intacto até o corte.
- **Plano vigente:** `docs/superpowers/plans/2026-09-22-cloudflare-total.md`.

## Contexto completo para IA externa

### Identidade e domínio

**Confirmado:** o XSTEAM Gestão é um PWA operacional com dashboard para a XSTEAM Wellness Club. Ele reúne dados de alunos e contratos provenientes do TecnoFit e dados manuais de gestão. As áreas visíveis são Home, Financeiro, Acompanhamento, Fluxo e Configurações. O repositório canônico é `fitmanagementels/ALUNOS_WELLNESS_2026`; a revisão atual corresponde ao commit `c909a55` de 24/09/2026.

### Produto em produção

**Confirmado:** a produção ainda utiliza GitHub Pages para o PWA, um Cloudflare Worker como proxy, Google Apps Script como backend e Google Sheets/Drive como persistência e entrada de arquivos. O endereço canônico é `https://fitmanagementels.github.io/ALUNOS_WELLNESS_2026/`. Em 24/09/2026, o endereço respondeu HTTP 200 e serviu o cliente antigo configurado para o Worker proxy. A migração Cloudflare ainda não realizou o corte.

O lote operacional atual contém exatamente quatro relatórios: vencimentos, fichas, avaliação física e permanência. Os quatro compartilham data de referência e revisão. A importação atual valida o lote, preserva uma base anterior diante de falha, mantém histórico de permanência e não apaga perfis, Leads ou Churns manuais.

### Funcionalidades e regras de domínio

**Confirmado:** Home separa filas de prescrições e avaliações. Os status Ativo, Bloqueado e Licença compõem o filtro Matriculados. Financeiro apresenta planos, vencimentos e permanência. Acompanhamento mantém listas específicas de ficha e avaliação. Fluxo contém Leads e Churns, com análises mensais e semanais. Perfis de alunos registram responsável, múltiplos últimos professores, perfil e observação de pagamento, etiquetas públicas/comerciais e observações gerais.

**Decisão registrada:** prescrições e avaliações nunca compartilham fila, limites ou classificação. Permanência usa a primeira entrada confiável, preserva ausências e reaparecimentos e não estima LTV multiplicando permanência pelo preço atual. Dados oficiais prevalecem nos campos oficiais; dados manuais permanecem vinculados ao ID TecnoFit. Churns são arquivados logicamente no alvo. A lista oficial de Churns possui uma prévia reconciliada que ainda não substituiu a lista ativa.

### Migração Cloudflare

**Decisão registrada:** a arquitetura-alvo usa um único Worker `workers.dev` para Static Assets e API same-origin, D1 como fonte relacional única, R2 para arquivos e backups e Cloudflare Access com login Google. Somente duas contas do proprietário estão na allowlist. GitHub permanece como versionamento, mas não participa do runtime final. Não existe autorização para comprar domínio, ativar plano pago automaticamente ou excluir os dados Google após o corte.

**Confirmado:** o código versionado contém configuração de Static Assets/D1/R2, quatro migrações SQL, identidade nativa do Access, repositório de leitura, adaptador de bootstrap, roteador HTTP, mutações idempotentes, análise de Churn, cliente PWA same-origin, fila IndexedDB persistente, backup D1→R2 e comparador seguro de reconciliação. O service worker do código está em `xsteam-static-v14`. A suíte atual reportou 231 testes aprovados, sem falhas.

**Confirmado:** `scripts/build-d1-seed.js` lê a exportação mestra e os relatórios oficiais de Churns e novos alunos, preserva campos manuais por ID e produz SQL privado. A ferramenta recusa saída dentro do repositório, cria o arquivo com permissão `0600` e imprime somente contagens. `tests/cloudflare/data-migration.test.js` usa planilhas sintéticas para verificar precedência dos dados oficiais e preservação de observações, etiquetas e retenção manuais. A carga inicial foi testada em D1 local e aplicada ao D1 remoto, onde as contagens foram confirmadas. `scripts/reconcile-d1.js` compara métricas, centavos e hashes curtos de IDs sem expor dados pessoais; o conector recorrente de origem/D1 ainda não existe, por isso a Task 6 permanece parcial para cargas futuras.

**Confirmado:** o D1 remoto `xsteam-gestao` existe. As migrações `0001_core.sql` a `0004_tags.sql` foram aplicadas e a carga inicial recebeu 316 alunos, 321 contratos, 21 perfis, 162 churns oficiais e 231 novos alunos válidos. O R2 não está habilitado e não existe bucket. O Worker `xsteam-gestao` possui somente um deployment temporário sem dados, retornando 503; a configuração efetiva de Cloudflare Access ainda não foi comprovada. O cron de backup semanal está definido no runtime completo, mas não pode rodar até existir o bucket R2.

### Modelo de dados e associações

**Confirmado:** `student_id` é a chave central. `students` guarda o retrato oficial do aluno; `contracts` representa contratos; `prescriptions` e `assessments` mantêm datas separadas; `permanence` e `permanence_events` representam estado e histórico. `student_profiles`, `student_last_teachers` e `student_tags` guardam informações manuais. `profile_catalog`, `tag_groups` e `tags` controlam opções. `leads` e `churns` representam Fluxo. `data_versions` controla versões de dados; `import_*` representa staging/auditoria; `mutation_log` fornece idempotência; `settings` guarda configurações; `usage_counters` foi reservado para telemetria.

Datas são armazenadas no D1 em ISO e dinheiro em centavos. O contrato atual do PWA, herdado do Apps Script, usa datas brasileiras em diversos campos e nomes específicos como `contrato`, `chave`, `tipo` e `continuidadeMeses`. A conversão deve ocorrer no adaptador da API, não por alteração silenciosa do significado no PWA.

### Estado e limitações da implementação

**Confirmado:** o adaptador de bootstrap normaliza etiquetas com `JOIN` ao catálogo, nomes de campos e datas na borda para o contrato legado do PWA. A validação completa contra o Worker remoto protegido continua pendente; os testes de unidade não substituem esse ensaio.

**Confirmado:** a versão exposta pelo novo backend deriva da versão ativa dos dados oficiais. As mutações manuais gravam no D1, mas não atualizam essa versão; portanto, a sincronização automática entre dispositivos não detectaria essas alterações pelo mecanismo atual.

**Confirmado:** os testes locais de Cloudflare usam bancos falsos na maior parte dos casos. Eles verificam forma e despacho, mas não executam todo o SQL contra SQLite/D1; por isso, a incompatibilidade de `student_tags` passou. Testes de integração D1 permanecem ausentes.

**Confirmado:** o workflow de Pages do commit `38658db` falhou no passo `npm test` e não publicou os arquivos same-origin no endereço antigo. A produção continuou no cliente v12. **Inferência:** a separação das dependências em `worker/package.json` pode explicar a diferença entre a suíte local e o runner limpo, mas o erro detalhado do runner não foi preservado nesta memória.

### Segurança, privacidade e continuidade

**Decisão registrada:** nenhum dado pessoal de alunos, planilha real, exportação de banco, token ou segredo pertence ao Git ou a documentos de contexto. Os e-mails do proprietário usados na allowlist são a exceção conhecida e aparecem em código de configuração, testes e documentação. A identidade da mutação vem do Access, não do payload. Backups e restauração precisam ser testados antes da migração real. A base Google permanece como contingência congelada até autorização específica. O corte depende de paridade sem divergências críticas, importação atômica, backup, ensaio desktop/mobile/offline e validação operacional por 48 horas.

**Confirmado para o compartilhamento externo:** a pasta local contém `worker/.wrangler/` com bancos SQLite de desenvolvimento ignorados pelo Git, além de dependências instaladas e possíveis configurações locais. Um ZIP bruto da pasta não é apropriado. O pacote deve excluir `.git/`, `node_modules/`, `.superpowers/`, `.worktrees/`, `worker/.wrangler/`, arquivos `.env`/Clasp/runtime-config, cobertura, logs, planilhas e qualquer seed ou exportação. Os e-mails da allowlist aparecem em configuração, testes e documentação e podem ser mascarados se o proprietário não quiser compartilhá-los.

### Vocabulário

- **Base oficial:** retrato derivado dos relatórios TecnoFit.
- **Dados manuais:** informações inseridas no PWA, como perfil, observações, Leads e campos de retenção.
- **Versão ativa:** conjunto oficial que o PWA deve considerar vigente.
- **Staging:** dados carregados e validados sem alterar a versão ativa.
- **Promoção:** troca atômica que torna um lote a nova versão ativa.
- **Prévia de Churns:** relatório de reconciliação anterior à substituição da lista operacional.
- **Same-origin:** PWA e API servidos pelo mesmo Worker/domínio.
