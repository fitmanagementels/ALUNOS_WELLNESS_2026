# Migração Cloudflare — XSTEAM Gestão

## Estado em 24/09/2026

- D1 `xsteam-gestao` criado e migrado até `0004_tags.sql`.
- Carga inicial validada por contagem: 316 alunos, 321 contratos, 21 perfis, 162 churns e 231 alunos novos.
- Worker temporário `xsteam-gestao` publicado em modo seguro; responde HTTP 503 e não possui assets, D1 ou R2 vinculados.
- R2 ainda não foi habilitado. O bucket `xsteam-gestao-files` não existe.
- Cloudflare Access ainda não protege o Worker.
- O runtime completo permanece apenas no repositório, testado localmente.
- O deploy completo em modo seco validou 19 arquivos estáticos e os bindings D1, R2, Assets e allowlist, sem alterar recursos remotos.

## Ativações que exigem o titular da conta

1. No painel Cloudflare, habilitar R2 Object Storage sem contratar plano pago e aceitar os termos aplicáveis.
2. Inicializar Cloudflare Zero Trust e cadastrar Google como provedor de identidade.
3. Em `Workers & Pages > xsteam-gestao > Access`, proteger **All traffic** com política Allow para os dois e-mails autorizados. Não usar política por domínio de e-mail.

O segredo do cliente OAuth do Google deve ficar apenas no Google Cloud e no painel Cloudflare. Ele não deve ser registrado no repositório, enviado por chat ou colocado em `wrangler.jsonc`.

## Publicação do runtime completo

Depois das ativações acima, executar na raiz do repositório:

```bash
cd worker
./node_modules/.bin/wrangler r2 bucket create xsteam-gestao-files
./node_modules/.bin/wrangler deploy
```

Verificações obrigatórias após o deploy:

1. Acessar `https://xsteam-gestao.fitmanagement-els.workers.dev` em sessão não autenticada: o Access deve solicitar login.
2. Entrar com cada conta autorizada e carregar Home; a API `/api` deve responder bootstrap autenticado.
3. Uma conta não autorizada deve receber bloqueio antes de carregar assets ou API.
4. Abrir um perfil, gravar uma alteração e recarregar o PWA para confirmar a persistência no D1.
5. Desligar a rede, gravar uma alteração, fechar/reabrir o PWA e religar a rede para confirmar o reenvio da fila IndexedDB.

## Backup e recuperação

O Worker possui cron semanal, segunda-feira às 06:00 UTC, preparado para gerar backups no R2. Cada execução:

- lê tabelas do D1 em páginas;
- grava JSONL compactado por tabela;
- calcula SHA-256 de cada objeto;
- grava `manifest.json` somente quando todos os objetos foram aceitos.

Não considerar um backup existente sem manifesto como recuperável. Antes de qualquer corte, executar e conferir um backup real no R2.

Para preparar uma recuperação, baixar o `manifest.json` e os objetos do mesmo prefixo para uma pasta local temporária e executar:

```bash
node scripts/restore-r2-backup.js \
  --manifest /tmp/xsteam-backup/backups/AAAA-MM-DD/ID/manifest.json \
  --backup-dir /tmp/xsteam-backup \
  --out /tmp/xsteam-restore.sql
```

O script valida schema, lista fixa de tabelas, contagens e SHA-256 antes de gerar o SQL com permissão privada. Ele não restaura nada por padrão. A aplicação ao D1 requer, além dos arquivos conferidos, `--apply --confirm-database xsteam-gestao`; essa etapa permanece uma operação humana e destrutiva.

## Rollback

1. Não apagar a planilha, Drive ou runtime legado durante a estabilização.
2. Registrar a versão do Worker imediatamente antes da publicação completa.
3. Se houver falha crítica, publicar novamente a versão segura/legada e interromper novas gravações.
4. Restaurar D1 somente a partir de manifesto íntegro e com uma confirmação explícita do banco alvo.
5. Não corrigir registros manualmente em produção antes de reconciliar a origem e o D1 por ID.

## Critério de corte

O GitHub continua somente como backup de código. O corte só pode ser confirmado após Access, D1, R2, PWA, sincronização offline, backup e reconciliação estarem verificados no ambiente Cloudflare.
