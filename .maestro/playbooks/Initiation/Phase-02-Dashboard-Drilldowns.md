# Phase 02: Dashboard Drilldowns

This phase turns the dashboard from a summary into an action surface for managers. It adds operational alerts, drilldowns for risky slots and teachers, and clear next actions while continuing to reuse the existing agenda data model and filters.

## Tasks

- [ ] Inspect the completed Phase 01 implementation before editing:
  - Read `Appscript/AgendaCore.gs`, `Appscript/Script.html`, `Appscript/Index.html`, `Appscript/Styles.html`, `tests/agendaCore.test.js`, and any preview script added in Phase 01
  - Search for the Phase 01 dashboard functions with `rg -n "buildManagerDashboard|renderDashboard|dashboard|Alertas operacionais|Carga por professor" Appscript tests`
  - Run `npm test` and `npm run preview` if a preview script exists, and capture the current passing baseline

- [ ] Add failing core tests for operational insight detection in `tests/agendaCore.test.js`:
  - Add assertions for a pure `core.buildOperationalInsights(appData, options)` function
  - Verify it detects overloaded slots when unique students in a slot are greater than or equal to the configured capacity
  - Verify it detects students with active status and no scheduled lessons
  - Verify it detects inactive or canceled students that still have scheduled lessons
  - Verify it detects teacher load imbalance by comparing each teacher's weekly lessons against the average teacher load
  - Verify results are sorted by severity first, then by day/time or professor name for stable rendering
  - Run `npm test` and confirm the new assertions fail before implementation

- [ ] Implement `buildOperationalInsights(appData, options)` in `Appscript/AgendaCore.gs`:
  - Reuse `buildSlotOccupancy`, `getOccupancyLevel`, `isActiveStatus`, `sortDays`, `sortTimes`, `timeToMinutes`, and existing lesson/student objects
  - Accept `options.capacity` with a default of `10` and `options.teacherLoadWarningRatio` with a default of `1.35`
  - Return `{ overloadedSlots, unscheduledActiveStudents, scheduledInactiveStudents, teacherLoadWarnings, summary }`
  - Include stable identifiers such as `slotKey`, `studentId`, and `professor` so frontend click handlers can drill into the existing data
  - Export the function in the same module return object as the other AgendaCore helpers

- [ ] Run `npm test` and fix only the operational insight implementation until all tests pass:
  - Preserve all existing Phase 01 dashboard behavior and previous AgendaCore behavior
  - Keep calculations pure so they work in both Apps Script and Node
  - Do not add Apps Script services or DOM assumptions to `AgendaCore.gs`

- [ ] Add dashboard drilldown state and helpers in `Appscript/Script.html`:
  - Add state fields for the currently selected dashboard drilldown, such as `dashboardDrilldownType` and `dashboardDrilldownKey`
  - Add helper functions that derive operational insights from the currently filtered students and lessons
  - Reuse existing helpers including `getFilteredData()`, `groupBy()`, `unique()`, `sortDays()`, `timeToMinutes()`, and `escapeHtml()`
  - Ensure dashboard insight counts update whenever status, professor, or search filters change

- [ ] Extend `renderDashboard()` with actionable insight sections:
  - Show an alert summary row for overloaded slots, active students without schedule, inactive students with lessons, and high teacher load
  - Render clickable alert rows with `data-dashboard-drilldown` attributes for each insight type
  - Show severity labels using manager-friendly Portuguese labels: `Crítico`, `Atenção`, and `Monitorar`
  - Keep the dashboard useful when there are no alerts by showing a compact `Sem alertas para o filtro atual` state

- [ ] Implement dashboard drilldown rendering in `Appscript/Script.html`:
  - When an overloaded slot is selected, show the day, time, capacity, student count, professor count, and the students/professors in that slot
  - When unscheduled active students are selected, show student name, ID, status, weekly frequency, and an `Editar` button using the existing student drawer flow
  - When scheduled inactive students are selected, show student name, ID, status, and the conflicting scheduled slots
  - When teacher load is selected, show teacher name, weekly lessons, average comparison, unique students, and morning/tarde split
  - Add a clear/back control that returns to the main dashboard without losing the global filters

- [ ] Add manager quick actions:
  - Add `Ver na agenda` actions for slot, teacher, and day drilldowns that route to the Agenda tab with the appropriate filters
  - Add `Filtrar professor` actions from workload rows that reuse the existing professor filter chips state
  - Add `Editar` actions in student drilldown rows that reuse `openStudentDrawer`
  - Preserve global status, professor, and search filters unless the user explicitly clicks a quick action that changes the professor filter

- [ ] Add styles for operational insights and drilldowns in `Appscript/Styles.html`:
  - Reuse the existing dashboard card, panel, chip, and table visual language from Phase 01
  - Add styles for alert summary tiles, severity pills, clickable insight rows, drilldown panels, and compact student/slot rows
  - Ensure mobile layout stacks cleanly and long names wrap without overlapping buttons or counts
  - Avoid new palette directions; keep the existing XSTEAM dark, lime, neutral, and status colors

- [ ] Verify operational insights end to end:
  - Run `npm test` and confirm it passes
  - Run `npm run preview` if available and open the generated preview HTML
  - Confirm each alert type can appear using demo data or a temporary local test dataset, then remove any temporary dataset changes that are not part of the intended demo
  - Confirm clicking each alert type opens the expected drilldown and that `Editar` still opens the existing student drawer
  - Confirm existing `Dashboard`, `Mapa de Calor`, `Agenda`, `Professores`, and `Alunos` views still render after using drilldowns
