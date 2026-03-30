# Domain Pitfalls: Reposiciones Automatizadas

**Domain:** Inventory replenishment with Shopify API integration
**Researched:** 2026-03-30
**Overall confidence:** HIGH (most findings verified against official Shopify docs and existing codebase)

---

## Critical Pitfalls

Mistakes that cause rewrites, corrupted replenishment data, or silent calculation errors.

---

### Pitfall 1: `currentBulkOperation` Is Deprecated — Will Break on API Upgrade

**What goes wrong:** The existing `check_bulk_operation_status()` in `shopify_service.py` uses `currentBulkOperation` (line 896). This query is deprecated in API version 2026-01+ and replaced by `bulkOperation(id: $id)`. When the project upgrades its API version (currently `2025-01` in config.py), all bulk operation polling will silently return null or fail.

**Why it happens:** The deprecated query was the only option before 2026-01. The new API requires storing the operation ID returned at creation and querying it by ID. The existing code already captures the operation ID from `start_bulk_operation()` but discards it — `load_sales_sync()` calls `start_bulk_operation()` but `check_bulk_operation_status()` doesn't accept an ID parameter.

**Consequences:** After any API version bump to 2026-01+, bulk operations appear to never complete. The `status_check` returns `None`, the job runs for 10 minutes, and times out. Users get no sales data. This is entirely invisible — no error message, just timeout.

**Warning signs:** `check_bulk_operation_status()` returning `{"status": null}` after an operation was successfully started.

**Prevention:**
- Refactor `check_bulk_operation_status(operation_id: str)` to accept and use the specific ID from the mutation response
- Store the operation ID and pass it through the polling loop in `load_sales_sync()`
- Use `bulkOperation(id: $id)` query, not `currentBulkOperation`
- Keep `currentBulkOperation` as a fallback only for backward compatibility

**Phase:** Address in Phase 1 (Shopify data pipeline) before any other bulk work.

---

### Pitfall 2: `OPERATION_IN_PROGRESS` Blocks All Future Bulk Operations

**What goes wrong:** If a bulk operation is already running (from ingreso module, or a previous replenishment attempt), calling `bulkOperationRunQuery` returns a `userError` with message "A bulk operation for this app and shop is already in progress." The new replenishment module would silently fail to start because `start_bulk_operation()` treats user errors as a soft failure and returns `(None, error_message)`, but calling code may not surface this clearly.

**Why it happens:** Before API 2026-01, Shopify enforces one bulk operation per shop per app at a time. The ingreso module and the replenishment module will compete for the same slot.

**Consequences:** Replenishment jobs that trigger right after an inventory lookup in the ingreso module will fail to start. If the UI shows "job started" optimistically, users believe data is being fetched when nothing is happening.

**Warning signs:** `userErrors` containing "already in progress" from `bulkOperationRunQuery`.

**Prevention:**
- Before starting a bulk operation, call `currentBulkOperation` (or `bulkOperation` in 2026-01+) to check if one is running
- If status is `RUNNING` or `CREATED`, either wait or cancel the existing one with `bulkOperationCancel`
- Expose a clear UI state: "Operación en curso, espera o cancela la actual"
- Consider a shared queue mechanism across modules if both modules use bulk operations frequently

**Phase:** Address in Phase 1 (Shopify data pipeline).

---

### Pitfall 3: JSONL Parent-Child Parsing Treats Line Items as Top-Level Objects

**What goes wrong:** The Bulk Operations JSONL output is flattened — each line is an independent JSON object. Line items become separate objects from their parent orders, linked only by a `__parentId` field. The existing `download_and_process_bulk_results()` correctly filters by presence of `"sku"` in the object, but it does NOT verify that the SKU object's `__parentId` references a valid, non-cancelled order.

**Why it happens:** In the flattened JSONL, a line item `{"sku": "9780...", "quantity": 2, "__parentId": "gid://shopify/Order/123"}` appears on its own line. If the filter query includes `financial_status:paid`, the parent order is paid — but refunded or cancelled line items within a paid order still appear.

**Consequences:** Sales velocity is inflated by items that were returned or refunded. A book that sold 100 units with 30 refunds would appear to have sold 100, triggering over-ordering.

**Warning signs:** Sales figures consistently higher than reports from Shopify's own analytics dashboard.

**Prevention:**
- In the bulk query, add `refundLineItems` to orders so you can subtract refunds from sold quantities
- Alternatively, filter with `financial_status:paid` AND only count line items where `currentQuantity > 0` (use `currentQuantity` not `quantity` in line item node)
- Cross-validate: compare total units from bulk output against Shopify Analytics for a known SKU before trusting replenishment data

**Phase:** Address in Phase 1 (Shopify data pipeline), specifically when designing the bulk query schema.

---

### Pitfall 4: In-Transit Detection Double-Counts When Pending Order Covers Multiple Periods

**What goes wrong:** The proposed logic is: "take Shopify sales from the date of the pending order to today, and that represents how much of the pending order has been 'absorbed' by real sales." This logic fails when:

1. The pending order was large enough to cover multiple weeks of demand — sales from pending_order_date to today may be LESS than the pending quantity, but the system should still reorder the remaining shortfall.
2. The pending order date is stale (order placed 45 days ago, lead time is 30 days) — the order may have already arrived physically but Firestore still shows it as "pending" because no receipt was recorded.
3. Multiple pending orders for the same SKU exist at different dates — the system must account for ALL of them against total cumulative sales since the earliest one.

**Why it happens:** The algorithm assumes a single pending order per SKU and a clean state. Real operations have partial arrivals, late deliveries, and data entry lag.

**Consequences:** Systematic under-ordering (missed restocks when a pending order partially covers demand) or over-ordering (treating an already-received order as still in-transit).

**Warning signs:**
- Replenishment suggestions show 0 for SKUs that are clearly stockouts
- Suggestions show large quantities for SKUs that were recently restocked but not marked received

**Prevention:**
- Model in-transit inventory per-SKU as a list of `{order_id, quantity_ordered, order_date, quantity_received}` — never a single value
- Calculate: `net_in_transit = sum(quantity_ordered - quantity_received for all pending orders)`
- Calculate: `sales_since_oldest_pending = sum(sales from oldest_pending_order_date to today)`
- Calculate: `absorbed = min(sales_since_oldest_pending, net_in_transit)` — what has been absorbed by real demand
- Calculate: `effective_in_transit = net_in_transit - absorbed` — what is truly still coming
- Add a `max_pending_age_days` config threshold: if a pending order is older than (lead_time + buffer), flag it as "posiblemente recibido" and exclude it from in-transit calculation pending manual confirmation

**Phase:** Address in Phase 2 (calculation engine). This is the highest-complexity design decision.

---

### Pitfall 5: Sales Cache in Memory Evaporates on Backend Restart

**What goes wrong:** The existing ingreso module stores sales data in `_sales_cache` (a Python dict in memory). When EasyPanel restarts the container — on deploy, crash, or scaling — the cache is gone. The replenishment module's plan to cache sales in Firestore is correct, but if the new module falls back to the same in-memory pattern for interim states, it will silently operate with no historical sales data after restart.

**Why it happens:** In-memory caching is simpler to implement. FastAPI's in-process state does not survive across worker restarts.

**Consequences:** After any restart, replenishment calculations run with zero sales data unless the user manually triggers a reload. Reorder quantities are calculated as if no sales occurred, leading to systematic over-ordering.

**Warning signs:** Backend logs show `[SALES] Job done: 0 SKUs` or replenishment module loads with empty sales data immediately after deploy.

**Prevention:**
- Persist sales cache to Firestore as planned. Treat in-memory as a hot cache only, with Firestore as the source of truth
- On module startup, load latest valid cache from Firestore first before making any calculations
- Firestore document schema for cache: `{cached_at: timestamp, period_start: date, period_end: date, data: {sku: units_sold}}`
- Add a cache validity check: if `cached_at` is older than 7 days, trigger background refresh automatically
- Never show replenishment suggestions when `sales_data is None` — show "Cargando datos de ventas..." instead

**Phase:** Address in Phase 1 (Firestore cache design) and Phase 2 (calculation engine) defensive coding.

---

### Pitfall 6: Shopify Timezone Bug — UTC Bulk Query Misses Same-Day Orders

**What goes wrong:** Shopify's GraphQL API returns all timestamps in UTC. The bulk query filters by `created_at:>=DATE`. If the filter date is generated with `datetime.now()` (local server time or UTC), and the shop is in Colombia (UTC-5), orders placed between midnight local time and 5am UTC will fall outside the filter window.

**Why it happens:** `datetime.now()` returns local server time (UTC on EasyPanel containers), but Shopify stores orders in UTC. When building a "sales for last 6 months" query, the start date must be computed in UTC to match Shopify's storage. This is usually fine, but period boundaries (e.g., "sales from Jan 1 to today") may mis-include or exclude orders near the period edge.

**Consequences:** For replenishment, this is typically a rounding error of a few orders. However, for in-transit detection where the anchor date is the specific pending order creation date (stored in Firestore as a local timestamp), comparing against Shopify's UTC-based sales data can cause off-by-one-day errors that misclassify "absorbed" vs "not yet absorbed" sales.

**Warning signs:** Replenishment absorbed-quantity calculations differ by small amounts (~1-2 units) between runs on the same data.

**Prevention:**
- Always use `datetime.utcnow()` or `datetime.now(timezone.utc)` (not `datetime.now()`) when building Shopify query date filters
- Store all Firestore timestamps as UTC-aware ISO 8601 strings (e.g., `2026-01-15T00:00:00Z`)
- When recording a pending order's creation date in Firestore, store the Shopify order's `createdAt` UTC timestamp directly, not a local-time approximation
- Add a comment in the calculation engine explicitly noting all dates are UTC

**Phase:** Address in Phase 1 (data pipeline) and Phase 3 (order persistence schema).

---

## Moderate Pitfalls

Mistakes that cause incorrect results or significant debugging time without causing total failure.

---

### Pitfall 7: `inventoryItem.tracked = false` Produces Phantom Zero-Stock Signals

**What goes wrong:** When querying inventory levels, products with tracking disabled (`inventoryItem.tracked = false`) return `available = 0` (or null) from the API even though they are never actually out of stock — Shopify treats untracked products as always available. This causes the replenishment engine to flag them as critical reorder candidates every single run.

**Why it happens:** The Shopify API does not distinguish between "genuinely zero stock" and "tracking disabled, implicitly infinite stock" in the `inventoryLevel` query response.

**Consequences:** Replenishment suggestions are polluted with false positives for gift cards, digital products, or any product configured as untracked. Users lose trust in suggestions.

**Warning signs:** The same products always appear at the top of every replenishment suggestion with unrealistically high reorder quantities.

**Prevention:**
- Include `inventoryItem { tracked }` in every inventory query
- Filter out products where `tracked = false` before any replenishment calculation
- Optionally: surface filtered-out SKUs to admin as a data quality alert ("X productos sin seguimiento de inventario")

**Phase:** Address in Phase 2 (calculation engine input validation).

---

### Pitfall 8: Vendor Filtering Requires Client-Side Post-Processing, Not API-Side

**What goes wrong:** The replenishment module needs to show inventory and sales by vendor/supplier. Developers may expect to filter the Shopify orders bulk query by vendor (`vendor:Planeta`), but the `orders` query does NOT support filtering by lineItem vendor. The `vendor` field exists on `lineItems` but cannot be used as a query filter parameter in bulk operations.

**Why it happens:** Shopify's `orders` query filter syntax is limited to order-level fields (date, status, customer, etc.). Product-level attributes like vendor are not indexable in the orders filter.

**Consequences:** If the bulk query tries to pre-filter by vendor, it will be silently ignored or cause a user error, and the developer will receive ALL orders then wonder why vendor filtering isn't working. Alternatively, the team writes a per-vendor bulk query that exceeds the single operation limit.

**Prevention:**
- The bulk query must fetch ALL orders for the date range with ALL line items including `sku` and `vendor` fields
- Vendor filtering must happen in Python after parsing the JSONL: build a `{sku: vendor}` lookup table from product data (via a separate products bulk query or Firestore), then apply the filter in the calculation engine
- Cache the `{sku: vendor}` mapping in Firestore separately — it changes rarely and is expensive to recompute

**Phase:** Address in Phase 1 (bulk query design) and Phase 2 (calculation engine).

---

### Pitfall 9: Approval Workflow Race Condition — Double Approval by Concurrent Admins

**What goes wrong:** Two admins open the same replenishment suggestion simultaneously. Both see status `borrador`. Both click "Aprobar" at the same time. Without a transaction or optimistic lock, both writes succeed and the order is "approved twice," potentially triggering duplicate Excel generation and duplicate supplier emails.

**Why it happens:** Firestore's client SDKs use optimistic concurrency — reads and writes are independent by default. Without wrapping the status transition in a Firestore transaction, concurrent writes are both accepted.

**Consequences:** Duplicate orders sent to suppliers. This is a real business problem for a bookstore — suppliers receive two identical orders and ship double the quantity.

**Warning signs:** Two `approved_at` timestamps on the same document, or two Excel files generated for the same suggestion ID.

**Prevention:**
- Use a Firestore transaction for all state transitions: read current status inside the transaction, validate it's the expected state (`borrador`), then write the new status (`aprobado`)
- Add an `updated_by` field and `version` counter to the document; transaction must assert the version matches before writing
- UI: disable the Approve button immediately on click (optimistic UI) and show a spinner; revert if the transaction fails
- Add a server-side check in the backend endpoint: return 409 Conflict if current status is not the expected predecessor state

**Phase:** Address in Phase 3 (approval workflow).

---

### Pitfall 10: openpyxl Memory Explosion on Large Replenishment Reports

**What goes wrong:** `openpyxl` loads the entire workbook into memory before writing. For a replenishment report with 150+ vendors and thousands of SKUs, the in-memory representation can be 50x the final file size. On EasyPanel containers with limited RAM (typically 512MB–1GB), this causes the backend to OOM-kill mid-generation, and the ZIP download fails.

**Why it happens:** `openpyxl`'s default mode is read/write with full in-memory model. The existing project already uses it for cortes and ingreso, but those are smaller datasets.

**Consequences:** ZIP generation endpoint returns 500 or the process is killed silently, leaving the user with an incomplete download.

**Warning signs:** `MemoryError` in backend logs during Excel generation, or the container restarting unexpectedly after large report requests.

**Prevention:**
- Use `openpyxl` in write-only mode (`write_only=True`) for large files — it streams rows without holding the full workbook in memory
- Alternatively, switch to `xlsxwriter` for new Excel generation (streams directly to file, lower memory footprint)
- Generate one Excel per vendor before zipping, rather than building all vendors in memory simultaneously
- Set a reasonable row limit per sheet and split into multiple sheets if exceeded
- Use `io.BytesIO` for in-memory ZIP creation, `StreamingResponse` from FastAPI for download

**Phase:** Address in Phase 4 (Excel/ZIP generation).

---

### Pitfall 11: Bulk Operation JSONL URL Expires After 7 Days

**What goes wrong:** After a bulk operation completes, Shopify provides a temporary signed URL to download the JSONL file. This URL expires 7 days after the operation completes. If the Firestore sales cache stores the raw URL (not the processed data), and no one refreshes it for 7+ days, the cached "data" becomes a dead link.

**Why it happens:** Shopify uses signed S3 URLs for bulk operation output. These are not permanent.

**Consequences:** The replenishment module loads "cached" sales data, tries to download from the stored URL, gets a 403/404, and fails silently — or worse, processes empty data.

**Prevention:**
- Never store the bulk operation URL in Firestore — only store the processed output (the `{sku: quantity}` dict)
- Download and process the JSONL immediately after polling shows `COMPLETED`, within the same job execution
- Delete the URL reference after processing; only the aggregated result goes to Firestore

**Phase:** Address in Phase 1 (data pipeline), specifically the cache write logic.

---

### Pitfall 12: Lead Time Config Not Per-Vendor Causes Universal Under/Over-Stock

**What goes wrong:** If lead time is configured as a single global value ("X días para todos los proveedores"), replenishment calculations will be wrong for every vendor that differs from the average. Colombian book distributors (e.g., Norma, Planeta, Panamericana) have very different lead times: local distributors might be 3-5 days, while imports can be 30-60 days.

**Why it happens:** Global lead time is simpler to implement and test. The edge case of vendor-specific lead times is deferred as "good enough for now."

**Consequences:** Over-ordering for fast-turnaround vendors (excess stock, cash tied up) and under-ordering for slow vendors (stockouts during long lead times).

**Warning signs:** Suppliers complaining that orders are too large/small, or stockouts happening consistently for the same vendors despite replenishment being active.

**Prevention:**
- From day 1, model lead time as per-vendor configuration (can default to a global value, but must be overridable per vendor)
- Store as Firestore field on the supplier document: `lead_time_days: int`
- Include lead time in the calculation engine as an input parameter per vendor, not a global constant
- The UI configurator for replenishment should show per-vendor lead time with edit capability inline

**Phase:** Address in Phase 2 (calculation engine data model) and Phase 5 (config UI).

---

## Minor Pitfalls

---

### Pitfall 13: `financial_status:paid` Excludes Cash-on-Delivery / Manual Orders

**What goes wrong:** The existing bulk query filters `financial_status:paid`. In some retail operations, orders may be marked `pending` (awaiting payment) or `authorized` but never `paid` for internal transfers or pre-orders. These represent real inventory movement that should count toward sales velocity.

**Prevention:** Verify with the Bukz operations team which `financial_status` values represent real inventory consumption. Consider filtering by `fulfillment_status:fulfilled` instead of or in addition to `financial_status:paid` if that better reflects actual shipped units.

**Phase:** Verify in Phase 1 before building the query.

---

### Pitfall 14: Shopify Pagination Limit of 25,000 Objects Breaks Large-Store Cursors

**What goes wrong:** Shopify limits cursor-based pagination to 25,000 objects. For very large order histories, standard paginated queries will fail. Bulk Operations avoid this limit by design, but if anyone adds a fallback to standard pagination "just in case," it will silently truncate at 25,000 line items.

**Prevention:** Never implement a paginated fallback for sales data — Bulk Operations is the mandatory approach for historical sales. Document this explicitly in code comments.

**Phase:** Awareness in Phase 1; no specific action needed if Bulk Operations is used exclusively.

---

### Pitfall 15: FastAPI `BackgroundTasks` Does Not Survive Worker Restarts for Long Jobs

**What goes wrong:** The current `_sales_worker()` runs in a `threading.Thread`. If EasyPanel restarts the uvicorn worker mid-job (which can happen during deploys or memory pressure), the thread is killed and the job state (`_sales_job["running"] = True`) is left as stale — no cleanup runs. The next request to `/sales/load` will see `running = True` and refuse to start a new job, effectively deadlocking the sales load feature.

**Prevention:**
- Add a `started_at` timestamp to the job state; if `running = True` but `started_at` is older than 15 minutes, treat the job as stale and reset it
- Persist job status to Firestore so it survives restarts; on startup, check for orphaned "running" jobs and reset them
- Use this same pattern for the replenishment bulk job

**Phase:** Address in Phase 1 when designing the replenishment job infrastructure.

---

### Pitfall 16: Shopify GQL `quantity` on LineItem vs `currentQuantity` — Returns Pre-Return Value

**What goes wrong:** The `quantity` field on a line item in the orders API reflects the quantity at order time. The `currentQuantity` field reflects the quantity after any edits or partial cancellations. Using `quantity` instead of `currentQuantity` in the sales bulk query overstates sales for orders that were subsequently edited.

**Prevention:** Use `currentQuantity` in the line item node of the bulk operations query to capture the post-edit, post-cancellation quantity.

**Phase:** Address in Phase 1 when writing the bulk query.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Bulk Operations pipeline | `currentBulkOperation` deprecation | Use `bulkOperation(id:)` from day 1 (Pitfall 1) |
| Bulk Operations pipeline | `OPERATION_IN_PROGRESS` conflict with ingreso module | Check existing operation before starting (Pitfall 2) |
| Bulk query schema design | JSONL parent-child includes refunded items | Use `currentQuantity`, plan for refund subtraction (Pitfall 3, 16) |
| Firestore cache design | In-memory cache lost on restart | Write processed data to Firestore immediately (Pitfall 5, 11) |
| In-transit calculation engine | Multiple pending orders per SKU | Model as list, not scalar; partial absorption logic (Pitfall 4) |
| In-transit calculation engine | Timezone mismatch in date comparison | Use UTC throughout (Pitfall 6) |
| Calculation inputs | Untracked products inflate stockout signals | Filter `tracked=false` before calculation (Pitfall 7) |
| Calculation inputs | Vendor filtering not supported at API level | Client-side post-processing with cached SKU->vendor map (Pitfall 8) |
| Approval workflow | Concurrent admin approvals | Firestore transactions for state transitions (Pitfall 9) |
| Excel/ZIP generation | Memory explosion with many vendors | write-only mode or xlsxwriter, per-vendor generation (Pitfall 10) |
| Job infrastructure | Stale `running=true` on restart | Timeout-based staleness check + Firestore persistence (Pitfall 15) |

---

## Sources

- [Shopify Bulk Operations Official Docs](https://shopify.dev/docs/api/usage/bulk-operations/queries) — COMPLETED status, polling, URL expiry, concurrent limits (HIGH confidence)
- [BulkOperation GraphQL Object](https://shopify.dev/docs/api/admin-graphql/latest/objects/BulkOperation) — errorCode, objectCount, partialDataUrl (HIGH confidence)
- [Shopify 2025-01 Release Notes](https://shopify.dev/docs/api/release-notes/2025-01) — API deprecation timeline (HIGH confidence)
- [Shopify REST API Deprecation — October 2024](https://shopify.dev/docs/api/usage/limits) — GraphQL-only requirement (HIGH confidence)
- [bulkOperationRunQuery Mutation](https://shopify.dev/docs/api/admin-graphql/latest/mutations/bulkoperationrunquery) — OPERATION_IN_PROGRESS error (HIGH confidence)
- [Shopify JSONL Parent-Child Community Thread](https://community.shopify.com/t/do-the-children-in-a-bulk-operation-jsonl-with-nested-connections-come-right-after-their-parent/165909) — `__parentId` behavior (MEDIUM confidence)
- [Shopify Bulk Operation Finish Webhook Changelog](https://shopify.dev/changelog/new-webhook-topic-notifies-when-a-bulk-operation-has-finished) — webhook unreliability (HIGH confidence)
- [Firebase Transaction Data Contention](https://firebase.google.com/docs/firestore/transaction-data-contention) — Optimistic concurrency, 270s limit, 500 doc max (HIGH confidence)
- [REST to GraphQL Timezone Issue — Community Forum](https://community.shopify.dev/t/rest-to-graphql-order-timezone-issue/3869) — UTC timestamps in GraphQL (MEDIUM confidence)
- [openpyxl Performance Docs](https://openpyxl.readthedocs.io/en/stable/performance.html) — 50x memory ratio, write-only mode (HIGH confidence)
- [Flieber — 7 Replenishment Mistakes](https://www.flieber.com/blog/7-costly-inventory-replenishment-mistakes-to-avoid-in-2022) — domain replenishment pitfalls (MEDIUM confidence)
- [Fabrikator — 11 Replenishment Mistakes 2025](https://www.fabrikator.io/blog/how-can-automatic-inventory-replenishment-go-wrong) — domain replenishment pitfalls (MEDIUM confidence)
- [Netstock — Reorder Point Formula](https://www.netstock.com/blog/reorder-point-formula/) — safety stock calculation requirements (MEDIUM confidence)
- Existing codebase audit: `backend/services/shopify_service.py`, `backend/routers/ingreso.py`, `backend/config.py` — confirms API version, polling pattern, in-memory cache, and deprecation exposure (HIGH confidence — direct code review)
