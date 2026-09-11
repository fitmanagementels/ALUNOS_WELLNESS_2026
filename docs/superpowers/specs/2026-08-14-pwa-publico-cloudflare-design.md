# PWA público via Cloudflare Worker — desenho técnico

## Objetivo

Disponibilizar o PWA XSTEAM no GitHub Pages sem login Google para os usuários. O dashboard continuará lendo e gravando somente por meio da planilha mestre, controlada pelo Apps Script.

O acesso será público: qualquer pessoa que receber ou descobrir a URL poderá visualizar os dados e usar as ações de edição que o PWA disponibiliza. Esta é uma decisão explícita do responsável pelo projeto em 14/08/2026.

## Arquitetura aprovada

```text
Navegador / PWA (GitHub Pages)
            |
            | HTTPS JSON
            v
Cloudflare Worker público
            |
            | chave interna + HTTPS
            v
Apps Script Web App (executa como proprietário)
            |
            v
Planilha mestre TecnoFit
```

O Worker é uma ponte sem estado. Ele não persiste alunos, contratos, leads, churns ou perfis de pagamento. Sua função é aceitar chamadas do PWA, validar a forma da solicitação, responder com cabeçalhos CORS adequados e encaminhar a ação ao Apps Script.

## Responsabilidades

### PWA no GitHub Pages

- Não solicitar login Google e não carregar a biblioteca Google Identity Services.
- Chamar apenas o endpoint público do Worker.
- Preservar o cache local, o carregamento progressivo, a fila de alterações e a atualização otimista já existentes.
- Nunca conter a chave interna entre Worker e Apps Script.

### Cloudflare Worker

- Expor uma única rota HTTPS de API para o PWA.
- Aceitar somente `POST` JSON e `OPTIONS` para preflight CORS.
- Aceitar somente as ações atuais do dashboard: `bootstrap`, `versao`, `salvarMutacoes` e `analiseChurn`.
- Rejeitar corpo inválido, ação desconhecida e requisições excessivas com respostas compreensíveis.
- Incluir a chave privada no pedido ao Apps Script; essa chave será variável secreta do Worker.
- Não registrar dados pessoais em logs.

### Apps Script

- Manter a planilha como única fonte de dados.
- Adicionar uma camada HTTP (`doPost`) para receber as ações públicas encaminhadas pelo Worker.
- Validar a chave interna antes de executar qualquer operação.
- Reutilizar `executarApiDashboard()` para não duplicar regras de leitura, escrita, cache ou validação de dados.
- Responder somente objetos JSON padronizados, sem expor mensagens internas, IDs de Drive ou conteúdo integral de planilhas.

## Contrato de API

Pedido do PWA ao Worker:

```json
{
  "action": "bootstrap",
  "payload": {}
}
```

Resposta de sucesso:

```json
{
  "ok": true,
  "data": {},
  "meta": { "versao": "..." }
}
```

Resposta de falha:

```json
{
  "ok": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Mensagem segura para o usuário." }
}
```

O Worker acrescenta a chave interna somente na comunicação servidor-a-servidor com o Apps Script. O contrato entre PWA e Worker não inclui autenticação.

## Fluxo de dados

1. O PWA inicia imediatamente, usando seu cache quando disponível.
2. Em paralelo, solicita `bootstrap` ao Worker.
3. O Worker encaminha a chamada ao Web App do Apps Script com a chave interna.
4. O Apps Script consulta ou altera a planilha e devolve a resposta padronizada.
5. Para alterações, o PWA atualiza a interface de forma otimista, inclui a operação na fila local e confirma a gravação em segundo plano.
6. Se uma alteração falhar, a fila a mantém para nova tentativa e o PWA informa a pendência sem bloquear o uso.

## Configuração e segredos

- `WORKER_APPS_SCRIPT_URL`: URL do Web App publicado do Apps Script. Pode ser variável de ambiente não secreta no Worker.
- `WORKER_APPS_SCRIPT_SHARED_SECRET`: chave aleatória exclusiva entre Worker e Apps Script. Será segredo do Worker.
- `APPS_SCRIPT_SHARED_SECRET`: a mesma chave, guardada em Propriedades do Script do Apps Script. Nunca será incluída no repositório, no Pages ou no PWA.
- `PUBLIC_WORKER_URL`: URL pública do Worker. É a única configuração de API entregue ao frontend.

As antigas variáveis públicas de OAuth (`PUBLIC_OAUTH_CLIENT_ID` e `PUBLIC_OAUTH_SCOPES`) deixarão de ser usadas pelo PWA. Elas poderão ser removidas do repositório depois da migração validada.

## Publicação

- O fluxo existente de GitHub Pages continuará publicando a pasta `pwa/`.
- Um workflow específico poderá publicar o Worker após mudanças em sua pasta. Ele exigirá credenciais administrativas da Cloudflare, configuradas como secrets do GitHub.
- Enquanto o workflow não estiver configurado, o Worker poderá ser publicado manualmente uma única vez pela CLI; a opção automática é a preferida.
- O Web App do Apps Script será publicado para executar como proprietário e aceitar acesso anônimo, pois somente o Worker deverá conhecer a chave interna.

## Erros e limites

- `400`: pedido malformado ou ação inválida.
- `401`: chave interna ausente ou inválida entre Worker e Apps Script.
- `429`: limite de requisições atingido; o PWA mantém a fila e tenta novamente.
- `502/503`: Apps Script ou planilha indisponíveis; o PWA permanece navegável com último cache válido e sinaliza sincronização pendente.
- Logs não conterão nome, telefone, identificador de aluno, payload ou segredo.

## Critérios de aceite

1. Abrir o PWA do GitHub Pages não exibe login Google nem carrega OAuth.
2. O dashboard apresenta dados da planilha usando o endpoint do Worker.
3. Cadastro e edição de leads, perfis de pagamento e demais mutações existentes continuam gravando na planilha.
4. O PWA conserva atualização otimista e fila local quando houver duas ações próximas.
5. Uma chamada direta ao Apps Script sem a chave interna recebe resposta não autorizada.
6. Nenhum segredo aparece em arquivos do `pwa/`, histórico Git ou logs de frontend.
7. Testes de contrato verificam ações aceitas, ações recusadas, propagação de falha e ausência de OAuth no cliente.

## Limites conscientes desta fase

- Não há controle de identidade, função ou permissão por pessoa.
- A URL equivale ao acesso; não é adequada para dados que não possam ser expostos a qualquer visitante.
- Não haverá migração de dados, alteração da estrutura das abas ou mudança nos cálculos do dashboard.
- Proteção contra abuso será inicial e voltada à estabilidade; uma camada de usuários poderá ser adicionada em uma fase futura, sem mudar a base de dados.
