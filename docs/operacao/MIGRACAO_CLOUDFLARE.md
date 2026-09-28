# Publicação Cloudflare — XSTEAM Gestão

## Decisão vigente

O PWA será executado integralmente em Cloudflare Workers + D1, no endereço gratuito `workers.dev`. Não há domínio próprio, R2, Cloudflare Access, Zero Trust ou cartão de crédito neste fluxo.

- O Worker serve o PWA e a API `/api` pela mesma origem.
- O D1 `xsteam-gestao` é a base ativa.
- O login é Google OAuth direto, permitido somente para `fitmanagement.els@gmail.com` e `elohimlima15@gmail.com`.
- GitHub guarda apenas o código versionado; não é parte da execução após o corte.
- O backup é manual, local e criptografado no navegador. A senha nunca sai do dispositivo.

O endereço de destino é `https://xsteam-gestao.fitmanagement-els.workers.dev`.

## O que já está pronto

- D1 criado, migrado até `0004_tags.sql` e com carga inicial validada: 316 alunos, 321 contratos, 21 perfis, 162 churns e 231 alunos novos.
- Worker preparado para Static Assets, D1, OAuth Google, sessão segura e allowlist dos dois e-mails.
- PWA sem dependência de CDN: inclusive Chart.js é entregue localmente pelo próprio Worker e fica no cache offline.
- Configurações > Segurança e backup permite gerar arquivo `.xsteam-backup` cifrado com AES-256-GCM e PBKDF2-SHA-256 (600.000 iterações).
- A ferramenta local `scripts/restore-local-backup.js` só gera SQL fora do repositório e só aplica ao D1 mediante confirmação explícita.

## Ações manuais únicas do titular

Não envie nenhum segredo pelo chat, GitHub ou e-mail. Faça estas ações no painel, mantendo os valores somente com você.

### 1. Criar o cliente OAuth no Google Cloud

1. Entre em [Google Cloud Console](https://console.cloud.google.com/) com a conta que controla o projeto.
2. Crie ou selecione um projeto e, em **Google Auth Platform**, conclua o registro/tela de consentimento do aplicativo como **External** conforme o próprio painel orientar.
3. Em **Google Auth Platform > Clients**, clique em **Create client**, escolha **Web application** e dê um nome como `XSTEAM Gestão`.
4. Em **Origens JavaScript autorizadas**, inclua exatamente:

   `https://xsteam-gestao.fitmanagement-els.workers.dev`

5. Em **URIs de redirecionamento autorizados**, inclua exatamente:

   `https://xsteam-gestao.fitmanagement-els.workers.dev/auth/callback`

6. Guarde o **Client ID** e o **Client Secret**. Eles serão usados no próximo passo.

### 2. Cadastrar os três secrets no Worker

No Cloudflare, abra **Workers & Pages > xsteam-gestao > Settings > Variables and Secrets** e crie, como *secret*, exatamente:

| Nome | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID obtido no Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Client Secret obtido no Google Cloud |
| `SESSION_SECRET` | texto aleatório forte, exclusivo deste Worker |

Para `SESSION_SECRET`, use o gerador do seu gerenciador de senhas: no mínimo 32 caracteres aleatórios. Não reutilize senha pessoal nem o Client Secret.

### 3. Publicar

Depois de salvar os três secrets, execute no terminal, na raiz do repositório:

```bash
npm run build:pwa-assets
cd worker
./node_modules/.bin/wrangler deploy
```

O deploy completo só deve ocorrer depois dos secrets. Sem eles, o Worker responde que o login está indisponível, o que evita expor dados sem autenticação.

## Validação após o deploy

1. Abra o endereço `workers.dev` em janela anônima e confirme o redirecionamento para o Google.
2. Entre, separadamente, com cada um dos dois e-mails permitidos. Home e salvamentos devem funcionar.
3. Tente uma terceira conta Google: ela deve receber a mensagem de conta sem acesso.
4. Altere um perfil, recarregue o PWA e confirme a persistência no D1.
5. Em **Configurações > Segurança e backup**, gere um backup com senha de 12+ caracteres, guarde o arquivo e a senha em locais separados e confirme que a senha não aparece no arquivo.

Não desligue a produção legada nem apague Sheets/Drive até concluir esses testes manuais.

## Backup e recuperação

O backup é uma cópia integral do D1 baixada pelo operador autenticado e cifrada antes de sair do navegador. O arquivo não é enviado a R2, Google Drive, GitHub ou ao Worker depois da exportação.

Boa prática operacional:

1. Gere um backup antes de uma importação relevante e pelo menos semanalmente.
2. Guarde o arquivo `.xsteam-backup` em mídia pessoal confiável e a senha em um gerenciador de senhas, separados.
3. Nunca versione o arquivo nem a senha.

Para testar uma recuperação sem alterar o banco:

```bash
node scripts/restore-local-backup.js \
  --file /caminho/xsteam-backup-AAAA-MM-DD.xsteam-backup \
  --out /tmp/xsteam-restore.sql
```

O script solicita a senha sem exibi-la e cria o SQL com permissão privada. A aplicação é deliberadamente destrutiva e requer os dois parâmetros adicionais abaixo:

```bash
node scripts/restore-local-backup.js \
  --file /caminho/xsteam-backup-AAAA-MM-DD.xsteam-backup \
  --out /tmp/xsteam-restore.sql \
  --apply --confirm-database xsteam-gestao
```

## Rollback

1. Mantenha o PWA legado e suas fontes originais até a validação manual terminar.
2. Registre a versão do Worker publicada pelo painel Cloudflare antes de cada atualização importante.
3. Em falha crítica, interrompa gravações e recupere a versão anterior do Worker; não altere linhas manualmente antes de reconciliar por ID.
4. Restaure o D1 somente a partir de backup conhecido e com a confirmação explícita acima.
