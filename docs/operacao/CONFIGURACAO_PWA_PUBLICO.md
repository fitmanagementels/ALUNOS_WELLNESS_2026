# Configuração única — PWA público XSTEAM

Este é o procedimento de publicação do PWA sem login Google. O navegador acessa o GitHub Pages; o Cloudflare Worker encaminha ações ao Apps Script; o Apps Script continua sendo a única camada que lê e grava na planilha mestre.

## Decisão de acesso

O PWA é público por URL. Qualquer pessoa que receber a URL consegue ver o dashboard e usar as operações disponíveis, como cadastrar ou editar leads. Não envie esse link para quem não deve acessar os dados.

O endereço público não contém a chave interna. Essa chave fica somente entre Cloudflare e Apps Script.

## Checklist de configuração

- [ ] Web App Apps Script executa como proprietário e aceita qualquer pessoa.
- [ ] `APPS_SCRIPT_SHARED_SECRET` existe nas Propriedades do Script.
- [ ] `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` existem como secrets do GitHub.
- [ ] `APPS_SCRIPT_WEBAPP_URL` e `APPS_SCRIPT_SHARED_SECRET` existem como secrets do GitHub.
- [ ] `CLASPRC_JSON`, `APPS_SCRIPT_ID` e `APPS_SCRIPT_API_DEPLOYMENT_ID` existem como secrets do GitHub.
- [ ] Worker foi publicado e sua URL foi copiada.
- [ ] `PUBLIC_WORKER_URL` existe como variável do GitHub.
- [ ] Pages foi publicado e abriu sem login Google.

## 1. Publicar o backend Apps Script

O código local já está organizado em `apps-script/`. Primeiro, envie-o para o projeto vinculado à planilha mestre pelo ambiente local que contém o `clasp` autenticado:

```bash
npx --yes @google/clasp@latest push --force
```

No editor Apps Script da planilha mestre, abra **Implantar > Nova implantação** e escolha **App da Web**.

Preencha:

| Campo | Valor |
| --- | --- |
| Descrição | `API pública XSTEAM` |
| Executar como | `Eu` (a conta proprietária da planilha) |
| Quem pode acessar | `Qualquer pessoa` |

Clique em **Implantar**, autorize com a conta proprietária se o Google pedir e copie a URL que termina com `/exec`. Não use a URL `/dev`.

Essa URL não deve ser divulgada como endereço do dashboard. Ela será usada apenas como secret no GitHub.

## 2. Criar a chave interna no Apps Script

No mesmo editor Apps Script, abra **Configurações do projeto > Propriedades do script** e crie:

| Propriedade | Valor |
| --- | --- |
| `APPS_SCRIPT_SHARED_SECRET` | uma sequência aleatória com pelo menos 32 caracteres |

Para gerar a sequência localmente, execute e copie o resultado uma única vez:

```bash
openssl rand -base64 48
```

Não cole essa sequência em arquivos do projeto, chat, variáveis públicas ou planilhas. O valor exato será criado novamente como secret do GitHub na etapa 4.

## 3. Criar ou acessar a conta Cloudflare

Abra [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) e crie/acessa uma conta gratuita. Não é necessário transferir domínio nem cadastrar cartão para usar Workers no endereço padrão `workers.dev`.

Depois de entrar:

1. Abra [My Profile > API Tokens](https://dash.cloudflare.com/profile/api-tokens).
2. Clique em **Create Token**.
3. Escolha **Edit Cloudflare Workers**.
4. Em **Account Resources**, selecione a conta XSTEAM; mantenha as permissões mínimas do modelo.
5. Crie o token e copie-o imediatamente. Ele será mostrado uma única vez.
6. Copie também o **Account ID**, exibido na barra lateral da visão geral da conta Cloudflare.

## 4. Registrar os secrets no GitHub

Abra [Secrets and variables > Actions](https://github.com/fitmanagementels/ALUNOS_WELLNESS_2026/settings/secrets/actions), escolha **New repository secret** e crie estes quatro secrets:

| Nome | Valor |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | token criado na etapa 3 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID da etapa 3 |
| `APPS_SCRIPT_WEBAPP_URL` | URL `/exec` copiada na etapa 1 |
| `APPS_SCRIPT_SHARED_SECRET` | exatamente a sequência criada na etapa 2 |

Para que mudanças futuras no Apps Script sejam publicadas automaticamente, mantenha também:

| Nome | Valor |
| --- | --- |
| `CLASPRC_JSON` | conteúdo completo do arquivo `.clasprc.json` da conta proprietária |
| `APPS_SCRIPT_ID` | ID do projeto Apps Script |
| `APPS_SCRIPT_API_DEPLOYMENT_ID` | trecho entre `/s/` e `/exec` na URL do Web App |

Todos são **Secrets**, não **Variables**. Nunca os envie por WhatsApp, e-mail, GitHub Issue ou commit.

## 5. Publicar o Worker

Abra [Actions](https://github.com/fitmanagementels/ALUNOS_WELLNESS_2026/actions), selecione **Deploy Worker**, clique em **Run workflow** e confirme em `main`.

Ao finalizar com sucesso, abra o log da etapa `deploy`. Ele exibirá uma URL semelhante a:

```text
https://xsteam-dashboard-api.<sua-conta>.workers.dev
```

Copie a URL completa, sem adicionar `/api`.

## 6. Ligar o PWA ao Worker

Abra [Actions variables](https://github.com/fitmanagementels/ALUNOS_WELLNESS_2026/settings/variables/actions), na aba **Variables**, crie:

| Nome | Valor |
| --- | --- |
| `PUBLIC_WORKER_URL` | URL do Worker copiada na etapa 5, sem barra final |

Volte a [Actions](https://github.com/fitmanagementels/ALUNOS_WELLNESS_2026/actions), abra **Deploy PWA**, escolha **Run workflow** e execute em `main`.

Depois de `Success`, abra:

```text
https://fitmanagementels.github.io/ALUNOS_WELLNESS_2026/
```

O PWA deve abrir a tela de carregamento e depois o dashboard, sem popup ou botão de login Google.

## 7. Validação operacional

1. Abra o link acima em janela anônima: ele deve carregar sem login Google.
2. Confira a data da última base e os indicadores do filtro padrão.
3. Cadastre um Lead temporário; ele deve aparecer de imediato na tela e sincronizar em seguida.
4. Recarregue a página e confirme que o Lead está na lista.
5. Abra a planilha e confirme uma única linha correspondente em `FLUXO_LEADS`.
6. Edite ou remova o registro de teste pelo fluxo normal, se aplicável.

## Remover a configuração antiga de OAuth

Após confirmar o PWA público em produção, apague as três **Variables** antigas do GitHub, pois elas não são mais usadas:

```text
PUBLIC_OAUTH_CLIENT_ID
PUBLIC_OAUTH_SCOPES
PUBLIC_APPS_SCRIPT_DEPLOYMENT_ID
```

O cliente OAuth criado no Google Cloud pode permanecer inativo ou ser excluído posteriormente. Ele não participa mais do PWA.

## Atualizações futuras

- Mudanças em `pwa/` publicam o Pages automaticamente.
- Mudanças em `worker/` publicam o Worker automaticamente, desde que os secrets continuem cadastrados.
- Mudanças em `apps-script/` executam os testes, enviam os arquivos, atualizam a mesma implantação Web App e validam a ação `versao` automaticamente.
- O workflow falha de forma explícita se a URL deixar de ser pública, devolver HTML ou não responder com uma versão válida.

## Recuperação rápida quando o PWA mostra dados antigos ou não carrega

1. Abra o [projeto Apps Script XSTEAM](https://script.google.com/home/projects/18Q6ACZwY09BQZTVtWcMSiL1tfgakyns67sEyYkX5NuidBQD_PZH60858/edit).
2. Em **Implantar > Nova implantação > App da Web**, use **Executar como: Eu** e **Quem pode acessar: Qualquer pessoa**.
3. Copie a URL terminada em `/exec`.
4. Em [Secrets do GitHub](https://github.com/fitmanagementels/ALUNOS_WELLNESS_2026/settings/secrets/actions), atualize `APPS_SCRIPT_WEBAPP_URL` com a URL completa.
5. No mesmo local, atualize `APPS_SCRIPT_API_DEPLOYMENT_ID` com o trecho entre `/s/` e `/exec`.

Depois dessa configuração única, os workflows cuidam das próximas publicações. Não é necessário alterar o PWA, a planilha ou o Cloudflare manualmente.

## Desativação e rollback

Para interromper imediatamente o acesso público, no Cloudflare desative ou exclua o Worker. Em seguida, no Apps Script, remova `APPS_SCRIPT_SHARED_SECRET` e revogue o token Cloudflare em **My Profile > API Tokens**.

Para retornar temporariamente ao PWA antigo com login, restaure no GitHub a última implantação Pages anterior a esta migração. Isso não altera nenhuma base ou registro da planilha.
