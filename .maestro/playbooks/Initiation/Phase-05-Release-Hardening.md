# Phase 05: Release Hardening

This phase prepares the manager dashboard improvements for regular operational use. It adds lightweight smoke tests, improves accessibility and empty/error states, verifies responsive behavior, and leaves the final execution handoff concise and actionable.

## Tasks

- [ ] Inspect the completed dashboard stack before editing:
  - Read `Appscript/AgendaCore.gs`, `Appscript/Code.gs`, `Appscript/Index.html`, `Appscript/Script.html`, `Appscript/Styles.html`, `package.json`, `tests/agendaCore.test.js`, and the preview builder from Phase 01
  - Search for the full manager feature surface with `rg -n "dashboard|reports|capacity|operational|drilldown|preview|CONFIG|Relatórios|Alertas" Appscript tests package.json`
  - Run `npm test` and `npm run preview` if available to confirm the baseline

- [ ] Add a lightweight preview smoke test:
  - Create `tests/previewSmoke.test.js` using only Node built-ins unless the project already has a browser test dependency
  - Have the test run or import the preview builder if possible, then read the generated preview HTML
  - Assert the preview contains the main app shell, `Dashboard`, `Relatórios`, `Mapa de Calor`, `Agenda`, `Professores`, `Alunos`, the student drawer, and the frontend script
  - Assert the preview does not contain unresolved Apps Script include tags such as `<?!= include`
  - Assert the preview contains demo data sufficient to render without `google.script.run`
  - Add an npm script such as `"test:preview": "node tests/previewSmoke.test.js"`

- [ ] Run the new preview smoke test and fix the preview builder or test until it passes:
  - Run `npm run preview` first if the smoke test does not build automatically
  - Run `npm run test:preview`
  - Fix only preview-generation or smoke-test issues; do not weaken assertions to hide broken output
  - Ensure `npm test` still passes afterward

- [ ] Improve tab and modal accessibility in `Appscript/Index.html` and `Appscript/Script.html`:
  - Add appropriate `role="tablist"`, `role="tab"`, `aria-selected`, and `aria-controls` attributes to the subtab navigation and active view
  - Update tab click rendering so `aria-selected` tracks `state.activeTab`
  - Ensure the heat slot modal, dashboard drilldowns, and student drawer have useful accessible labels
  - Add Escape-key handling to close the heat slot modal and student drawer when they are open
  - Preserve all existing click behavior and drawer save behavior

- [ ] Improve loading, error, and empty states across manager views:
  - Add clear loading copy while agenda data and settings load
  - Improve `renderError()` so it includes the failed action and a visible retry button wired to `loadData()`
  - Ensure dashboard, reports, heatmap, agenda, teachers, and students each show useful empty states when filters remove all data
  - Keep text concise and operational, aimed at managers using the app during routine work

- [ ] Polish responsive behavior in `Appscript/Styles.html`:
  - Audit existing media queries and add any missing rules for dashboard cards, report tables, drilldowns, settings panels, heatmap grids, and student rows
  - Ensure text wraps within cards, buttons, chips, table cells, and modal rows without overlapping
  - Keep fixed-format controls stable with explicit grid tracks, min/max widths, or overflow containers
  - Preserve the existing visual identity and avoid unrelated color or layout redesigns

- [ ] Run the full verification suite and fix failures:
  - Run `npm test`
  - Run `npm run preview` if available
  - Run `npm run test:preview` if the script exists
  - Open the generated preview HTML and manually check desktop and mobile widths for dashboard, reports, heatmap, agenda, teachers, students, drawer, and modal behavior
  - Fix any regression found during verification and rerun the relevant checks

- [ ] Prepare the final execution handoff:
  - Summarize changed files, test commands run, and any remaining deployment steps in the final Auto Run response
  - Mention whether Apps Script deployment was verified or only the local preview was verified
  - Do not create extra summary files outside the structured docs already requested in Phase 04
