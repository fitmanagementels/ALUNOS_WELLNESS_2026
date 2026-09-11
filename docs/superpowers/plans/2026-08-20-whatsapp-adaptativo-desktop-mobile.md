# WhatsApp Adaptativo Desktop-Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o atalho de WhatsApp do perfil abrir diretamente o WhatsApp Web/PWA no desktop e o aplicativo móvel no celular.

**Architecture:** O módulo `student-profiles.js` continuará responsável por normalizar o telefone, mas separará a seleção do destino da detecção de ambiente. Uma função pura escolhe a URL a partir do telefone e de um booleano móvel; a camada do diálogo lê o `navigator` do navegador e mantém a abertura em contexto separado. A mudança de JavaScript recebe uma nova versão de cache para evitar que usuários de PWA permaneçam com o atalho anterior.

**Tech Stack:** JavaScript ES5/DOM, Node.js test runner (`node:test`), CSS existente, service worker estático.

## Global Constraints

- Desktop: usar exatamente `https://web.whatsapp.com/send?phone=<telefone>`.
- Celular ou tablet móvel: usar exatamente `https://wa.me/<telefone>`.
- Manter o ícone, o texto alternativo, `target="_blank"` e `rel="noopener noreferrer"` já existentes.
- Telefones brasileiros válidos têm 10 ou 11 dígitos locais, ou 12/13 dígitos iniciados por `55`; valores inválidos não geram link.
- Detectar mobilidade primeiro por `navigator.userAgentData.mobile`, com fallback pelo `navigator.userAgent`; ausência de evidência móvel é desktop.
- Não alterar Apps Script, planilha, Worker, contratos de API nem a estrutura visual do diálogo.
- Incrementar o cache de `xsteam-static-v5` para `xsteam-static-v6`.

---

## File Structure

- `pwa/js/student-profiles.js`: normalização do telefone, seleção desktop/móvel e criação do link do contato.
- `tests/student-profiles.test.js`: testes unitários das URLs e da detecção de mobilidade; inspeção estrutural do uso do navegador pelo diálogo.
- `pwa/sw.js`: nova versão de cache estático do PWA.
- `tests/pwa-shell.test.js`: expectativa da versão do cache no shell.
- `pwa/preview-profile-audit.html`: fixture temporária de inspeção no navegador; criar para a auditoria e remover antes do commit.

### Task 1: Roteamento adaptativo e link do contato

**Files:**

- Modify: `pwa/js/student-profiles.js:9-15, 209-226, 294-305, 462-475`
- Modify: `tests/student-profiles.test.js:5-28`

**Interfaces:**

- Consumes: `card.contato`, `card.aluno`, `options.navigator` opcional e `window.navigator` no navegador.
- Produces: `whatsappUrl(value, mobile) -> string`, `isMobileDevice(navigatorRef) -> boolean` e `contactInfoItem(doc, card, navigatorRef) -> HTMLElement`.

- [ ] **Step 1: Escrever os testes que falham para os dois destinos e a detecção de mobilidade**

Substituir o primeiro teste de WhatsApp e adicionar o teste de ambiente em `tests/student-profiles.test.js`:

```js
test('gera a rota direta do WhatsApp Web no desktop e wa.me no celular', () => {
  assert.equal(
    profiles.whatsappUrl('(85) 98840-0309', false),
    'https://web.whatsapp.com/send?phone=5585988400309'
  );
  assert.equal(
    profiles.whatsappUrl('+55 (85) 98840-0309', true),
    'https://wa.me/5585988400309'
  );
  assert.equal(profiles.whatsappUrl('9884-0309', false), '');
  assert.equal(profiles.whatsappUrl('', true), '');
});

test('detecta celular por User-Agent Client Hints e por fallback de user agent', () => {
  assert.equal(profiles.isMobileDevice({ userAgentData: { mobile: true } }), true);
  assert.equal(profiles.isMobileDevice({ userAgentData: { mobile: false } }), false);
  assert.equal(profiles.isMobileDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' }), true);
  assert.equal(profiles.isMobileDevice({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }), false);
  assert.equal(profiles.isMobileDevice(null), false);
});
```

Atualizar o teste estrutural para exigir que o link use a detecção e receba o `navigatorRef`:

```js
assert.match(client, /function contactInfoItem\(doc, card, navigatorRef\)/);
assert.match(client, /whatsappUrl\(card\.contato, isMobileDevice\(navigatorRef\)\)/);
assert.match(client, /options\.navigator \|\| \(typeof navigator !== 'undefined' \? navigator : null\)/);
```

- [ ] **Step 2: Executar o arquivo de teste e confirmar a falha**

Run: `node --test tests/student-profiles.test.js`

Expected: FAIL porque a assinatura atual de `whatsappUrl` ainda devolve `wa.me` para desktop e `isMobileDevice` ainda não existe.

- [ ] **Step 3: Implementar o menor código que satisfaz os testes**

Em `pwa/js/student-profiles.js`, substituir a função atual e adicionar a detecção imediatamente após ela:

```js
function whatsappUrl(value, mobile) {
  var digits = String(value == null ? '' : value).replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
  if (!/^55\d{10,11}$/.test(digits)) return '';
  return mobile
    ? 'https://wa.me/' + digits
    : 'https://web.whatsapp.com/send?phone=' + digits;
}

function isMobileDevice(navigatorRef) {
  if (!navigatorRef) return false;
  if (navigatorRef.userAgentData && typeof navigatorRef.userAgentData.mobile === 'boolean') {
    return navigatorRef.userAgentData.mobile;
  }
  return /Android|iPhone|iPad|iPod|Mobile/i.test(String(navigatorRef.userAgent || ''));
}
```

Trocar a assinatura e a URL em `contactInfoItem`:

```js
function contactInfoItem(doc, card, navigatorRef) {
  var item = uiElement(doc, 'div', 'student-profile-info-item');
  var value = uiElement(doc, 'dd', 'student-profile-contact-value');
  var url = whatsappUrl(card.contato, isMobileDevice(navigatorRef));
  item.appendChild(uiElement(doc, 'dt', '', 'Contato'));
  value.appendChild(uiElement(doc, 'span', '', displayValue(card.contato)));
  if (url) {
    var link = uiElement(doc, 'a', 'whatsapp-button');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Abrir WhatsApp com ' + card.aluno);
    link.appendChild(whatsappIcon(doc));
    value.appendChild(link);
  }
  item.appendChild(value);
  return item;
}
```

No diálogo, passar uma referência testável e segura ao contato:

```js
var navigatorRef = options.navigator || (typeof navigator !== 'undefined' ? navigator : null);
infoGrid.appendChild(contactInfoItem(doc, card, navigatorRef));
```

Exportar a nova função junto às demais funções públicas:

```js
whatsappUrl: whatsappUrl,
isMobileDevice: isMobileDevice,
selectPrimaryContract: selectPrimaryContract,
```

- [ ] **Step 4: Executar os testes focados e confirmar a aprovação**

Run: `node --test tests/student-profiles.test.js`

Expected: PASS, incluindo os testes de URL desktop, URL móvel, telefones inválidos e fallback do user agent.

- [ ] **Step 5: Commitar a lógica e os testes**

```bash
git add pwa/js/student-profiles.js tests/student-profiles.test.js
git commit -m "fix: route WhatsApp by device type"
```

### Task 2: Invalidar o cache e validar a publicação do PWA

**Files:**

- Modify: `pwa/sw.js:1`
- Modify: `tests/pwa-shell.test.js:18`
- Create then delete: `pwa/preview-profile-audit.html`

**Interfaces:**

- Consumes: versão do cache estático atual `xsteam-static-v5`.
- Produces: service worker identificado por `xsteam-static-v6`, garantindo download do novo `student-profiles.js`.

- [ ] **Step 1: Atualizar o teste do shell para a nova versão de cache**

Em `tests/pwa-shell.test.js`, alterar somente a expectativa:

```js
assert.match(worker, /xsteam-static-v6/);
```

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `node --test tests/pwa-shell.test.js`

Expected: FAIL porque `pwa/sw.js` ainda declara `xsteam-static-v5`.

- [ ] **Step 3: Incrementar o cache do service worker**

Em `pwa/sw.js`, alterar somente a primeira linha:

```js
var CACHE_NAME = 'xsteam-static-v6';
```

- [ ] **Step 4: Executar os testes focados e a suíte completa**

Run: `node --test tests/pwa-shell.test.js && npm test`

Expected: ambos os comandos terminam com código `0`; a suíte completa mantém todos os testes aprovados.

- [ ] **Step 5: Criar a fixture temporária de auditoria do navegador**

Criar `pwa/preview-profile-audit.html` com este conteúdo e não incluí-lo no commit:

```html
<!doctype html>
<html lang="pt-BR">
  <meta charset="utf-8">
  <title>Auditoria WhatsApp</title>
  <script src="./js/student-profiles.js"></script>
  <script>
    (function () {
      var params = new URLSearchParams(location.search);
      var mobile = params.get('mobile') === '1';
      var invalid = params.get('invalid') === '1';
      var card = {
        id: '42', aluno: 'ALUNO DE TESTE',
        contato: invalid ? '9884-0309' : '(85) 98840-0309', status: 'Ativo',
        dataFicha: '', dataAvaliacao: '', contratos: [], contratoPrincipal: null,
        perfil: {
          professorResponsavel: '', perfilPagamento: 'Sem histórico',
          observacaoPagamento: '', etiquetasPublico: [],
          etiquetasComerciais: [], observacoesGerais: ''
        }
      };
      XSteamStudentProfiles.openProfileDialog(card, {
        document: document,
        navigator: {
          userAgentData: { mobile: mobile },
          userAgent: mobile ? 'Mozilla/5.0 (Linux; Android 14)' : 'Mozilla/5.0 (X11; Linux x86_64)'
        },
        bootstrap: { catalogoPerfisAlunos: [] },
        onSave: function () {}
      });
    }());
  </script>
</html>
```

- [ ] **Step 6: Inspecionar desktop, celular e telefone inválido no navegador**

Em um terminal, iniciar o servidor local:

```bash
python3 -m http.server 4175 --directory pwa
```

Em outro terminal, executar as três inspeções:

```bash
npx --yes agent-browser --session whatsapp-routing open 'http://127.0.0.1:4175/preview-profile-audit.html?mobile=0'
npx --yes agent-browser --session whatsapp-routing eval "document.querySelector('.whatsapp-button').href"
npx --yes agent-browser --session whatsapp-routing open 'http://127.0.0.1:4175/preview-profile-audit.html?mobile=1'
npx --yes agent-browser --session whatsapp-routing eval "document.querySelector('.whatsapp-button').href"
npx --yes agent-browser --session whatsapp-routing open 'http://127.0.0.1:4175/preview-profile-audit.html?mobile=0&invalid=1'
npx --yes agent-browser --session whatsapp-routing eval "document.querySelectorAll('.whatsapp-button').length"
```

Expected: os retornos são, nesta ordem, `https://web.whatsapp.com/send?phone=5585988400309`, `https://wa.me/5585988400309` e `0`. Nas duas páginas com telefone válido, confirmar também `target="_blank"` e `rel="noopener noreferrer"` no elemento `.whatsapp-button`.

- [ ] **Step 7: Remover a fixture e encerrar a sessão de auditoria**

```bash
rm pwa/preview-profile-audit.html
npx --yes agent-browser --session whatsapp-routing close
```

Expected: `git status --short` não lista `pwa/preview-profile-audit.html`.

- [ ] **Step 8: Commitar a invalidação de cache**

```bash
git add pwa/sw.js tests/pwa-shell.test.js
git commit -m "fix: refresh PWA cache for WhatsApp routing"
```

## Final Verification

- [ ] Run: `git diff --check main..HEAD`
- [ ] Run: `npm test`
- [ ] Confirmar que não há alteração em `apps-script/`, `worker/` nem nos contratos da planilha.
- [ ] Após integração e push na `main`, acompanhar o workflow “Deploy PWA” e confirmar no GitHub Pages: `sw.js` contém `xsteam-static-v6`, `student-profiles.js` contém `web.whatsapp.com/send?phone=`, e o ícone desktop não usa `wa.me`.
