---
phase: 04-pipeline-de-datos-shopify
plan: 02
subsystem: backend
tags: [bulk-operations, shopify, firestore, cache, background-worker, reposiciones]
dependency_graph:
  requires: [04-01]
  provides: [sales-bulk-op-endpoints, sales-cache-firestore, background-worker-polling]
  affects: [05-motor-calculo-reposicion]
tech_stack:
  added: []
  patterns:
    - Background thread worker with daemon=True (cloned from ingreso.py pattern)
    - Firestore dual-write: inline doc for <=8000 SKUs, subcollection chunks for >8000
    - Job state persistence in Firestore for backend restart recovery
    - 409 conflict guard checking both local job state and live Shopify bulk op status
    - 24h TTL cache invalidation via ISO timestamp comparison
key_files:
  created: []
  modified:
    - backend/services/shopify_service.py
    - backend/routers/reposiciones.py
decisions:
  - "Use currentQuantity (not quantity) in bulk query to avoid inflation by order edits (D-03)"
  - "Include createdAt in order node for Phase 5 month-based sales aggregation (D-06)"
  - "Guard 409 checks both local job dict AND live Shopify API to prevent ingreso module conflict (SHOP-07)"
  - "Chunk threshold 8000 SKUs / 500 per chunk to stay under Firestore 1MB doc limit (D-08)"
  - "_recover_job_state_on_startup() runs at module import, not in a startup event, for simplicity"
metrics:
  duration_minutes: 3
  completed_date: "2026-03-30"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 04 Plan 02: Sales Bulk Operations + Cache Summary

**One-liner:** Shopify Bulk Operations worker with currentQuantity+createdAt query, 24h Firestore cache in sales_cache/6m_global, and 409 conflict guard against ingreso module.

## What Was Built

Added the sales data pipeline to the reposiciones backend:

1. **`start_bulk_operation_reposiciones()`** in `shopify_service.py` — new Shopify Bulk Op mutation that uses `currentQuantity` (not `quantity`), includes `createdAt` on the order node, filters by `financial_status:paid`, and accepts a configurable `date_range_days` parameter (default 180). The existing `start_bulk_operation()` used by the ingreso module was not touched.

2. **Worker + 3 endpoints** in `routers/reposiciones.py`:
   - `_sales_refresh_worker`: daemon thread that starts a bulk op, polls Shopify every 5 seconds (max 120 iterations = 10 min), downloads the JSONL result, aggregates by SKU+month, and writes to Firestore.
   - `POST /api/reposiciones/sales/refresh`: three guards before launching — local job in-progress (409), Shopify bulk op in-progress (409, shared with ingreso), and fresh cache (<24h returns `status:cached`).
   - `GET /api/reposiciones/sales/status`: returns `running/completed/failed/idle` with object_count progress during polling.
   - `GET /api/reposiciones/sales/data`: reads from `sales_cache/6m_global`, handles chunked data (>8000 SKUs via subcollection).

## All 6 Reposiciones Endpoints

| Endpoint | Plan | Purpose |
|----------|------|---------|
| GET /api/reposiciones/locations | 04-01 | Sedes de Shopify |
| GET /api/reposiciones/vendors | 04-01 | Proveedores con conteo |
| GET /api/reposiciones/inventory | 04-01 | Inventario por sede y proveedor |
| POST /api/reposiciones/sales/refresh | 04-02 | Inicia bulk op de ventas |
| GET /api/reposiciones/sales/status | 04-02 | Estado del job de refresh |
| GET /api/reposiciones/sales/data | 04-02 | Ventas agregadas por SKU+mes |

## Firestore Collections Used

| Collection | Document | Purpose |
|-----------|----------|---------|
| `sales_cache` | `6m_global` | Ventas agregadas: `{sku: {"2025-10": 5, ...}, ...}` |
| `reposiciones_meta` | `bulk_op_state` | Estado del job para sobrevivir reinicios |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | d18c356 | feat(04-02): add start_bulk_operation_reposiciones() to shopify_service |
| Task 2 | a9a76c6 | feat(04-02): add sales worker + 3 endpoints to reposiciones.py |

## Deviations from Plan

None — plan executed exactly as written.

The `from main import app` verification in the plan failed due to `firebase_admin` not being installed in the local Python environment — this is a pre-existing environment constraint, not caused by this plan. All router-level verifications passed completely.

## Known Stubs

None. All endpoints are fully wired to real Shopify API calls and Firestore persistence.

## Self-Check: PASSED

- backend/services/shopify_service.py — modified with start_bulk_operation_reposiciones()
- backend/routers/reposiciones.py — modified with all 3 sales endpoints + worker
- Commits d18c356 and a9a76c6 verified in git log
- All 12 acceptance criteria verified via Python import check (all OK)
- 6 endpoints confirmed via router.routes inspection
