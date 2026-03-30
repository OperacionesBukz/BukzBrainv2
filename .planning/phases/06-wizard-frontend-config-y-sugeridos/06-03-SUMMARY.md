---
phase: 06-wizard-frontend-config-y-sugeridos
plan: 03
subsystem: ui
tags: [react, typescript, shadcn, tailwind, inline-edit, pagination, usememo]

# Dependency graph
requires:
  - phase: 06-01
    provides: "TypeScript interfaces (ProductResult, CalculateResponse, VendorSummaryResult, ReplenishmentStatsResult, UrgencyLevel), React Query hooks, placeholder index.tsx with results state"
  - phase: 06-02
    provides: "useCalculationFlow hook exposing results/isPolling/isCalculating, ConfigPanel wired into index.tsx, overridesMap/deletedSkus state ready for Plan 03"
provides:
  - "SuggestionsTable component: editable table with search, urgency filter, inline qty edit (click-Enter/Blur/Escape), row delete, pagination at 25/page, horizontal scroll"
  - "VendorSummaryPanel component: client-side vendor aggregation from effective products (after overrides/deletions), sorted by urgency then units, footer totals row"
  - "StatCard inline component: 5 stat cards (Total, Necesitan Reposicion, Urgentes, Agotados, Proveedores) with variant coloring"
  - "Full /reposiciones results section: SuggestionsTable + VendorSummaryPanel wired with overridesMap/deletedSkus state that persists across recalculations"
  - "draftId state in index.tsx for Phase 7 approval flow"
affects:
  - "07-aprobacion-pedidos-exportacion (receives draftId for approval flow)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "effectiveProducts useMemo: filter deletedSkus + apply overridesMap before rendering"
    - "Inline edit pattern: editingCell state (string|null), Input with onBlur+onKeyDown, commit on Enter/Blur, cancel on Escape"
    - "Client-side vendor aggregation: recompute from effective products to reflect edits/deletions immediately"
    - "overridesMap and deletedSkus NOT reset on recalculate — keyed by SKU string, persists across results updates"

key-files:
  created:
    - src/pages/reposiciones/components/SuggestionsTable.tsx
    - src/pages/reposiciones/components/VendorSummaryPanel.tsx
  modified:
    - src/pages/reposiciones/index.tsx

key-decisions:
  - "VendorSummaryPanel recomputes from effectiveProducts (NOT from backend vendor_summary) — ensures edits and deletions are reflected without a round-trip"
  - "overridesMap and deletedSkus NOT reset when results change — preserves manual work across recalculations (D-09)"
  - "StatCard defined inline in index.tsx (not separate file) — avoids over-splitting small helper component"
  - "draftId stored via useEffect watching results.draft_id — ready for Phase 7 without prop drilling"

patterns-established:
  - "Inline cell edit: editingCell=sku state, Input with ref+autoFocus via useEffect, commit on Enter/Blur, cancel on Escape"
  - "effectiveProducts pattern: filter deletedSkus + apply overridesMap in single useMemo pass"
  - "Client-side vendor aggregation pattern: derive from product rows rather than trusting backend aggregate"

requirements-completed: [APPR-01, APPR-02, APPR-03, APPR-04]

# Metrics
duration: 3min
completed: 2026-03-30
---

# Phase 6 Plan 03: Suggestions Table & Vendor Summary Summary

**Editable SuggestionsTable with inline qty edit + row delete, VendorSummaryPanel computed client-side from effective products, and full results section wired into /reposiciones page**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-30T20:37:36Z
- **Completed:** 2026-03-30T20:40:22Z
- **Tasks:** 2 (+ 1 auto-approved checkpoint)
- **Files modified:** 3

## Accomplishments

- SuggestionsTable: 10-column table with search (SKU/title/vendor), urgency filter dropdown, inline edit on Sugerido cell (click to edit, Enter/Blur to commit, Escape to cancel), delete row via Trash2 icon, PAGE_SIZE=25 pagination with "Mostrando X-Y de Z" text, horizontal ScrollArea for overflow
- VendorSummaryPanel: client-side aggregation of effectiveVendorSummary from products (applies overridesMap + deletedSkus filtering), sorted by urgent_count desc then total_units_to_order desc, footer totals row, "Sin productos para pedir" empty state
- index.tsx: 5 StatCard components (Total Productos, Necesitan Reposicion, Urgentes, Agotados, Proveedores), SuggestionsTable and VendorSummaryPanel wired with persistent state, draftId stored for Phase 7
- Build passes clean (npm run build exits 0)

## Task Commits

1. **Task 1: SuggestionsTable** - `a694a4c` (feat)
2. **Task 2: VendorSummaryPanel + index.tsx wiring** - `99690cb` (feat)
3. **Task 3: Visual checkpoint** - Auto-approved (auto mode active)

## Files Created/Modified

- `src/pages/reposiciones/components/SuggestionsTable.tsx` - Editable suggestions table with search, filter, inline edit, delete, pagination, horizontal scroll
- `src/pages/reposiciones/components/VendorSummaryPanel.tsx` - Per-vendor summary computed client-side from effective products with overrides and deletions applied
- `src/pages/reposiciones/index.tsx` - Full results section with 5 stat cards, SuggestionsTable, VendorSummaryPanel; overridesMap+deletedSkus persist across recalculations; draftId stored for Phase 7

## Decisions Made

- `VendorSummaryPanel` recomputes from `effectiveProducts` rather than from backend `vendor_summary` — this ensures real-time reflection of inline edits and row deletions without a round-trip to the backend
- `overridesMap` and `deletedSkus` are NOT reset when `results` changes — preserving manual overrides across recalculations is a core requirement (D-09 in plan context)
- `StatCard` defined inline in `index.tsx` — it's a small 8-line helper; extracting to a separate file adds complexity without benefit at this size
- `draftId` stored via `useEffect` watching `results?.draft_id` — cleanly decoupled from the calculation flow, ready for Phase 7 consumption

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all data is wired. The results section renders real ProductResult data from the backend. VendorSummaryPanel derives its data from the same products array. No placeholder text or hardcoded values remain in the results section.

## Next Phase Readiness

- Phase 7 (Aprobacion, Pedidos y Exportacion) can read `draftId` from the `/reposiciones` page state
- `overridesMap` and `deletedSkus` will need to be passed to the approval API (or Phase 7 can read the live state from the page)
- Full /reposiciones module is visually complete: config panel → calculation → stat cards → editable table → vendor summary

## Self-Check: PASSED

- FOUND: src/pages/reposiciones/components/SuggestionsTable.tsx
- FOUND: src/pages/reposiciones/components/VendorSummaryPanel.tsx
- FOUND: src/pages/reposiciones/index.tsx (modified)
- FOUND: commit a694a4c (Task 1)
- FOUND: commit 99690cb (Task 2)
- Build: PASSED (npm run build exits 0)

---
*Phase: 06-wizard-frontend-config-y-sugeridos*
*Completed: 2026-03-30*
