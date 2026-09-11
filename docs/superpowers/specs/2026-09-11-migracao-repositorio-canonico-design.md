# Migração do PWA para o repositório canônico

Data: 11 de setembro de 2026

## Objetivo aprovado

Transformar `fitmanagementels/ALUNOS_WELLNESS_2026` no repositório canônico da Base Central TecnoFit e do PWA XSTEAM, contendo código, documentação, testes, contexto portátil e automações de publicação.

## Fonte e destino

- Fonte funcional: `fitmanagementels/BASE_TECNOFIT_WELLNESS`, commit `bc378e7effb7876d543d4b982e6ee384e0ed4c47`.
- Destino canônico: `fitmanagementels/ALUNOS_WELLNESS_2026`, branch `main`.
- O histórico Git da fonte será incorporado ao destino para preservar autoria, decisões e possibilidade de auditoria.
- O estado anterior da Gestão de Agenda ficará recuperável pela tag `agenda-legacy-2026-09-11`.

## Árvore final

O topo do repositório será a aplicação principal, sem uma subpasta duplicada:

- `apps-script/`: backend, importação, planilha e APIs;
- `pwa/`: interface publicável e instalável;
- `worker/`: ponte Cloudflare entre navegador e Apps Script;
- `scripts/`: validação e geração de configuração pública;
- `tests/`: regressões automatizadas;
- `docs/`: operação, especificações e planos;
- `CONTEXTO_DO_PROJETO.md` e `.html`: memória canônica;
- `.github/workflows/`: automações de PWA, Worker e Apps Script.

O antigo diretório `Appscript/` da Gestão de Agenda e os playbooks `.maestro/` saem da árvore atual para não haver duas aplicações concorrentes. Eles permanecem íntegros na tag de restauração.

## Publicação do PWA

- Novo endereço esperado: `https://fitmanagementels.github.io/ALUNOS_WELLNESS_2026/`.
- O PWA continuará usando o Worker público já implantado em `https://xsteam-dashboard-api.fitmanagement-els.workers.dev`.
- O workflow de Pages aceita a variável `PUBLIC_WORKER_URL`; se ela ainda não existir no novo repositório, usa esse endpoint público como fallback.
- O endereço padrão aberto pelo Apps Script passa a apontar para o novo Pages.
- Manifesto e recursos usam caminhos relativos e não exigem alteração de escopo.

## Backend e segredos

Secrets do GitHub não podem ser copiados ou lidos a partir de outro repositório. A migração não expõe nem recria tokens. O Worker e o Apps Script em produção continuam operando nos endereços existentes. Para que o repositório novo também faça deploy automático dessas duas camadas, seus secrets precisam ser cadastrados posteriormente no destino.

## Segurança e dados

- Migrar somente arquivos rastreados no Git.
- Não copiar `.vscode/`, `.superpowers/`, `.worktrees/`, planilhas reais ou arquivos locais não rastreados.
- Ignorar `*.xls` e `*.xlsx` no repositório canônico.
- Nunca gravar no frontend o segredo compartilhado entre Worker e Apps Script.

## Verificação

- Executar `npm test` e exigir 200 testes aprovados.
- Confirmar que o repositório contém `apps-script/`, `pwa/`, `worker/`, testes e os dois contextos.
- Confirmar que `origin/main` e o HEAD local têm o mesmo hash.
- Verificar a execução do workflow **Deploy PWA**.
- Abrir o novo endereço em sessão limpa e confirmar carregamento do dashboard pelo Worker.

## Rollback

- Estado da Gestão de Agenda: tag `agenda-legacy-2026-09-11`.
- Estado do PWA anterior à migração: commit `bc378e7` e repositório `BASE_TECNOFIT_WELLNESS`.
- O repositório e o Pages antigos não são excluídos nesta etapa; permanecem como redundância até a nova publicação ser confirmada.
