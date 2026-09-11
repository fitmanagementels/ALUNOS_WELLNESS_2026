# Recuperação do backend público do PWA — plano de implementação

**Objetivo:** restaurar a comunicação PWA → Cloudflare Worker → Apps Script e tornar futuras publicações reproduzíveis, com apenas a autorização inicial do Web App feita manualmente.

**Diagnóstico confirmado:** o Worker está publicado e recebe as ações permitidas, mas o `APPS_SCRIPT_WEBAPP_URL` configurado aponta para uma implantação inexistente ou sem acesso público. O Apps Script devolve HTML/401/404, que o Worker converte corretamente em 502. O cache local ainda pode exibir números antigos sem indicar que a fonte está indisponível.

## Tarefa 1 — Fixar o comportamento esperado em testes

**Arquivos:**
- Modificar: `tests/worker-api.test.js`
- Modificar: `tests/dashboard-html.test.js`
- Modificar: `tests/deploy-config.test.js`

1. Exigir telemetria segura quando o Apps Script responder HTML ou erro HTTP.
2. Exigir aviso explícito quando o PWA abrir dados do cache sem conexão com a base.
3. Exigir atualização da implantação Web App pelo ID estável, seguida de verificação de saúde.
4. Executar os testes alterados e confirmar que falham pelos comportamentos ainda ausentes.

## Tarefa 2 — Melhorar diagnóstico e transparência do PWA

**Arquivos:**
- Modificar: `worker/src/index.js`
- Modificar: `pwa/js/dashboard.js`

1. Registrar no Worker apenas evento, status HTTP e tipo de conteúdo do upstream; nunca URL, segredo ou corpo.
2. Se o bootstrap vier do cache e a consulta de versão falhar, manter a interface utilizável e mostrar que os dados são salvos no dispositivo.
3. Se não houver cache, explicar que a conexão com a base falhou e orientar nova tentativa.
4. Executar os testes de Worker e frontend.

## Tarefa 3 — Automatizar publicações futuras do Apps Script

**Arquivos:**
- Modificar: `.github/workflows/deploy-apps-script.yml`
- Modificar: `docs/operacao/CONFIGURACAO_PWA_GITHUB_PAGES.md`

1. Remover a variável-gatilho redundante do job; os secrets passam a ser a configuração necessária.
2. Após `clasp push`, usar `clasp deploy --deploymentId` para criar uma versão e atualizar o Web App sem trocar a URL.
3. Verificar o endpoint `/exec` com a ação `versao` e o segredo compartilhado, sem imprimir credenciais.
4. Documentar a única preparação manual: criar uma implantação Web App executada pelo proprietário e acessível a qualquer pessoa, depois copiar URL e ID para os secrets do GitHub.
5. Executar toda a suíte do projeto.

## Tarefa 4 — Preparar integração e validação de produção

1. Revisar o diff e confirmar que arquivos locais do usuário permanecem intocados.
2. Commitar a correção na branch isolada.
3. Aguardar somente a criação/autorização manual do Web App e atualização dos dois secrets.
4. Integrar no `main`, publicar e validar `versao`, `bootstrap` e `analiseChurn` no endpoint público.

**Limite técnico:** Google exige interação do proprietário para conceder a primeira autorização e escolher a política de acesso do Web App. Nenhum CLI confiável configura essa política inicial. Todo o restante será automatizado pelo pipeline.
