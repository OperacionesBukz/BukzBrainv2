---
phase: 08-historial-de-pedidos
plan: 01
subsystem: api
tags: [fastapi, firestore, typescript, react-query, onsnapshot, pydantic]

# Dependency graph
requires:
  - phase: 07-aprobacion-pedidos-exportacion
    provides: replenishment_orders collection schema with aprobado/enviado statuses, mark_order_sent endpoint

provides:
  - Four new backend endpoints: GET /orders (list), GET /orders/{id} (detail), PATCH /orders/{id}/status (transition), GET /orders/{id}/export (single Excel)
  - StatusHistoryEntry, OrderListItem, OrderHistoryFilters, StatusTransitionRequest, StatusTransitionResponse, SingleExportResponse TypeScript types
  - useOrderHistory hook with real-time onSnapshot and client-side filtering via useMemo
  - useOrderDetail, useStatusTransition, useExportSingleOrder hooks
  - ALLOWED_TRANSITIONS map enforcing valid state machine transitions
  - status_history audit trail written atomically via ArrayUnion on mark_order_sent and transition_order_status

affects:
  - 08-02 (UI layer that will consume these hooks and API functions)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Lazy import of google.cloud.firestore_v1.ArrayUnion via _array_union() helper to avoid module-level import failure in local dev
    - onSnapshot with fixed query + client-side useMemo filters (avoids recreating Firestore listener on filter change)
    - ALLOWED_TRANSITIONS dict for state machine validation in backend transition endpoint

key-files:
  created: []
  modified:
    - backend/routers/reposiciones.py
    - src/pages/reposiciones/types.ts
    - src/pages/reposiciones/api.ts
    - src/pages/reposiciones/hooks.ts

key-decisions:
  - "_array_union() lazy import helper for ArrayUnion — avoids module-level google.cloud import that fails in local Python env without firebase-admin installed"
  - "onSnapshot fixed to non-borrador statuses, filters applied in useMemo — single Firestore listener regardless of active filter selections"
  - "ALLOWED_TRANSITIONS map enforces borrador is excluded from history list; transition endpoint returns 409 with descriptive message for invalid transitions"

patterns-established:
  - "Fixed Firestore query in useEffect + useMemo for client-side filtering: avoids listener teardown on every filter change"
  - "Lazy import via helper function for google.cloud Firestore sentinels (ArrayUnion) that may not be available in dev environment"

requirements-completed: [HIST-01, HIST-02, HIST-03, HIST-04, HIST-05]

# Metrics
duration: 5min
completed: 2026-03-30
---

# Phase 8 Plan 01: Order History Data Layer Summary

**Four FastAPI endpoints for order history (list/detail/status-transition/single-export) plus TypeScript types, API functions, and real-time useOrderHistory hook backed by Firestore onSnapshot**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-30T23:50:57Z
- **Completed:** 2026-03-30T23:56:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Backend receives four new endpoints: GET /orders with vendor/status/date filters, GET /orders/{id} with full items and status_history, PATCH /orders/{id}/status with ALLOWED_TRANSITIONS validation and atomic Firestore transaction, GET /orders/{id}/export returning single Excel as base64
- Existing mark_order_sent updated to also write status_history via ArrayUnion for consistent audit trail
- Frontend types cover all new statuses (parcial, recibido) and StatusHistoryEntry for the audit log
- Four hooks ready for UI consumption: useOrderHistory (real-time onSnapshot + client-side filter via useMemo), useOrderDetail (React Query), useStatusTransition, useExportSingleOrder

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend — Four new endpoints for order history** - `031983e` (feat)
2. **Task 2: Frontend types, API functions, and hooks for order history** - `159d0dd` (feat)

## Files Created/Modified

- `backend/routers/reposiciones.py` - Added _array_union helper, 7 Pydantic models, ALLOWED_TRANSITIONS, 4 new endpoints, updated mark_order_sent with status_history
- `src/pages/reposiciones/types.ts` - Added StatusHistoryEntry, OrderListItem, OrderHistoryFilters, StatusTransitionRequest, StatusTransitionResponse, SingleExportResponse; extended ReplenishmentOrder with parcial/recibido statuses and audit fields
- `src/pages/reposiciones/api.ts` - Added getOrderList, getOrderDetail, transitionOrderStatus, exportSingleOrder, downloadExcelFromBase64
- `src/pages/reposiciones/hooks.ts` - Added useOrderHistory, useOrderDetail, useStatusTransition, useExportSingleOrder

## Decisions Made

- `_array_union()` lazy import helper for Firestore `ArrayUnion` sentinel: the `google.cloud` module is not installed in the local Python dev environment (only in EasyPanel production), so a module-level `from google.cloud import firestore as firestore_lib` causes import failure. Using a lazy helper function matches the existing pattern in the file (`from google.cloud.firestore_v1 import transactional as _transactional` inside `approve_draft`).
- Firestore query in `useOrderHistory` is fixed (no filter params) — filters applied via `useMemo`. This avoids tearing down and recreating the `onSnapshot` listener every time the user changes a filter dropdown, which would cause flickers and unnecessary Firestore reads.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Replaced module-level firestore_lib import with lazy _array_union() helper**
- **Found during:** Task 1 (Backend endpoint implementation)
- **Issue:** Plan specified `from google.cloud import firestore as firestore_lib` at module level, but `google.cloud` is not available in local Python dev environment — causes `ModuleNotFoundError` on import, breaking all endpoint tests
- **Fix:** Removed module-level import; added `_array_union(values)` helper function that does `from google.cloud.firestore_v1 import ArrayUnion` lazily (only executes when actually called on EasyPanel). Replaced all `firestore_lib.ArrayUnion(...)` with `_array_union(...)`
- **Files modified:** backend/routers/reposiciones.py
- **Verification:** `python -c "from routers.reposiciones import router"` succeeds; all 4 endpoints registered
- **Committed in:** 031983e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for the backend import to succeed in any environment without firebase-admin installed. No scope creep — same functionality, lazy vs eager import.

## Issues Encountered

None beyond the import deviation above.

## Known Stubs

None — all functions are fully implemented with real Firestore queries and business logic.

## Next Phase Readiness

- All data contracts are established: types, API functions, and hooks are ready for UI consumption
- Plan 02 can build the order history page and detail views without touching backend or data plumbing
- No blockers

## Self-Check: PASSED

- FOUND: backend/routers/reposiciones.py
- FOUND: src/pages/reposiciones/types.ts
- FOUND: src/pages/reposiciones/api.ts
- FOUND: src/pages/reposiciones/hooks.ts
- FOUND: .planning/phases/08-historial-de-pedidos/08-01-SUMMARY.md
- FOUND commit: 031983e (Task 1)
- FOUND commit: 159d0dd (Task 2)

---
*Phase: 08-historial-de-pedidos*
*Completed: 2026-03-30*
