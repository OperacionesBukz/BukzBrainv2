---
phase: 06-wizard-frontend-config-y-sugeridos
plan: 02
subsystem: ui
tags: [react, typescript, react-query, shadcn, firestore, tailwind]

# Dependency graph
requires:
  - phase: 06-01
    provides: "TypeScript types (LocationItem, VendorItem, CalculateRequest, CalculateResponse, SalesStatusResponse, ReplenishmentConfig), React Query hooks (useLocations, useVendors, useReplenishmentConfig, useCalculate, useSalesStatusPolling), API functions (getSalesStatus, refreshSales), saveReplenishmentConfig, placeholder index.tsx"
provides:
  - "VendorMultiSelect component: searchable Popover+Command multi-select with 'Todos' default"
  - "ConfigPanel component: 5-input configuration form with responsive grid layout"
  - "useCalculationFlow hook: encapsulates cache check, refresh polling, and calculate flow"
  - "Full /reposiciones page: config persistence, handleCalcular, progress bar during polling, results summary"
affects:
  - "06-03 (SuggestionsTable — results will replace placeholder Card)"
  - "07-aprobacion-pedidos-exportacion (receives draft_id from calculation flow)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VendorMultiSelect: empty array = Todos pattern (collapse to [] when all individually checked)"
    - "useCalculationFlow: cache freshness check (24h), refresh+poll+calculate multi-step flow"
    - "Config persistence: fire-and-forget saveReplenishmentConfig inside handleCalcular"
    - "useRef for pendingRequest in polling effect to avoid stale closure"
    - "CacheProgressPlaceholder: indeterminate Progress bar during Shopify bulk refresh"

key-files:
  created:
    - src/pages/reposiciones/components/VendorMultiSelect.tsx
    - src/pages/reposiciones/components/ConfigPanel.tsx
  modified:
    - src/pages/reposiciones/hooks.ts
    - src/pages/reposiciones/index.tsx

key-decisions:
  - "pendingRequest stored as useRef (not useState) in useCalculationFlow to avoid stale closure in polling useEffect"
  - "409/OPERATION_IN_PROGRESS detection via message content check (api.ts throws before body is re-parsed in hook)"
  - "CacheProgressPlaceholder kept inline in index.tsx (Plan 03 will refine it into proper animated component)"
  - "ConfigPanel uses invisible Label spacer for alignment — keeps Calcular button vertically aligned with inputs"

patterns-established:
  - "Multi-select with empty=all pattern: value=[] means all, auto-collapse when all individually selected"
  - "Cache freshness: 24h threshold, check via getSalesStatus before triggering refresh"
  - "Calculation flow: getSalesStatus → branch (fresh/stale/running) → refresh+poll or direct calculate"

requirements-completed: [CONF-01, CONF-02, CONF-03, CONF-04, CONF-05]

# Metrics
duration: 25min
completed: 2026-03-30
---

# Phase 6 Plan 02: Config Panel UI Summary

**ConfigPanel + VendorMultiSelect UI components with useCalculationFlow hook encapsulating cache-check/refresh/polling/calculate multi-step flow, wired into /reposiciones page with Firestore config persistence**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-30T20:30:00Z
- **Completed:** 2026-03-30T20:55:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- VendorMultiSelect: Popover+Command searchable multi-select with "Todos (N)" default, per-vendor checkboxes, auto-collapse when all individually selected
- ConfigPanel: 5-input responsive grid form (sede dropdown, vendors multi-select, lead time 1-90, date range months 1-12, safety factor 1.0-3.0) with loading skeletons and clamped inputs
- useCalculationFlow hook: 24h cache freshness check, auto-refresh with polling trigger, direct calculate if fresh, 409 OPERATION_IN_PROGRESS toast, exposes clean `startCalculation` / `resetResults` API
- /reposiciones page: loads saved config from Firestore on mount, saves on calculate, shows progress bar during polling, shows results summary card post-calculation

## Task Commits

1. **Task 1: VendorMultiSelect + ConfigPanel** - `b3462cf` (feat)
2. **Task 2: useCalculationFlow hook** - `b0f23f1` (feat)
3. **Task 3: Wire ConfigPanel into index.tsx** - `ffa8ac9` (feat)

## Files Created/Modified

- `src/pages/reposiciones/components/VendorMultiSelect.tsx` - Searchable multi-select with Todos default, Popover+Command pattern
- `src/pages/reposiciones/components/ConfigPanel.tsx` - 5-input config form with responsive grid, loading skeletons, Calcular button
- `src/pages/reposiciones/hooks.ts` - Added useCalculationFlow hook with cache check, refresh, polling, and calculate flow
- `src/pages/reposiciones/index.tsx` - Full page replacing placeholder: config state, Firestore persistence, handleCalcular, progress bar, results

## Decisions Made

- `pendingRequest` stored as `useRef` (not `useState`) in `useCalculationFlow` to avoid stale closure problem in `useEffect` watching polling data
- 409/OPERATION_IN_PROGRESS: detection via message content string matching (api.ts converts 409 response into Error with message text before hook receives it)
- `CacheProgressPlaceholder` kept inline in index.tsx as simple Progress component — Plan 03 will refine into full animated progress with ETA
- Invisible Label spacer in ConfigPanel keeps the Calcular button row vertically aligned with the other inputs in the grid

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

- `src/pages/reposiciones/index.tsx` lines 127-138: Results section shows a simple "X productos analizados, Y necesitan reposicion" card. Plan 03 will replace this with SuggestionsTable and VendorSummaryPanel.
- `CacheProgressPlaceholder` in index.tsx: Uses indeterminate Progress bar. Plan 03 will refine this into a proper animated component with object count and ETA.

These stubs do not prevent Plan 02's goal (config panel + calculation trigger) from being achieved.

## Next Phase Readiness

- Plan 03 (SuggestionsTable UI) can now import `results` from the already-wired `useCalculationFlow` in index.tsx
- `draft_id` is available in `results.draft_id` for Plan 07 approval flow
- All config inputs are functional and wired — Plan 03 only needs to render the results data

## Self-Check: PASSED

- FOUND: src/pages/reposiciones/components/ConfigPanel.tsx
- FOUND: src/pages/reposiciones/components/VendorMultiSelect.tsx
- FOUND: commit b3462cf (Task 1)
- FOUND: commit b0f23f1 (Task 2)
- FOUND: commit ffa8ac9 (Task 3)

---
*Phase: 06-wizard-frontend-config-y-sugeridos*
*Completed: 2026-03-30*
