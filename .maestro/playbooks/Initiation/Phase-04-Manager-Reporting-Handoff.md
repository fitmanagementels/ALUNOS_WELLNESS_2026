# Phase 04: Manager Reporting Handoff

This phase adds practical reports for managers: teacher workload, slot occupancy, students needing action, and filtered agenda exports. It also records the implemented reporting and capacity decisions in structured Markdown so future maintainers can understand the operational model.

## Tasks

- [ ] Inspect the existing report-adjacent code before editing:
  - Read `Appscript/AgendaCore.gs`, `Appscript/Script.html`, `Appscript/Styles.html`, `tests/agendaCore.test.js`, and the Phase 01 preview script if present
  - Search for current export, download, table, dashboard, and capacity patterns with `rg -n "download|CSV|csv|table|teacherLoad|dayDemand|operational|dashboard|capacity" Appscript tests`
  - Run `npm test` and `npm run preview` if available to confirm the baseline

- [ ] Add failing tests for report model generation in `tests/agendaCore.test.js`:
  - Add assertions for `core.buildManagerReports(appData, options)`
  - Verify it returns report sections for `teacherWorkload`, `slotOccupancy`, `studentsNeedingAction`, and `agendaByDay`
  - Verify teacher workload rows include professor, weekly lessons, unique students, morning lessons, afternoon lessons, outside-period lessons, busiest day, and busiest slot
  - Verify slot occupancy rows include day, time, capacity, student count, professor count, occupancy percent, and level
  - Verify students needing action includes active students without lessons and inactive students with lessons
  - Run `npm test` and confirm these tests fail before implementation

- [ ] Implement `buildManagerReports(appData, options)` in `Appscript/AgendaCore.gs`:
  - Reuse `buildManagerDashboard`, `buildOperationalInsights`, and capacity helpers from previous phases when they exist
  - Reuse existing helpers for day/time sorting, turn calculation, occupancy grouping, and active status detection
  - Accept `options.capacitySettings` and return plain arrays suitable for UI tables and CSV export
  - Keep all report rows stable-sorted so repeated exports do not reorder unexpectedly
  - Export the function through the existing AgendaCore module return object

- [ ] Add failing tests for CSV generation in `tests/agendaCore.test.js`:
  - Add assertions for `core.toCsv(rows, columns)`
  - Verify it emits a header row using column labels
  - Verify it escapes commas, quotes, newlines, null values, and accented Portuguese text correctly
  - Verify it returns an empty-string-safe CSV when rows are empty but columns are present
  - Run `npm test` and confirm these tests fail before implementation

- [ ] Implement `toCsv(rows, columns)` in `Appscript/AgendaCore.gs`:
  - Accept `columns` as objects with `{ key, label }`
  - Convert `null` and `undefined` to empty fields
  - Escape fields with quotes when they contain comma, quote, newline, or carriage return
  - Double embedded quotes according to CSV rules
  - Export `toCsv` through the existing AgendaCore module return object

- [ ] Add a manager reports tab to the frontend:
  - In `Appscript/Index.html`, add a `Relatórios` subtab after `Dashboard`
  - In `Appscript/Script.html`, add `reports: "Relatórios"` to tab labels if still used and register `reports: renderReports` in `renderCurrentTab()`
  - Keep `Dashboard` as the default first tab from Phase 01
  - Ensure the reports view respects existing status, professor, search, and capacity settings

- [ ] Implement `renderReports()` in `Appscript/Script.html`:
  - Add report selector controls for `Carga dos professores`, `Ocupação por horário`, `Alunos para ação`, and `Agenda filtrada`
  - Render each report as a responsive table with clear Portuguese column labels and compact row counts
  - Reuse report data from core-shaped helper logic instead of duplicating complex calculations in multiple UI branches
  - Add empty states when the current filters produce no rows
  - Preserve existing student drawer edit buttons for student-action rows where useful

- [ ] Add CSV download support in `Appscript/Script.html`:
  - Add a `Baixar CSV` button in the reports toolbar
  - Generate CSV from the currently selected report and current filters
  - Use a browser `Blob` and temporary anchor click for local/download behavior
  - Name files with stable prefixes such as `xsteam-carga-professores.csv`, `xsteam-ocupacao-horarios.csv`, `xsteam-alunos-acao.csv`, and `xsteam-agenda-filtrada.csv`
  - Show a toast when there are no rows to export

- [ ] Add structured implementation notes as part of the reporting handoff:
  - Create `docs/architecture/manager-dashboard.md` with YAML front matter containing `type: reference`, `title: Manager Dashboard`, `created: 2026-06-27`, and tags for `dashboard`, `operations`, and `apps-script`
  - Include wiki-links to `[[Operational Insights]]`, `[[Capacity Settings]]`, and `[[Manager Reports]]`
  - Create `docs/architecture/operational-insights.md` with front matter and concise descriptions of overload, unscheduled-active, scheduled-inactive, and teacher-load calculations
  - Create `docs/architecture/capacity-settings.md` with front matter and the supported `CONFIG` sheet format
  - Keep documentation factual and aligned with the code implemented in Phases 01 through 04

- [ ] Verify manager reports end to end:
  - Run `npm test` and confirm it passes
  - Run `npm run preview` if available and open the generated preview HTML
  - Confirm each report renders with demo data and changes when status, professor, search, and capacity settings change
  - Download each CSV and confirm headers, row counts, accent characters, and escaped values are correct
  - Confirm existing dashboard, drilldowns, heatmap, agenda, teachers, students, and student editing still work after using reports
