# Google direto e backup local criptografado — Design

## Decisão

O XSTEAM Gestão continuará no Cloudflare Worker e D1, mas não usará R2 nem Cloudflare Access. A autenticação será Google OAuth direto no Worker. Apenas `fitmanagement.els@gmail.com` e `elohimlima15@gmail.com` poderão iniciar uma sessão. Não haverá domínio próprio nem uso de cartão.

## Objetivo

Permitir o uso diário do PWA pelo endereço `workers.dev`, com API e dados protegidos por login Google, e oferecer backup manual criptografado baixado pelo navegador.

## Arquitetura

```text
PWA no Worker
  ├── GET /auth/login: inicia OAuth Google com state, nonce e PKCE
  ├── GET /auth/callback: valida a resposta Google e emite sessão HttpOnly
  ├── POST /auth/logout: encerra a sessão
  ├── POST /api: requer sessão, lê/grava D1
  └── POST /api (ação exportBackup): entrega snapshot autenticado ao PWA

PWA
  ├── redireciona para /auth/login quando não há sessão
  └── cifra o snapshot localmente e baixa arquivo .xsteam-backup
```

O Worker recebe `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `SESSION_SECRET` por Secrets do Cloudflare. O segredo OAuth e o segredo de sessão nunca entram no Git, no PWA ou nos logs. `ALLOWED_EMAILS` continua como variável de allowlist.

## Login Google

1. O navegador solicita `/auth/login`.
2. O Worker gera state, nonce e verificador PKCE aleatórios, armazena-os em cookie temporário assinado e redireciona para Google OAuth.
3. O Google redireciona para `/auth/callback`.
4. O Worker confere state, troca o código pelos tokens Google e valida `id_token`, emissor, audiência, nonce e expiração usando as chaves públicas do Google.
5. O Worker normaliza o e-mail e aplica a allowlist exata.
6. Para e-mail permitido, emite cookie de sessão assinado, `HttpOnly`, `Secure`, `SameSite=Lax`, com expiração curta e sem token Google armazenado.
7. O roteador usa a sessão para identificar o autor das mutações. Sem sessão, responde 401; e-mail fora da lista, 403.

Não haverá login por senha, cadastro, acesso por domínio de e-mail ou fallback aberto.

## Backup local

`exportBackup` devolve um retrato autenticado e versionado das tabelas D1 necessárias à recuperação: alunos, contratos, eventos operacionais, perfis, professores, etiquetas, Leads, Churns, novos alunos, configurações, versões e logs de mutação. O payload não é registrado em logs.

No PWA, a área **Configurações → Segurança e backup** terá senha, confirmação de senha, botão de geração e a data local do último backup. Antes do download, o navegador:

1. serializa o retrato como JSON;
2. gera salt e IV aleatórios;
3. deriva chave AES-256-GCM por PBKDF2-SHA-256 com 600.000 iterações;
4. cifra o conteúdo localmente;
5. baixa envelope `.xsteam-backup` com versão, algoritmo, salt, IV e ciphertext codificados em base64.

A senha nunca transita pela rede, não é persistida e não pode ser recuperada. O PWA não expõe restauração. Uma ferramenta local de recuperação decifra o envelope por senha inserida em prompt protegido, verifica versão e exige confirmação explícita do banco antes de gerar/aplicar SQL.

## Remoções e compatibilidade

- Remover binding R2, cron semanal e handler agendado do runtime principal.
- Remover serviços, scripts e documentação específicos de backup R2 após substituição pelos equivalentes locais.
- Remover configuração e validação Cloudflare Access do runtime principal; testes de Access temporário serão substituídos pelos testes OAuth/sessão.
- D1, esquema, carga inicial, mutações idempotentes, fila IndexedDB e assets do PWA permanecem.
- A produção antiga GitHub Pages/Apps Script não será removida antes de validação explícita do novo Worker.

## Erros e operação

- Falha Google, state expirado, token inválido ou sessão ausente: interface direciona ao login, sem exibir detalhes sensíveis.
- E-mail não autorizado: mensagem neutra de conta sem acesso; não cria sessão.
- Falha de exportação ou cifra: não baixa arquivo parcial e mantém o app utilizável.
- Senhas divergentes, vazias ou fracas são recusadas no navegador; mínimo de 12 caracteres.
- O download é manual. O usuário deve guardar arquivo e senha em locais separados, fora do repositório e do GitHub.

## Testes e critério de aceite

- Testes unitários para state/PKCE, validação de `id_token`, allowlist, cookies de sessão, logout e rejeição de credenciais inválidas.
- Testes de integração do roteador para 401, 403, sessão válida e identificação de autor.
- Testes do PWA para redirecionamento de login, cifra AES-GCM, envelope, confirmação de senha e nenhum envio da senha à API.
- Teste local de recuperação para envelope válido, senha inválida, versão inválida e confirmação do banco.
- Teste de configuração garantindo ausência de binding R2, cron e Access no Worker final.
- Validação manual posterior com as duas contas autorizadas e uma conta não autorizada.

## Ação manual posterior

O proprietário cria um cliente OAuth Web no Google Cloud, com a URL de callback exibida pela aplicação, e cadastra `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `SESSION_SECRET` como Secrets do Worker no painel Cloudflare. Não deve compartilhar o Client Secret nem o segredo de sessão por chat ou Git.
