# Phase 4: Pipeline de Datos Shopify - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend endpoints that expose real Shopify data for the replenishment module: locations (sedes), inventory levels by location and vendor, vendor list from products, and historical sales (6 months) via Bulk Operations with Firestore cache. No frontend work in this phase — pure API.

</domain>

<decisions>
## Implementation Decisions

### API Version & Compatibility
- **D-01:** Stay on Shopify API `2025-01` (current version in config.py). Do NOT upgrade to 2026-01 to avoid breaking the ingreso module.
- **D-02:** Continue using `currentBulkOperation` query for polling (works on 2025-01). Refactor to `bulkOperation(id:)` is a future improvement, not this phase.
- **D-03:** Use `currentQuantity` (not `quantity`) in the bulk orders query to exclude refunded/cancelled line items.

### Bulk Operations Query
- **D-04:** Query scope: `financial_status:paid` orders only — this represents real inventory consumption.
- **D-05:** Date range: configurable, default 6 months (180 days from today).
- **D-06:** Extract from line items: `sku`, `currentQuantity`, and parent order `createdAt` (needed for in-transit detection in Phase 5).

### Sales Cache Strategy
- **D-07:** Cache granularity: aggregate by SKU + month (not daily). Matches replenishment engine thresholds.
- **D-08:** Cache storage: Firestore collection `sales_cache`, one document per cache run with subcollection for per-SKU data if document exceeds 1MB.
- **D-09:** Cache invalidation: >24 hours since last refresh → stale. Endpoint checks timestamp before deciding to launch new Bulk Operation.
- **D-10:** Cache includes metadata: `last_refreshed`, `date_range_start`, `date_range_end`, `sku_count`, `status`.

### Endpoint Design
- **D-11:** New dedicated router `backend/routers/reposiciones.py` — separate from ingreso. Import shared helpers from `shopify_service.py`.
- **D-12:** Endpoints:
  - `GET /api/reposiciones/locations` — returns Shopify locations (name + id)
  - `GET /api/reposiciones/vendors` — returns unique vendor names from Shopify products
  - `GET /api/reposiciones/inventory` — query params: `location_id`, `vendors[]` (optional filter)
  - `POST /api/reposiciones/sales/refresh` — triggers Bulk Operation or returns cache
  - `GET /api/reposiciones/sales/status` — polls bulk operation progress
  - `GET /api/reposiciones/sales/data` — returns cached sales data

### Bulk Operation Conflict Guard
- **D-13:** Before starting a new bulk operation, check `currentBulkOperation` status. If one is already running (from ingreso or other), return `{"error": "OPERATION_IN_PROGRESS", "message": "..."}` with HTTP 409.
- **D-14:** Job state (operation_id, status, started_at) persisted in Firestore `bulk_op_state` document — survives backend restarts.

### Vendor List
- **D-15:** Vendor list sourced from Shopify products' `vendor` field (not from hardcoded providers or Firestore). This is the single source of truth for which vendors have products.
- **D-16:** Vendor list endpoint returns distinct vendor names with product count per vendor.

### Claude's Discretion
- Background thread vs async: Claude can decide the best concurrency pattern (existing threading pattern from ingreso is fine to reuse)
- JSONL parsing approach: stdlib `json.loads()` per line (no library needed)
- Error handling granularity for individual Shopify API failures

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Shopify Integration (existing code to reuse)
- `backend/services/shopify_service.py` — Core Shopify helpers: `get_locations()`, `start_bulk_operation()`, `check_bulk_operation_status()`, `download_and_process_bulk_results()`, `ShopifyThrottler`, `search_inventory()`
- `backend/routers/ingreso.py` lines 224-282 — Bulk operations polling pattern: `_sales_worker()`, `_sales_cache`, `_sales_job`, `/sales/load`, `/sales/status` endpoints
- `backend/services/firebase_service.py` — `get_firestore_db()` initialization
- `backend/config.py` — `SHOPIFY_API_VERSION`, `SHOPIFY_SHOP_URL`, `SHOPIFY_ACCESS_TOKEN`, `BATCH_SIZE`, `MAX_WORKERS`

### Research findings
- `.planning/research/STACK.md` — Stack decisions: no new dependencies needed
- `.planning/research/PITFALLS.md` — Critical pitfalls for bulk operations, cache, and API version
- `.planning/research/ARCHITECTURE.md` — Data flow and component boundaries

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ShopifyThrottler` class: rate limiting for all Shopify API calls — reuse directly
- `get_locations()`: returns `{name: id}` dict — call directly for locations endpoint
- `start_bulk_operation()` / `check_bulk_operation_status()` / `download_and_process_bulk_results()`: full bulk ops pipeline — adapt query, reuse infrastructure
- `search_inventory()`: fetches inventory levels per location via REST — can reuse for filtered inventory
- `get_firestore_db()`: idempotent Firestore client — standard pattern
- Threading pattern from ingreso: `_sales_worker()` + `_sales_job` + status endpoint — clone and adapt

### Established Patterns
- GraphQL queries via `requests.Session()` with throttler
- REST inventory via `/inventory_levels.json?inventory_item_ids=X&location_ids=Y`
- Background jobs: `threading.Thread(target=worker, daemon=True)` with in-memory status dict
- Concurrent batching: `ThreadPoolExecutor` with `MAX_WORKERS=5`
- Router registration: add to `backend/main.py` with `app.include_router()`

### Integration Points
- New router registered in `backend/main.py` alongside existing routers
- Shared `shopify_service` module imported — no duplication
- Firestore via existing `firebase_service.get_firestore_db()`
- Frontend will poll `/api/reposiciones/sales/status` via React Query (Phase 6)

</code_context>

<specifics>
## Specific Ideas

- The bulk query must include order `createdAt` per line item — Phase 5's in-transit detection needs to know WHEN each sale happened relative to pending orders
- Sales data should be aggregated by SKU + year-month for the cache, but raw per-order data (sku, quantity, date) should be available for the in-transit calculation
- The vendors endpoint should be fast (cacheable) since it's used in the frontend multi-select dropdown

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-pipeline-de-datos-shopify*
*Context gathered: 2026-03-30*
