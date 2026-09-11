# Polimento Visual do Dashboard XSTEAM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar uma camada visual XSTEAM premium ao PWA, usando a logo oficial e preservando integralmente o comportamento do dashboard.

**Architecture:** A interface continuará como HTML Service sem framework: `DashboardComponents.html` define a estrutura semântica, `DashboardStyles.html` fornece o design system responsivo e `DashboardClient.html` apenas acrescenta classes/ícones de apresentação quando necessário. A API Apps Script, dados, cache, filtros e fila de gravações não serão modificados.

**Tech Stack:** Google Apps Script HTML Service, HTML, CSS, SVG local, JavaScript ES5/V8 e `node --test`.

## Global Constraints

- Usar somente a pasta e branch `main` existentes; não criar worktree.
- Não alterar regras de métricas, dados, filtros, cache local, fila de mutações ou abas do Sheets.
- Não introduzir fontes, bibliotecas de ícones, imagens de fundo ou dependências remotas novas.
- Usar `apps-script/XsteamLogo.html` como símbolo SVG incluído no template do PWA.
- Manter contraste, foco de teclado, estados semânticos e `prefers-reduced-motion`.
- Cada tarefa segue TDD e termina com um commit.

---

### Task 1: Adicionar a marca oficial e contratos de UI verificáveis

**Files:**
- Create: `apps-script/XsteamLogo.html`
- Modify: `apps-script/DashboardComponents.html`
- Modify: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: arquivo recebido em `/home/elohimlima/Downloads/User attachment.svg`.
- Produces: símbolo SVG `#xsteam-logo-symbol`, incluído uma vez pelo template e usado três vezes por elementos com `class="brand-logo"`.

- [ ] **Step 1: Escrever o teste que falha**

Em `tests/dashboard-html.test.js`, adicionar:

```javascript
test('shell usa a logo oficial XSTEAM em todas as áreas de marca', () => {
  const html = fs.readFileSync('apps-script/DashboardComponents.html', 'utf8');
  const page = fs.readFileSync('apps-script/Dashboard.html', 'utf8');
  const logo = fs.readFileSync('apps-script/XsteamLogo.html', 'utf8');
  const logoUses = html.match(/href="#xsteam-logo-symbol"/g) || [];
  assert.equal(logoUses.length, 3);
  assert.match(page, /incluirArquivo_\('XsteamLogo'\)/);
  assert.match(logo, /<symbol id="xsteam-logo-symbol"/);
  assert.match(html, /class="brand-logo brand-logo-splash"/);
  assert.match(html, /class="brand-logo brand-logo-sidebar"/);
  assert.match(html, /class="brand-logo brand-logo-mobile"/);
});
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `node --test tests/dashboard-html.test.js`

Expected: FAIL porque `XsteamLogo.html` ainda não existe, o template não o inclui e o componente ainda usa `.x-mark`.

- [ ] **Step 3: Implementar a marca mínima**

Copiar o SVG fornecido para `apps-script/XsteamLogo.html`, dentro de um `<symbol id="xsteam-logo-symbol">`. Incluir o fragmento em `Dashboard.html` com `<?!= incluirArquivo_('XsteamLogo'); ?>`. Em `DashboardComponents.html`, substituir os três usos de `.x-mark` por:

```html
<svg class="brand-logo brand-logo-splash" role="img" aria-label="XSTEAM"><use href="#xsteam-logo-symbol"></use></svg>
<svg class="brand-logo brand-logo-sidebar" role="img" aria-label="XSTEAM"><use href="#xsteam-logo-symbol"></use></svg>
<svg class="brand-logo brand-logo-mobile" aria-hidden="true"><use href="#xsteam-logo-symbol"></use></svg>
```

O item mobile ficará no dock e terá `aria-hidden="true"`; os botões continuam com texto para nome acessível.

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `node --test tests/dashboard-html.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps-script/XsteamLogo.html apps-script/Dashboard.html apps-script/DashboardComponents.html tests/dashboard-html.test.js
git commit -m "feat: use official xsteam dashboard logo"
```

### Task 2: Aplicar sistema visual responsivo de superfícies e navegação

**Files:**
- Modify: `apps-script/DashboardStyles.html`
- Modify: `apps-script/DashboardComponents.html`
- Modify: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: classes existentes `.app-shell`, `.desktop-sidebar`, `.topbar`, `.global-filters`, `.kpi`, `.section-card`, `.subnav`, `.mobile-dock`, `.detail-dialog`, `.loading-screen`.
- Produces: tokens CSS de superfície/raio/sombra, navegação com estados visíveis, cards confortáveis e layout desktop/mobile sem rolagem horizontal.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `tests/dashboard-html.test.js`:

```javascript
test('tema premium define superfícies, foco e adaptação de movimento', () => {
  const css = fs.readFileSync('apps-script/DashboardStyles.html', 'utf8');
  assert.match(css, /--radius-card:\s*16px/);
  assert.match(css, /--shadow-card:/);
  assert.match(css, /background:\s*radial-gradient/);
  assert.match(css, /\.nav-button:focus-visible/);
  assert.match(css, /\.kpi:hover/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.mobile-dock[^}]*border-radius:/s);
});
```

- [ ] **Step 2: Rodar o teste para confirmar a falha**

Run: `node --test tests/dashboard-html.test.js`

Expected: FAIL porque os tokens, estado de foco, gradiente de superfície e regra de redução de movimento ainda não existem.

- [ ] **Step 3: Implementar o design system mínimo e completo**

Reescrever `apps-script/DashboardStyles.html` preservando os seletores consumidos por `DashboardClient.html` e acrescentando:

```css
:root {
  --radius-card: 16px;
  --shadow-card: 0 18px 45px rgba(0, 0, 0, .22);
}
body {
  background: radial-gradient(circle at 82% -10%, rgba(223, 255, 34, .12), transparent 28rem), #080a0a;
}
.nav-button:focus-visible, .dock-button:focus-visible, .kpi:focus-visible {
  outline: 2px solid var(--lime);
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; }
}
```

Aplicar sombras curtas, superfícies translúcidas, raio consistente, hierarquia tipográfica, filtros em uma barra de contexto e navegação desktop/mobile conforme a especificação. Não mudar nomes, IDs ou eventos do JavaScript.

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `node --test tests/dashboard-html.test.js`

Expected: PASS.

- [ ] **Step 5: Rodar a suíte completa**

Run: `npm test`

Expected: todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add apps-script/DashboardStyles.html apps-script/DashboardComponents.html tests/dashboard-html.test.js
git commit -m "feat: polish xsteam dashboard visual system"
```

### Task 3: Validar sintaxe do cliente e documentar o acabamento

**Files:**
- Modify: `apps-script/DashboardClient.html` somente se a marca mobile exigir uma classe semântica adicional; caso contrário, não alterar.
- Modify: `CONTEXTO_DO_PROJETO.md`
- Test: `tests/dashboard-html.test.js`

**Interfaces:**
- Consumes: shell estilizado das tarefas 1 e 2.
- Produces: registro portátil do novo ativo, regra de estilo e procedimento de implantação sem mudança de comportamento.

- [ ] **Step 1: Escrever o teste que falha se o cliente passar a criar markup incompatível**

Adicionar a seguinte garantia ao teste existente do cliente:

```javascript
assert.doesNotMatch(client, /\.x-mark/);
```

- [ ] **Step 2: Rodar o teste para confirmar a falha ou o estado já atendido**

Run: `node --test tests/dashboard-html.test.js`

Expected: PASS se `DashboardClient.html` não mencionar a antiga marca; se falhar, remover somente essa referência obsoleta sem mudar lógica.

- [ ] **Step 3: Validar a sintaxe JavaScript real**

Run:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('apps-script/DashboardClient.html','utf8').replace(/^<script>\\s*/,'').replace(/\\s*<\\/script>\\s*$/,''); new Function(s);"
```

Expected: comando encerra com código 0.

- [ ] **Step 4: Atualizar contexto e validar tudo**

Adicionar ao `CONTEXTO_DO_PROJETO.md` que a logo é `apps-script/XsteamLogo.svg`, que o dashboard usa o sistema visual XSTEAM premium e que os arquivos atualizados devem ser copiados e implantados como nova versão do Web App.

Run: `npm test`

Expected: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add CONTEXTO_DO_PROJETO.md apps-script/DashboardClient.html tests/dashboard-html.test.js
git commit -m "docs: record xsteam dashboard visual system"
```
