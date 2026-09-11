# Phase 01: Manager Dashboard Prototype

This phase adds the first working manager dashboard to the existing XSTEAM agenda app. It builds on the current Google Apps Script frontend, AgendaCore analytics, and Node test harness so managers can immediately see operational KPIs, peak slots, teacher load, and weekly demand without needing any decisions during execution.

## Tasks

- [ ] Inspect the existing project before editing:
  - Read `CONTEXTO_PROJETO.md`, `Appscript/AgendaCore.gs`, `Appscript/Script.html`, `Appscript/Index.html`, `Appscript/Styles.html`, and `tests/agendaCore.test.js`
  - Search for current tab-rendering patterns with `rg -n "activeTab|renderCurrentTab|renderKpis|renderTeachers|subtab" Appscript/Script.html Appscript/Index.html`
  - Run `npm test` to capture the current baseline before changes

- [ ] Extend `tests/agendaCore.test.js` with focused dashboard expectations before implementation:
  - Add assertions for a new pure `core.buildManagerDashboard(appData)` function
  - Verify it returns totals for students, active students, lessons, professors, occupied slots, average students per occupied slot, morning lessons, afternoon lessons, and outside-period lessons
  - Verify it identifies the busiest slot with `day`, `time`, `studentCount`, `lessonCount`, and `professorCount`
  - Verify it returns teacher load rows sorted by lesson count descending and then professor name ascending
  - Verify it returns day demand rows sorted by weekday order
  - Run `npm test` and confirm the new assertions fail because the function does not exist yet

- [ ] Implement the dashboard summary in `Appscript/AgendaCore.gs` using existing helpers instead of duplicating normalization logic:
  - Add `buildManagerDashboard(appData)` inside the `AgendaCore` module
  - Use existing lesson objects, `buildSlotOccupancy`, `getTurn`, `uniqueSorted`, `sortDays`, and `sortTimes` where applicable
  - Return a plain object with `totals`, `busiestSlot`, `teacherLoad`, `dayDemand`, and `turnDemand`
  - Keep the function pure and compatible with both Apps Script and Node tests
  - Export `buildManagerDashboard` in the module return object following the existing export pattern

- [ ] Run `npm test` and fix `AgendaCore.gs` until all dashboard and existing AgendaCore tests pass:
  - Keep all existing behavior unchanged for students, lessons, occupancy, manual updates, status normalization, day normalization, and time normalization
  - Do not edit test expectations to match incorrect implementation behavior

- [ ] Add a manager dashboard tab to the existing frontend:
  - In `Appscript/Script.html`, set `state.activeTab` to `"dashboard"` so the new dashboard is the first view managers see
  - Add `dashboard: "Dashboard"` to `tabLabels` if the labels object is still used
  - Add `dashboard: renderDashboard` to the `renderCurrentTab()` renderer map
  - In `Appscript/Index.html`, add a new first subtab button with `data-tab="dashboard"` and label `Dashboard`
  - Keep the existing `Mapa de Calor`, `Agenda`, `Professores`, and `Alunos` subtabs intact

- [ ] Implement `renderDashboard()` in `Appscript/Script.html` using existing filtered data and UI helpers:
  - Reuse `getFilteredData()`, `groupBy()`, `unique()`, `sortDays()`, `timeToMinutes()`, `escapeHtml()`, and `renderKpis()` where possible
  - Show manager-facing KPI cards for active students, weekly lessons, occupied slots, average students per occupied slot, professor count, and busiest slot
  - Show a `Carga por professor` section sorted by weekly lessons descending with unique student counts and morning/tarde counts
  - Show a `Demanda por dia` section sorted by weekday order with lesson counts and unique student counts
  - Show an `Alertas operacionais` section highlighting overloaded slots at or above capacity, empty filters, and teachers with high weekly lesson counts
  - Ensure the dashboard respects the existing status, professor, and search filters

- [ ] Update `makeDemoData()` in `Appscript/Script.html` so the fallback demo makes the new dashboard look real:
  - Include at least 6 students, 4 professors, 5 weekdays, morning and afternoon lessons, and at least one busy slot with multiple students
  - Populate `students`, `lessons`, `statuses`, `professors`, `days`, `times`, and basic `analytics.totals` consistently
  - Keep the fallback self-contained so `serverCall("getAgendaAppData")` still works outside Apps Script

- [ ] Add dashboard styling in `Appscript/Styles.html` following the existing design language:
  - Reuse current color variables, borders, cards, typography scale, and responsive grid patterns
  - Add styles for dashboard KPI grid, dashboard panels, teacher load bars, day demand rows, alert rows, and busiest slot emphasis
  - Keep cards at the existing radius scale and avoid adding decorative gradients or unrelated visual themes
  - Add responsive rules so dashboard cards and rows remain readable on mobile widths

- [ ] Create a self-contained local preview for the prototype:
  - Add a small Node script such as `tools/build-preview.js` that reads `Appscript/Index.html`, replaces `<?!= include('Styles'); ?>` and `<?!= include('Script'); ?>` with the contents of `Appscript/Styles.html` and `Appscript/Script.html`, and writes `preview/agenda-preview.html`
  - Add an npm script such as `"preview": "node tools/build-preview.js"` if `package.json` has no preview command yet
  - Keep generated preview output ignored or clearly disposable if the repository already has ignore patterns for build artifacts
  - Run `npm run preview` and confirm the generated HTML contains the dashboard tab, styles, demo-data script path, and no unprocessed Apps Script include tags

- [ ] Verify the working prototype end to end:
  - Run `npm test` and confirm it passes
  - Run `npm run preview` if that script was added
  - Open the generated preview HTML locally and confirm the `Dashboard` subtab renders with demo data
  - Confirm changing status, professor, and search filters updates dashboard totals
  - Confirm existing subtabs still render: `Mapa de Calor`, `Agenda`, `Professores`, and `Alunos`
  - Record any manual verification notes in the final Auto Run response, not in a new file
