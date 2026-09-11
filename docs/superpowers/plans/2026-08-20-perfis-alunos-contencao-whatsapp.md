# Student Profiles Collapsible Section, Containment, and WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the student-profiles block start collapsed on every Home render, keep every card inside its grid cell, and add a safe WhatsApp shortcut beside valid student phone numbers.

**Architecture:** Keep the feature inside the existing `XSteamStudentProfiles` module. Add two small exported helpers—one for Brazilian WhatsApp URLs and one for accessible expanded state—then wire them into the existing dialog and section renderer. CSS owns containment and presentation; the service worker cache version distributes the changed static files.

**Tech Stack:** Vanilla JavaScript UMD module, semantic HTML generated with DOM APIs, CSS Grid/Flexbox, native `<dialog>`, Node.js `node:test`, PWA service worker.

## Global Constraints

- The profile section always starts collapsed whenever Home is rendered; do not persist expansion in `localStorage` or Google Sheets.
- Keep the current responsive grid at four desktop columns, two intermediate columns, and one mobile column.
- Show the WhatsApp shortcut only beside the phone in the **Informações** tab, never on Home cards.
- Use `https://wa.me/<numero>`, add `55` only to Brazilian 10/11-digit numbers, preserve valid 12/13-digit numbers already starting with `55`, and hide the shortcut for invalid values.
- Open WhatsApp in a new tab with `rel="noopener noreferrer"` and an accessible label containing the student's name.
- Do not change the spreadsheet schema, Apps Script contract, profile persistence, or stored phone number.
- Follow red-green-refactor for every behavior change and keep unrelated untracked files untouched.

---

### Task 1: Safe WhatsApp URL and contact action

**Files:**
- Modify: `tests/student-profiles.test.js`
- Modify: `pwa/js/student-profiles.js:1-230`
- Modify: `pwa/css/student-profiles.css:45-65`

**Interfaces:**
- Consumes: `card.contato: string`, `card.aluno: string`, existing `uiElement()` and DOM document.
- Produces: `whatsappUrl(value: unknown): string`, returning a complete `https://wa.me/...` URL or `''`; `contactInfoItem(doc, card): HTMLElement` for the dialog information grid.

- [ ] **Step 1: Write the failing URL-normalization test**

Append to `tests/student-profiles.test.js`:

```js
test('gera WhatsApp somente para telefones brasileiros válidos sem duplicar o DDI', () => {
  assert.equal(
    profiles.whatsappUrl('(85) 98840-0309'),
    'https://wa.me/5585988400309'
  );
  assert.equal(
    profiles.whatsappUrl('+55 (85) 98840-0309'),
    'https://wa.me/5585988400309'
  );
  assert.equal(profiles.whatsappUrl('9884-0309'), '');
  assert.equal(profiles.whatsappUrl(''), '');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="gera WhatsApp" tests/student-profiles.test.js`

Expected: FAIL with `profiles.whatsappUrl is not a function`.

- [ ] **Step 3: Implement the minimal phone normalizer**

Add near `normalize()` in `pwa/js/student-profiles.js`:

```js
function whatsappUrl(value) {
  var digits = String(value == null ? '' : value).replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
  if (!/^55\d{10,11}$/.test(digits)) return '';
  return 'https://wa.me/' + digits;
}
```

Expose `whatsappUrl` in the module's returned API.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test --test-name-pattern="gera WhatsApp" tests/student-profiles.test.js`

Expected: PASS, 1 matching test and no failures.

- [ ] **Step 5: Write the failing structural test for the dialog action**

Append to `tests/student-profiles.test.js` and add `const fs = require('node:fs');` at the top:

```js
test('contato do perfil oferece ação acessível e segura de WhatsApp', () => {
  const client = fs.readFileSync('pwa/js/student-profiles.js', 'utf8');
  assert.match(client, /function contactInfoItem\(doc, card\)/);
  assert.match(client, /target\s*=\s*'_blank'/);
  assert.match(client, /rel\s*=\s*'noopener noreferrer'/);
  assert.match(client, /Abrir WhatsApp com/);
  assert.match(client, /student-profile-contact-value/);
});
```

- [ ] **Step 6: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="contato do perfil" tests/student-profiles.test.js`

Expected: FAIL because `contactInfoItem` and its accessible link are absent.

- [ ] **Step 7: Render the contact row and WhatsApp icon without HTML injection**

Add these helpers beside `infoItem()` in `pwa/js/student-profiles.js`:

```js
function whatsappIcon(doc) {
  var ns = 'http://www.w3.org/2000/svg';
  var svg = doc.createElementNS(ns, 'svg');
  var bubble = doc.createElementNS(ns, 'path');
  var phone = doc.createElementNS(ns, 'path');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  bubble.setAttribute('d', 'M20.5 11.5a8.4 8.4 0 0 1-11.9 7.6L3.5 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.5Z');
  phone.setAttribute('d', 'M9.2 7.5c.2-.5.5-.6.9-.4l1.2.6c.3.2.4.5.3.8l-.5 1.1c.7 1.4 1.8 2.5 3.2 3.2l1.1-.5c.3-.1.6 0 .8.3l.6 1.2c.2.4.1.7-.4.9-.6.3-1.3.4-2 .2-3.4-.9-6-3.5-6.9-6.9-.2-.7-.1-1.4.2-2.1Z');
  svg.appendChild(bubble);
  svg.appendChild(phone);
  return svg;
}

function contactInfoItem(doc, card) {
  var item = uiElement(doc, 'div', 'student-profile-info-item');
  var value = uiElement(doc, 'dd', 'student-profile-contact-value');
  var url = whatsappUrl(card.contato);
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

In `openProfileDialog()`, remove `['Contato', card.contato]` from the generic array and append `contactInfoItem(doc, card)` before the remaining information items.

Add to `pwa/css/student-profiles.css`:

```css
.student-profile-contact-value {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.student-profile-contact-value > span { min-width: 0; overflow-wrap: anywhere; }
.student-profile-contact-value .whatsapp-button { flex: 0 0 38px; }
```

- [ ] **Step 8: Run the feature tests and verify GREEN**

Run: `node --test tests/student-profiles.test.js`

Expected: all student-profile tests PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add tests/student-profiles.test.js pwa/js/student-profiles.js pwa/css/student-profiles.css
git commit -m "feat: add WhatsApp shortcut to student profiles"
```

---

### Task 2: Accessible section that always starts collapsed

**Files:**
- Modify: `tests/student-profiles.test.js`
- Modify: `pwa/js/student-profiles.js:230-480`
- Modify: `pwa/css/student-profiles.css:1-25,105-113`

**Interfaces:**
- Consumes: a toggle element with `setAttribute()` and `classList.toggle()`, plus a panel element with `hidden`.
- Produces: `setProfilesExpanded(toggle, panel, expanded): void`; a `renderSection()` whose panel starts with `hidden === true` on every call.

- [ ] **Step 1: Write the failing expanded-state test**

Append to `tests/student-profiles.test.js`:

```js
test('perfis começam recolhidos e o controle anuncia os dois estados', () => {
  const attributes = {};
  const classes = new Set();
  const toggle = {
    setAttribute(name, value) { attributes[name] = String(value); },
    classList: {
      toggle(name, active) {
        if (active) classes.add(name);
        else classes.delete(name);
      }
    }
  };
  const panel = { hidden: false };

  profiles.setProfilesExpanded(toggle, panel, false);
  assert.equal(panel.hidden, true);
  assert.equal(attributes['aria-expanded'], 'false');
  assert.equal(attributes['aria-label'], 'Expandir perfis dos alunos');
  assert.equal(classes.has('is-expanded'), false);

  profiles.setProfilesExpanded(toggle, panel, true);
  assert.equal(panel.hidden, false);
  assert.equal(attributes['aria-expanded'], 'true');
  assert.equal(attributes['aria-label'], 'Recolher perfis dos alunos');
  assert.equal(classes.has('is-expanded'), true);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="perfis começam recolhidos" tests/student-profiles.test.js`

Expected: FAIL with `profiles.setProfilesExpanded is not a function`.

- [ ] **Step 3: Implement the accessible state helper**

Add before `renderSection()` and export it from the module:

```js
function setProfilesExpanded(toggle, panel, expanded) {
  var open = expanded === true;
  panel.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute(
    'aria-label',
    open ? 'Recolher perfis dos alunos' : 'Expandir perfis dos alunos'
  );
  toggle.classList.toggle('is-expanded', open);
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test --test-name-pattern="perfis começam recolhidos" tests/student-profiles.test.js`

Expected: PASS.

- [ ] **Step 5: Write the failing wiring test**

Append to `tests/student-profiles.test.js`:

```js
test('seção liga o botão retrátil ao painel sem persistir preferência', () => {
  const client = fs.readFileSync('pwa/js/student-profiles.js', 'utf8');
  assert.match(client, /student-profiles-collapse/);
  assert.match(client, /student-profiles-content/);
  assert.match(client, /aria-controls/);
  assert.match(client, /setProfilesExpanded\(toggle, content, false\)/);
  assert.doesNotMatch(client, /localStorage/);
});
```

- [ ] **Step 6: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="seção liga" tests/student-profiles.test.js`

Expected: FAIL because the collapse button and controlled content are absent.

- [ ] **Step 7: Restructure `renderSection()` around a controlled panel**

Replace the search placement in the heading with a collapse button and move all variable content into the controlled panel:

```js
var panelId = 'student-profiles-content';
var toggle = uiElement(doc, 'button', 'student-profiles-collapse');
var toggleIcon = uiElement(doc, 'span', 'student-profiles-collapse-icon', '⌄');
toggle.type = 'button';
toggle.setAttribute('aria-controls', panelId);
toggle.appendChild(toggleIcon);
heading.appendChild(copy);
heading.appendChild(toggle);
section.appendChild(heading);

var content = uiElement(doc, 'div', 'student-profiles-content');
content.id = panelId;
var toolbar = uiElement(doc, 'div', 'student-profiles-toolbar');
toolbar.appendChild(search);
content.appendChild(toolbar);
content.appendChild(summary);
content.appendChild(grid);
content.appendChild(more);
section.appendChild(content);

toggle.addEventListener('click', function () {
  setProfilesExpanded(toggle, content, content.hidden);
});
setProfilesExpanded(toggle, content, false);
```

Keep `refresh()`, search, pagination, and card click behavior unchanged.

- [ ] **Step 8: Style the collapsed control and content**

Update `pwa/css/student-profiles.css`:

```css
.student-profiles-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.student-profiles-collapse {
  display: grid;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 12px;
  color: var(--muted-strong);
  background: rgba(255, 255, 255, .03);
}
.student-profiles-collapse:hover,
.student-profiles-collapse:focus-visible { border-color: var(--lime); color: var(--lime); }
.student-profiles-collapse-icon { font-size: 22px; line-height: 1; transition: transform var(--ease); }
.student-profiles-collapse.is-expanded .student-profiles-collapse-icon { transform: rotate(180deg); }
.student-profiles-content { display: grid; gap: 18px; }
.student-profiles-content[hidden] { display: none; }
.student-profiles-toolbar { display: flex; justify-content: flex-end; }
@media (prefers-reduced-motion: reduce) {
  .student-profiles-collapse-icon { transition: none; }
}
```

In the mobile media query, remove the old heading column layout because the search now lives in `.student-profiles-toolbar`; keep `.student-profile-search { width: 100%; }`.

- [ ] **Step 9: Run the feature tests and verify GREEN**

Run: `node --test tests/student-profiles.test.js`

Expected: all student-profile tests PASS.

- [ ] **Step 10: Commit Task 2**

```bash
git add tests/student-profiles.test.js pwa/js/student-profiles.js pwa/css/student-profiles.css
git commit -m "feat: make student profiles section collapsible"
```

---

### Task 3: Card containment, PWA cache, and end-to-end verification

**Files:**
- Modify: `tests/student-profiles.test.js`
- Modify: `tests/pwa-shell.test.js:1-25`
- Modify: `pwa/css/student-profiles.css:12-45`
- Modify: `pwa/sw.js:1`

**Interfaces:**
- Consumes: existing `.student-profile-card`, `.student-profile-card-head`, `.student-profile-name`, and `.chip` elements.
- Produces: a card whose intrinsic content cannot widen the CSS Grid column; PWA cache `xsteam-static-v5`.

- [ ] **Step 1: Write the failing CSS containment test**

Append to `tests/student-profiles.test.js`:

```js
test('cartões contêm nomes e status longos dentro de cada coluna', () => {
  const css = fs.readFileSync('pwa/css/student-profiles.css', 'utf8');
  assert.match(css, /\.student-profile-card\s*\{[^}]*min-width:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.student-profile-card-head\s*\{[^}]*min-width:\s*0[^}]*width:\s*100%/s);
  assert.match(css, /\.student-profile-card-head\s*>\s*span:first-child\s*\{[^}]*flex:\s*1\s+1\s+auto[^}]*min-width:\s*0/s);
  assert.match(css, /\.student-profile-card-head\s*>\s*\.chip\s*\{[^}]*flex:\s*0\s+0\s+auto[^}]*max-width:/s);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="cartões contêm" tests/student-profiles.test.js`

Expected: FAIL because the grid item and header do not yet define all containment guards.

- [ ] **Step 3: Apply the minimal containment rules**

Update the relevant selectors in `pwa/css/student-profiles.css`:

```css
.student-profile-card {
  min-width: 0;
  overflow: hidden;
  /* preserve all existing declarations */
}
.student-profile-card-head {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.student-profile-card-head > span:first-child { flex: 1 1 auto; min-width: 0; }
.student-profile-card-head > .chip {
  flex: 0 0 auto;
  max-width: 92px;
  overflow-wrap: anywhere;
  text-align: center;
}
.student-profile-professor { min-width: 0; overflow-wrap: anywhere; }
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test --test-name-pattern="cartões contêm" tests/student-profiles.test.js`

Expected: PASS.

- [ ] **Step 5: Write the failing cache-version test**

Change the existing assertion in `tests/pwa-shell.test.js`:

```js
assert.match(worker, /xsteam-static-v5/);
```

- [ ] **Step 6: Run the cache test and verify RED**

Run: `node --test tests/pwa-shell.test.js`

Expected: FAIL because `pwa/sw.js` still declares `xsteam-static-v4`.

- [ ] **Step 7: Increment the static cache version**

Change the first line of `pwa/sw.js` to:

```js
var CACHE_NAME = 'xsteam-static-v5';
```

- [ ] **Step 8: Run focused and complete automated verification**

Run: `node --test tests/student-profiles.test.js tests/pwa-shell.test.js`

Expected: all focused tests PASS.

Run: `npm test`

Expected: all project tests PASS with zero failures, skips, or todos.

Run: `git diff --check`

Expected: no output and exit code 0.

- [ ] **Step 9: Verify the real PWA layout in desktop and mobile browsers**

Serve `pwa/` locally on an unused port and seed a temporary, untracked bootstrap containing long student names, `Em Licença`/`Bloqueado` statuses, and a formatted phone. Verify:

1. Home opens with **Perfis dos alunos** collapsed.
2. The top-right control expands and collapses the panel, with `aria-expanded` changing between `false` and `true`.
3. No card, name, status, responsible professor, or tag crosses a grid boundary at 1440 px, 1024 px, and 390 px widths.
4. The contact row shows the WhatsApp icon beside a valid number and its `href` is `https://wa.me/5585988400309`.
5. A profile with invalid contact shows no WhatsApp link.
6. The dialog and sticky mobile actions remain usable at 390 × 844.

Remove all temporary preview files after screenshots and confirm `git status --short` contains only intended tracked changes.

- [ ] **Step 10: Commit Task 3**

```bash
git add tests/student-profiles.test.js tests/pwa-shell.test.js pwa/css/student-profiles.css pwa/sw.js
git commit -m "fix: contain student profile cards in responsive grid"
```

- [ ] **Step 11: Final branch verification**

Run: `npm test`

Expected: full suite PASS with zero failures.

Run: `git diff --check`

Expected: no output.

Run: `git status --short --branch`

Expected: clean `fix/student-profile-card-whatsapp` branch.
