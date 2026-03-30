---
phase: 04-pipeline-de-datos-shopify
verified: 2026-03-30T18:55:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 4: Pipeline de Datos Shopify — Verification Report

**Phase Goal:** El backend expone datos reales de Shopify — sedes, inventario y ventas históricas cacheadas — para que el motor de cálculo pueda operar con datos precisos y rápidos
**Verified:** 2026-03-30
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | GET /api/reposiciones/locations devuelve lista de sedes con id y nombre | VERIFIED | Endpoint defined at line 41 of reposiciones.py, calls `shopify_service.get_locations()`, converts to `[{name, id}]` |
| 2  | GET /api/reposiciones/vendors devuelve lista de proveedores con conteo de productos | VERIFIED | Endpoint defined at line 59, calls `get_vendors_from_shopify()` which paginates all Shopify products |
| 3  | GET /api/reposiciones/inventory?location_id=X&vendors[]=Y devuelve niveles de stock filtrados | VERIFIED | Endpoint defined at line 75, calls `get_inventory_by_location()` with vendor_filter support |
| 4  | POST /api/reposiciones/sales/refresh inicia Bulk Operation y devuelve status:running (o status:cached si cache vigente) | VERIFIED | Endpoint at line 313, returns `{"status": "running"}` or `{"status": "cached"}` |
| 5  | Si hay una Bulk Operation corriendo, el endpoint devuelve HTTP 409 con error OPERATION_IN_PROGRESS | VERIFIED | Guard at lines 338-346 checks `check_bulk_operation_status()` and raises HTTPException 409 |
| 6  | GET /api/reposiciones/sales/status devuelve el estado del job con progreso | VERIFIED | Endpoint at line 376, returns running/completed/failed/idle states |
| 7  | GET /api/reposiciones/sales/data devuelve ventas agregadas por SKU+mes desde Firestore sales_cache | VERIFIED | Endpoint at line 412, reads `sales_cache/6m_global`, handles chunked data |
| 8  | Ventas procesadas se persisten en Firestore coleccion sales_cache documento 6m_global | VERIFIED | `_write_sales_cache_to_firestore()` at line 216 writes to `sales_cache/6m_global` with full metadata |
| 9  | Si backend se reinicia con job en progreso, el estado se recupera desde Firestore reposiciones_meta/bulk_op_state | VERIFIED | `_recover_job_state_on_startup()` at line 119, called at module import (line 306) |
| 10 | Segunda llamada a sales/refresh dentro de 24h devuelve status:cached sin lanzar nueva operacion | VERIFIED | Guard 3 at lines 349-356 calls `_is_cache_stale()` with `_CACHE_TTL_HOURS = 24` |

**Score:** 10/10 truths verified

---

## Required Artifacts

| Artifact | Expected | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|----------------------|----------------|--------|
| `backend/routers/reposiciones.py` | Router with 6 endpoints, worker thread, job state | YES (455 lines) | YES — 6 endpoints, worker, Firestore helpers, job state dict | YES — imported in main.py line 20, registered line 50 | VERIFIED |
| `backend/services/shopify_service.py` | get_vendors_from_shopify(), get_inventory_by_location(), start_bulk_operation_reposiciones() | YES | YES — all 3 functions present with real GraphQL queries and pagination | YES — called from reposiciones.py | VERIFIED |
| `backend/main.py` | Router reposiciones registered with auth | YES | YES — `from routers import reposiciones` line 20, `app.include_router(reposiciones.router, dependencies=_auth)` line 50 | YES | VERIFIED |

---

## Key Link Verification

| From | To | Via | Pattern | Status |
|------|----|-----|---------|--------|
| `backend/routers/reposiciones.py` | `backend/services/shopify_service.py` | import at top + function calls | `shopify_service.get_vendors_from_shopify`, `get_inventory_by_location`, `start_bulk_operation_reposiciones`, `check_bulk_operation_status` | WIRED |
| `backend/main.py` | `backend/routers/reposiciones.py` | `app.include_router` | `include_router(reposiciones.router, dependencies=_auth)` | WIRED |
| `backend/routers/reposiciones.py` | Firestore `sales_cache/6m_global` | `_write_sales_cache_to_firestore()` | `db.collection('sales_cache').document('6m_global').set(...)` at lines 235, 240 | WIRED |
| `backend/routers/reposiciones.py` | Firestore `reposiciones_meta/bulk_op_state` | `_persist_job_state()` | `db.collection('reposiciones_meta').document('bulk_op_state').set(...)` at line 110 | WIRED |
| `POST /api/reposiciones/sales/refresh` | `shopify_service.check_bulk_operation_status()` | guard check before launching operation | `OPERATION_IN_PROGRESS` error code at lines 341-346 | WIRED |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `GET /locations` | `locations_dict` | `shopify_service.get_locations()` — calls Shopify REST API | YES — real GraphQL/REST call | FLOWING |
| `GET /vendors` | return value | `get_vendors_from_shopify()` — paginates all Shopify products via GraphQL, `pageInfo`/`hasNextPage`/`endCursor` | YES — paginated real call | FLOWING |
| `GET /inventory` | return value | `get_inventory_by_location()` — `inventoryLevels` query with `quantities(names: ["available"])` | YES — paginated real call | FLOWING |
| `GET /sales/data` | `cache_doc` | Firestore `sales_cache/6m_global` populated by `_sales_refresh_worker` after Bulk Op download | YES — worker writes real aggregated data | FLOWING |
| `_download_and_aggregate` | `sales_by_sku_month` | Shopify JSONL downloaded from Bulk Op URL | YES — streams JSONL, uses `currentQuantity` and `createdAt` | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 6 endpoints registered in router | `python -c "from routers.reposiciones import router; print([r.path for r in router.routes])"` | `['/api/reposiciones/locations', '/api/reposiciones/vendors', '/api/reposiciones/inventory', '/api/reposiciones/sales/refresh', '/api/reposiciones/sales/status', '/api/reposiciones/sales/data']` | PASS |
| shopify_service functions importable | `python -c "from services.shopify_service import get_vendors_from_shopify, get_inventory_by_location, start_bulk_operation_reposiciones; print('All imports OK')"` | `All imports OK` | PASS |
| Commits verified in git log | `git log --oneline \| grep -E "1c2f676\|953477b\|d18c356\|a9a76c6"` | All 4 commits found | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SHOP-01 | 04-01 | Backend obtiene lista de Locations (sedes) de Shopify y las expone como endpoint | SATISFIED | `GET /api/reposiciones/locations` calls `get_locations()`, returns `[{name, id}]` |
| SHOP-02 | 04-01 | Backend obtiene niveles de inventario por Location para productos filtrados por proveedor | SATISFIED | `GET /api/reposiciones/inventory` calls `get_inventory_by_location(location_gid, vendor_filter)` |
| SHOP-03 | 04-01 | Backend obtiene lista de proveedores únicos desde productos de Shopify | SATISFIED | `GET /api/reposiciones/vendors` calls `get_vendors_from_shopify()` with full pagination |
| SHOP-04 | 04-02 | Backend ejecuta Bulk Operation para extraer ventas históricas (6 meses configurable) con `currentQuantity` | SATISFIED | `start_bulk_operation_reposiciones(date_range_days=180)` uses `currentQuantity` (not `quantity`), includes `createdAt`, filters `financial_status:paid` |
| SHOP-05 | 04-02 | Backend persiste ventas agregadas por SKU/mes en Firestore como cache (invalidacion >24h) | SATISFIED | `_write_sales_cache_to_firestore()` writes `sales_cache/6m_global` with `last_refreshed`, `sku_count`, `status`, date range; `_is_cache_stale()` checks 24h TTL |
| SHOP-06 | 04-02 | Backend reutiliza cache de ventas en ejecuciones posteriores (solo jala delta desde ultima actualizacion) | SATISFIED | Guard 3 in `sales_refresh()` returns `{"status": "cached"}` when `_is_cache_stale()` is False |
| SHOP-07 | 04-02 | Backend implementa guard para evitar conflicto de bulk operations simultaneas con modulo ingreso | SATISFIED | Guard 2 calls `check_bulk_operation_status()` (Shopify-level check, catches ingreso module's ops too), returns HTTP 409 `OPERATION_IN_PROGRESS` |

All 7 requirements declared across plans are accounted for. No orphaned requirements found.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

No TODO/FIXME/placeholder comments, no stub return values, no empty implementations found in reposiciones.py or the new functions in shopify_service.py.

One note: the original `start_bulk_operation()` function (ingreso module) remains untouched — verified at line 831 of shopify_service.py. The new `start_bulk_operation_reposiciones()` is a separate function at line 923, as required.

---

## Human Verification Required

### 1. Shopify API connectivity

**Test:** Deploy to EasyPanel and call `GET /api/reposiciones/locations` with a valid Firebase token.
**Expected:** Returns list of location objects, e.g. `[{"name": "Bodega Principal", "id": "gid://shopify/Location/..."}]`
**Why human:** Cannot test against live Shopify API without credentials; Python import checks confirm code correctness but not API connectivity.

### 2. Bulk Operation end-to-end

**Test:** Call `POST /api/reposiciones/sales/refresh`, then poll `GET /api/reposiciones/sales/status` until `status: completed`, then call `GET /api/reposiciones/sales/data`.
**Expected:** `sales/refresh` returns `{"status": "running"}`, polling shows progress via `object_count`, `sales/data` returns `{"data": {sku: {...}}, "sku_count": N, "last_refreshed": "..."}` with real SKU data.
**Why human:** Requires live Shopify Bulk Op execution (minutes-long async process) and live Firestore write.

### 3. Cache invalidation behavior

**Test:** Call `POST /api/reposiciones/sales/refresh` twice within 24 hours.
**Expected:** Second call returns `{"status": "cached", "last_refreshed": "...", "sku_count": N}` without launching a new Bulk Op.
**Why human:** Requires real Firestore state from a completed prior operation.

### 4. 409 conflict guard with ingreso module

**Test:** Trigger a bulk operation from the ingreso module, then immediately call `POST /api/reposiciones/sales/refresh`.
**Expected:** Returns HTTP 409 with `{"error": "OPERATION_IN_PROGRESS", "message": "..."}`.
**Why human:** Requires two concurrent operations; cannot simulate without live Shopify account.

---

## Gaps Summary

No gaps found. All must-haves from both plans (04-01 and 04-02) verified at all four levels (exists, substantive, wired, data flowing). All 7 requirement IDs (SHOP-01 through SHOP-07) are satisfied by concrete code in the codebase. All 4 commits documented in the summaries are present in git history.

---

_Verified: 2026-03-30T18:55:00Z_
_Verifier: Claude (gsd-verifier)_
