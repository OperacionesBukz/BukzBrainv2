---
phase: 05-motor-de-c-lculo-de-reposici-n
plan: 02
subsystem: api
tags: [fastapi, pydantic, firestore, shopify, reposicion, bulk-ops]

# Dependency graph
requires:
  - phase: 05-01
    provides: calculate_replenishment() pure function in reposicion_service.py
  - phase: 04-pipeline-de-datos-shopify
    provides: sales_cache/6m_global Firestore document + get_inventory_by_location()

provides:
  - POST /api/reposiciones/calculate endpoint with full Pydantic request/response models
  - CalculateRequest, ProductAnalysis, VendorSummary, ReplenishmentStats, CalculateResponse models
  - _load_sales_cache_data() helper with inline/chunked support and 424 guard
  - _load_pending_orders_map() helper building {sku: [{quantity, created_at}]} map
  - _persist_draft() helper writing borrador document to replenishment_orders Firestore collection

affects:
  - 06-wizard-frontend-config-y-sugeridos
  - 07-aprobacion-pedidos-y-exportacion

# Tech tracking
tech-stack:
  added: [pydantic BaseModel (already in FastAPI stack)]
  patterns:
    - Pydantic response_model for automatic serialization + OpenAPI docs
    - Lazy import of calculate_replenishment inside endpoint (avoids circular imports)
    - 424 status code for dependency not ready (sales cache missing)
    - Effective date range = max(requested_start, cache_coverage_start) to respect cache boundaries

key-files:
  created: []
  modified:
    - backend/routers/reposiciones.py

key-decisions:
  - "424 status for missing/not-ready sales cache (not 404 or 500) — signals dependency failure"
  - "Effective start date = max(requested_start, cache_start) to prevent requesting data beyond cache coverage"
  - "Lazy import of calculate_replenishment inside endpoint handler to avoid potential circular import"
  - "vendor_filter=body.vendors if body.vendors else None — empty list treated as no filter (D-16)"
  - "Draft persists full products/vendor_summary/stats to Firestore borrador for Phase 6 approval flow"

patterns-established:
  - "Pattern 1: _load_X helpers encapsulate Firestore reads with clear error semantics (424/500)"
  - "Pattern 2: replenishment_orders collection used for both pending orders (input) and drafts (output) differentiated by status field"

requirements-completed: [CALC-01, CALC-02, CALC-03, CALC-04, CALC-05, CALC-06]

# Metrics
duration: 5min
completed: 2026-03-30
---

# Phase 05 Plan 02: Motor de Cálculo de Reposición — Endpoint HTTP Summary

**POST /api/reposiciones/calculate exposes the calculation engine as HTTP endpoint with Pydantic models, 424-guarded sales cache loading, and Firestore draft persistence**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-30T19:31:00Z
- **Completed:** 2026-03-30T19:36:18Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added 5 Pydantic models (CalculateRequest, ProductAnalysis, VendorSummary, ReplenishmentStats, CalculateResponse) to the existing router
- Added 3 data helpers (_load_sales_cache_data with inline/chunked support, _load_pending_orders_map with status filter, _persist_draft for borrador creation)
- Added POST /api/reposiciones/calculate integrating Shopify inventory, Firestore sales cache, pending orders absorption, and draft persistence — all 6 existing endpoints untouched

## Task Commits

1. **Task 1: Pydantic models + helpers** - `a1ebb53` (feat)
2. **Task 2: POST /calculate endpoint** - `aefd08d` (feat)

## Files Created/Modified

- `backend/routers/reposiciones.py` — Added 251 lines: pydantic import, constant, 5 models, 3 helpers, POST /calculate endpoint

## Decisions Made

- Used `status_code=424` (Failed Dependency) for missing/not-ready sales cache — this is the semantically correct HTTP status for "required upstream dependency not ready", distinct from 404 (not found) or 500 (server error)
- Effective date range calculation: `max(requested_start, cache_start)` prevents requesting data coverage beyond what the Bulk Operations cache actually has
- Lazy import of `calculate_replenishment` inside the endpoint handler — avoids any potential circular import issues since both files are in the backend package
- Empty vendors list treated same as None (no filter) per D-16 using `body.vendors if body.vendors else None`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — the existing file had all required imports (`Optional`, `datetime`, `timedelta`, `timezone`) already present. Only `from pydantic import BaseModel` needed to be added.

## User Setup Required

None - no external service configuration required. All Firestore collections used (`sales_cache`, `replenishment_orders`) were already defined in Phase 4.

## Next Phase Readiness

- Phase 06 (Wizard Frontend) can now call POST /api/reposiciones/calculate and receive a typed CalculateResponse
- The `draft_id` in the response enables Phase 06 to display and edit the draft before approval
- Phase 07 (Aprobación) must write `replenishment_orders` documents with the schema documented in SCHEMA CONTRACT comments: `{status: "aprobado"|"enviado", created_at: ISO8601, items: [{sku, vendor, quantity, title}]}`
- No blockers

---
*Phase: 05-motor-de-c-lculo-de-reposici-n*
*Completed: 2026-03-30*
