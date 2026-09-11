# PWA XSTEAM no GitHub Pages com backend no Apps Script

**Data:** 06/08/2026
**Status:** aguardando revisão do usuário

## Objetivo

Mover o dashboard XSTEAM para um PWA estático hospedado no GitHub Pages, preservando a planilha mestre, o Drive e as regras atuais no Apps Script. A atualização de código deve ser automática a partir da branch `main`, sem copiar arquivos manualmente no editor Apps Script.

O painel lateral de importação continua dentro da planilha. O PWA deixa de ser servido pelo Apps Script, eliminando a moldura branca do Google e permitindo instalação no celular.

## Decisões aprovadas

- O frontend será publicado no GitHub Pages.
- O Apps Script permanecerá como backend ligado à planilha mestre e ao Drive.
- A base de dados continua nas abas existentes do Google Sheets.
- O acesso será por conta Google autorizada.
- Inicialmente, apenas as contas Google do proprietário serão autorizadas.
- Todas as contas autorizadas terão o mesmo acesso ao dashboard nesta fase.
- O deploy do frontend e do backend será acionado automaticamente por alterações na `main`.

## Arquitetura

```text
PWA no GitHub Pages
  ├─ login Google e token OAuth
  ├─ cache local por conta e fila de mutações
  └─ assets estáticos, manifest e service worker
             │
             ▼
Google Apps Script Execution API
             │
             ▼
Apps Script vinculado à planilha mestre
  ├─ leitura do dashboard
  ├─ gravação de Leads, Churns e configurações
  ├─ importação e auditoria já existentes
  └─ acesso ao Drive para os lotes de entrada
             │
             ▼
Google Sheets + Google Drive
```

O PWA não acessará Sheets, Drive ou a planilha diretamente. Ele usará a Apps Script Execution API com um token OAuth da pessoa autenticada. O frontend terá somente identificadores públicos de configuração, nunca senha, refresh token, segredo OAuth ou dados de alunos embutidos.

## Autenticação e segurança

### Modelo adotado

O PWA usa Google Identity Services no navegador para obter um token OAuth de curta duração. Esse token chama a Apps Script Execution API (`scripts.run`) e a API executa as funções permitidas no projeto Apps Script.

O projeto Apps Script será implantado como **API Executable** e associado a um projeto Google Cloud padrão. A tela de consentimento OAuth será configurada como externa em modo de teste enquanto houver somente contas selecionadas; as contas autorizadas serão incluídas como usuários de teste. Cada conta também terá o acesso necessário ao projeto Apps Script e à planilha, conforme a configuração da implantação.

### Limites de exposição

- O frontend envia apenas ações previstas por uma API de dashboard com lista branca.
- Operações de importação, Drive, histórico e estrutura da planilha não serão expostas na interface nem no contrato da API do PWA.
- Os métodos internos do backend permanecem internos; o frontend não recebe referências a abas, IDs de arquivos do Drive ou dados desnecessários.
- O Client ID OAuth e o ID do script podem ser públicos. Eles não concedem acesso por si só.
- Tokens ficam apenas na sessão do navegador; não entram no repositório, no service worker, nos logs ou no cache persistente.
- Ao sair ou trocar de conta, o PWA remove o cache local daquela sessão antes de carregar dados da nova conta.

### Experiência de acesso

1. O PWA abre imediatamente usando o shell estático do GitHub Pages.
2. Se não houver sessão válida, mostra a tela de entrada Google.
3. Após autenticação, chama o bootstrap do dashboard.
4. Se a conta não estiver autorizada, mostra uma mensagem clara de acesso não permitido e não renderiza dados em cache.
5. Ao expirar o token, solicita autenticação novamente sem perder alterações que já estejam na fila local.

## Organização do repositório

```text
apps-script/
  *.gs                         # backend, importação e API
  Sidebar.html                 # painel interno da planilha
  appsscript.json

pwa/
  index.html                   # shell do PWA
  css/
    app.css
  js/
    app.js                     # bootstrap, estado e páginas
    api.js                     # Google Identity + Execution API
    cache.js                   # cache local por conta
    queue.js                   # fila otimista e retry
  assets/
    xsteam-logo.svg
    icons/
  manifest.webmanifest
  sw.js
  runtime-config.js            # gerado no deploy; não contém segredos

.github/workflows/
  deploy-pages.yml
  deploy-apps-script.yml
```

Os atuais arquivos `Dashboard.html`, `DashboardClient.html`, `DashboardComponents.html`, `DashboardStyles.html` e `XsteamLogo.html` serão migrados para `pwa/`. Depois da migração validada, eles deixam de participar do deploy do Apps Script. `Sidebar.html` permanece porque é usado dentro do Google Sheets.

O menu **TecnoFit > Abrir dashboard** passa a abrir a URL pública do GitHub Pages. O `doGet()` atual deixa de servir o dashboard; poderá devolver uma página simples de diagnóstico do backend, sem informações operacionais.

## Contrato da API

O frontend chamará somente uma função de entrada, `executarApiDashboard`, por meio da Execution API. Ela recebe um objeto simples e despacha apenas ações permitidas.

### Requisição

```js
{
  action: 'bootstrap' | 'versao' | 'salvarMutacoes' | 'analiseChurn',
  payload: {}
}
```

### Resposta de sucesso

```js
{
  ok: true,
  data: {},
  meta: {
    versao: '...',
    updatedAt: '2026-08-06T00:00:00.000Z'
  }
}
```

### Resposta de erro

```js
{
  ok: false,
  error: {
    code: 'UNAUTHORIZED' | 'VALIDATION_ERROR' | 'CONFLICT' | 'INTERNAL_ERROR',
    message: 'Mensagem curta e segura para a interface.'
  }
}
```

Mapeamento inicial:

| Ação | Fonte atual | Finalidade |
| --- | --- | --- |
| `bootstrap` | `obterBootstrapDashboard` | dados iniciais do PWA |
| `versao` | `obterVersaoDashboard` | verificar atualização em segundo plano |
| `salvarMutacoes` | `salvarMutacoesDashboard` | Leads, Churns e configurações |
| `analiseChurn` | `obterAnaliseChurnsDashboard` | gráficos e diagnósticos de churn |

O backend mantém suas validações, lock e proteção de dados atuais. A lista branca rejeita ações fora do contrato do PWA; a importação seguirá sendo disparada exclusivamente pelo menu e pelo painel da planilha nesta fase.

## Cache, fila e instalação

### Cache estático

O service worker faz cache somente do shell do aplicativo: HTML, CSS, JavaScript, logo, fontes e ícones versionados. Assim, o PWA abre rapidamente e pode ser instalado com `display: standalone`.

### Cache de dados

- Dados do dashboard serão guardados em IndexedDB, separados pelo identificador da conta autenticada.
- O cache terá validade máxima de 24 horas e será usado para desenhar a interface enquanto uma leitura nova é solicitada.
- A resposta do backend substitui o cache quando sua versão for mais recente.
- Dados de uma conta não aparecem após logout ou troca de conta.
- Respostas da API não entram no cache do service worker.

### Fila de mutações

A fila atual será preservada e isolada por conta. Ao criar ou editar Lead/Churn/configuração:

1. A interface atualiza imediatamente.
2. A alteração entra na fila local com identificador idempotente.
3. As alterações são enviadas em ordem para `salvarMutacoes`.
4. Em sucesso, o PWA confirma e agenda sincronização leve.
5. Em falha temporária, conserva a fila e exibe `Tentar novamente`.
6. Em erro de autorização ou validação, reverte a alteração otimista e explica o motivo.

## Automação de publicação

### GitHub Pages

`deploy-pages.yml` será executado quando houver alteração em `pwa/**` na `main` e também manualmente. Ele:

1. valida a estrutura estática do PWA;
2. gera `runtime-config.js` com variáveis públicas do GitHub;
3. publica somente `pwa/` no GitHub Pages.

### Apps Script

`deploy-apps-script.yml` será executado quando houver alteração em `apps-script/**` na `main` e também manualmente. Ele:

1. instala a versão fixa do `clasp`;
2. autentica com uma credencial de automação guardada nos GitHub Secrets;
3. envia os arquivos do backend ao mesmo projeto Apps Script;
4. cria uma nova versão e atualiza a implantação API Executable;
5. falha visivelmente se o envio ou a implantação não concluírem.

### Configuração única fora do código

1. Criar ou associar um projeto Google Cloud padrão ao Apps Script.
2. Ativar Apps Script API e criar credenciais OAuth para aplicativo web.
3. Registrar a origem do GitHub Pages nas origens JavaScript autorizadas.
4. Criar a implantação Apps Script do tipo API Executable.
5. Adicionar as contas autorizadas como usuários permitidos/teste.
6. Guardar as credenciais de automação do `clasp` como GitHub Secrets.
7. Configurar no GitHub Pages a publicação por GitHub Actions.
8. Registrar URL do Pages no `CONFIG` do Apps Script para o menu abrir o PWA.

Nenhuma senha ou token será salvo em arquivo do repositório.

## Testes e aceite

### Automáticos

- Testes atuais do backend continuam passando.
- Testes novos cobrem o roteador da API: ação válida, ação não permitida, payload inválido e resposta sem dados pessoais desnecessários.
- Testes do PWA cobrem sessão sem token, acesso recusado, bootstrap, cache por conta, logout, retry da fila e descarte de cache vencido.
- Workflow valida que a configuração pública não contém segredo.

### Manuais

1. Abrir a URL GitHub Pages em aba anônima: deve pedir conta Google.
2. Abrir com conta não autorizada: deve negar acesso sem mostrar dados.
3. Abrir com cada conta autorizada: deve carregar dashboard e permitir operações definidas.
4. Instalar no Android/iOS compatível: abre em modo standalone, sem a barra do Apps Script.
5. Criar e editar um Lead: atualização deve ser imediata e sobreviver à sincronização.
6. Publicar uma alteração de `pwa/`: somente Pages deve atualizar.
7. Publicar uma alteração de `apps-script/`: somente backend/API Executable deve atualizar.
8. Acionar importação pelo painel da planilha: os dados devem aparecer no PWA após a verificação de versão.

## Fora de escopo desta fase

- Perfis distintos de permissão dentro do PWA.
- Recuperação de senha ou autenticação não-Google.
- Mudança da base de dados de Google Sheets para outro banco.
- Integração com um backend externo como Vercel, Firebase ou Cloudflare.
- Dashboard público ou acesso anônimo.
