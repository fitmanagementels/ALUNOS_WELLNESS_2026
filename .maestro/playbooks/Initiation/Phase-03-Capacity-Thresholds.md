# Phase 03: Capacity Thresholds

This phase replaces the fixed occupancy capacity with manager-configurable threshold rules. It adds a safe settings model, spreadsheet integration, and UI indicators so occupancy alerts and reports reflect the real operating capacity of different days or time slots.

## Tasks

- [ ] Inspect current capacity usage before editing:
  - Read `Appscript/AgendaCore.gs`, `Appscript/Code.gs`, `Appscript/Script.html`, `Appscript/Styles.html`, and `tests/agendaCore.test.js`
  - Search for hard-coded capacity and occupancy logic with `rg -n "capacity|Capacidade|10|buildSlotOccupancy|getHeatmapCapacity|getOccupancyLevel" Appscript tests`
  - Run `npm test` and `npm run preview` if available to confirm the baseline

- [ ] Add failing tests for capacity configuration parsing in `tests/agendaCore.test.js`:
  - Add assertions for `core.normalizeCapacitySettings(rawSettings)`
  - Verify it returns a default capacity of `10` when settings are missing or invalid
  - Verify it accepts a global default capacity such as `{ defaultCapacity: 12 }`
  - Verify it accepts slot overrides keyed by `Dia|Hora`, such as `Segunda|05:15`
  - Verify it normalizes day and time values using existing day/time rules
  - Verify invalid override capacities are ignored without throwing
  - Run `npm test` and confirm the new tests fail before implementation

- [ ] Implement capacity settings helpers in `Appscript/AgendaCore.gs`:
  - Add `normalizeCapacitySettings(rawSettings)` returning `{ defaultCapacity, slotCapacities }`
  - Add `getCapacityForSlot(settings, day, time)` returning the override capacity or default capacity
  - Reuse `normalizeDay`, `normalizeTime`, and `cleanText` instead of adding separate parsing rules
  - Keep default capacity at `10` for backward compatibility
  - Export both helpers through the existing AgendaCore module return object

- [ ] Update occupancy, dashboard, and operational insight calculations to use capacity settings:
  - Update `buildSlotOccupancy` to optionally accept either a number capacity or normalized settings object while preserving current numeric behavior
  - Update `buildManagerDashboard` and `buildOperationalInsights` to accept `options.capacitySettings` and use per-slot capacity when present
  - Keep `options.capacity` support as a backward-compatible shortcut for a global capacity
  - Ensure occupancy levels, overloaded-slot alerts, busiest slot details, and dashboard cards all use the same capacity lookup

- [ ] Run `npm test` and fix capacity-related behavior until all tests pass:
  - Preserve existing tests that pass numeric capacity directly to `buildSlotOccupancy`
  - Add any missing assertions needed to prove per-slot capacity changes alert output
  - Keep all helpers pure and Apps Script compatible

- [ ] Add spreadsheet settings support in `Appscript/Code.gs`:
  - Add a `getAgendaSettings()` server function that reads a `CONFIG` sheet if it exists
  - Support a simple sheet format with columns `Tipo`, `Dia`, `Hora`, and `Capacidade`
  - Treat a row with `Tipo` equal to `padrao` as the global default capacity
  - Treat rows with `Tipo` equal to `slot` as per-day/per-time overrides
  - Return normalized settings using `AgendaCore.normalizeCapacitySettings`
  - If the sheet is missing, return the default normalized settings without throwing

- [ ] Add a manager settings panel in the frontend:
  - Add settings state fields such as `capacitySettings`, `settingsLoaded`, and `settingsError`
  - Load settings alongside agenda data using `serverCall("getAgendaSettings")`, with a fallback to default capacity when Apps Script is unavailable
  - Pass capacity settings into dashboard, heatmap, operational insights, and later reports calculations
  - Show the current default capacity and a compact list of slot overrides in a dashboard/settings panel
  - Keep settings read-only in this phase unless a save endpoint already exists; do not invent spreadsheet writes without tests

- [ ] Update heatmap and alert UI to display the active capacity:
  - Replace `getHeatmapCapacity()` fixed return behavior with capacity lookup by day/time
  - Show cell labels or tooltips as `alunos/capacidade` where space allows
  - Update overloaded alert copy to include the slot capacity used for that alert
  - Ensure existing slot modal shows the capacity for the selected day/time

- [ ] Add styles for settings and capacity indicators in `Appscript/Styles.html`:
  - Add compact settings panel, capacity badge, capacity override list, and `alunos/capacidade` cell styles
  - Reuse existing panel, chip, muted text, and table patterns where possible
  - Ensure capacity information remains readable on mobile without overcrowding heatmap cells

- [ ] Verify capacity settings end to end:
  - Run `npm test` and confirm it passes
  - Run `npm run preview` if available and confirm the fallback default capacity is shown
  - In Apps Script or a local mock path, verify missing `CONFIG` sheet falls back to capacity `10`
  - Verify a sample `CONFIG` sheet with default and slot override rows changes heatmap levels, dashboard alerts, and capacity values
  - Confirm existing dashboard, drilldowns, heatmap, agenda, professors, and students views still render
