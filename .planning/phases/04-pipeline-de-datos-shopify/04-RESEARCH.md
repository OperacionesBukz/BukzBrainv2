# Phase 4: Pipeline de Datos Shopify - Research

**Researched:** 2026-03-30
**Domain:** FastAPI backend — Shopify Bulk Operations, inventory GraphQL, Firestore persistence, background threading
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Stay on Shopify API `2025-01`. Do NOT upgrade to 2026-01.
- **D-02:** Use `currentBulkOperation` query for polling (correct for 2025-01). Refactor to `bulkOperation(id:)` is a future improvement, not this phase.
- **D-03:** Use `currentQuantity` (not `quantity`) in the bulk orders query.
- **D-04:** Bulk query scope: `financial_status:paid` orders only.
- **D-05:** Date range: configurable, default 6 months (180 days from today).
- **D-06:** Extract from line items: `sku`, `currentQuantity`, and parent order `createdAt`.
- **D-07:** Cache granularity: aggregate by SKU + month (not daily).
- **D-08:** Cache storage: Firestore collection `sales_cache`, one document per cache run with subcollection for per-SKU data if document exceeds 1MB.
- **D-09:** Cache invalidation: >24 hours since last refresh -> stale.
- **D-10:** Cache includes metadata: `last_refreshed`, `date_range_start`, `date_range_end`, `sku_count`, `status`.
- **D-11:** New dedicated router `backend/routers/reposiciones.py`. Import shared helpers from `shopify_service.py`.
- **D-12:** Endpoints:
  - `GET /api/reposiciones/locations`
  - `GET /api/reposiciones/vendors`
  - `GET /api/reposiciones/inventory` (params: `location_id`, `vendors[]`)
  - `POST /api/reposiciones/sales/refresh`
  - `GET /api/reposiciones/sales/status`
  - `GET /api/reposiciones/sales/data`
- **D-13:** Before starting a bulk operation, check `currentBulkOperation`. If RUNNING, return HTTP 409 `{"error": "OPERATION_IN_PROGRESS"}`.
- **D-14:** Job state (operation_id, status, started_at) persisted in Firestore `bulk_op_state` document.
- **D-15:** Vendor list sourced from Shopify products' `vendor` field.
- **D-16:** Vendor list endpoint returns distinct vendor names with product count per vendor.

### Claude's Discretion

- Background thread vs async: Claude can decide the best concurrency pattern (existing threading pattern from ingreso is fine to reuse).
- JSONL parsing approach: stdlib `json.loads()` per line (no library needed).
- Error handling granularity for individual Shopify API failures.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHOP-01 | Backend obtiene lista de Locations (sedes) de Shopify y las expone como endpoint | `get_locations()` in shopify_service.py already returns `{name: id}` — wire directly into new router |
| SHOP-02 | Backend obtiene niveles de inventario por Location para productos filtrados por proveedor | Use existing REST `/inventory_levels.json` pattern from `process_batch_inventory()`, add vendor filter via GraphQL `productVariants` query |
| SHOP-03 | Backend obtiene lista de proveedores únicos desde productos de Shopify | New GraphQL query on `products` with pagination, extract `vendor` field, deduplicate |
| SHOP-04 | Backend ejecuta Bulk Operation para extraer ventas históricas (6 meses configurable) con `currentQuantity` | Adapt `start_bulk_operation()` and `load_sales_sync()` — change date range to 180 days, switch `quantity` to `currentQuantity`, add `createdAt` to query |
| SHOP-05 | Backend persiste ventas agregadas por SKU/mes en Firestore como cache (invalidación >24h) | New Firestore writes to `sales_cache` collection after JSONL processing |
| SHOP-06 | Backend reutiliza cache de ventas en ejecuciones posteriores (solo jala delta desde última actualización) | On `POST /sales/refresh`: check `last_refreshed` in `sales_cache`; if <24h return cached data; if stale, trigger new Bulk Op |
| SHOP-07 | Backend implementa guard para evitar conflicto de bulk operations simultáneas con módulo ingreso | Check `currentBulkOperation` before `bulkOperationRunQuery`; return 409 if status is RUNNING or CREATED |
</phase_requirements>

---

## Summary

Phase 4 is a pure backend phase: build `backend/routers/reposiciones.py` and adapt `backend/services/shopify_service.py` to expose Shopify locations, inventory, vendors, and a bulk-operations-based sales cache to the downstream calculation engine.

The critical insight is that almost all infrastructure already exists in the codebase. `get_locations()`, `start_bulk_operation()`, `check_bulk_operation_status()`, `download_and_process_bulk_results()`, `search_inventory()`, and `ShopifyThrottler` are all live in `shopify_service.py`. The background threading pattern (daemon thread + in-memory status dict) is proven in `ingreso.py`. This phase is primarily: adapt the bulk query (add `createdAt`, switch to `currentQuantity`, narrow to 180 days), wire the results into Firestore instead of memory, add a conflict guard, and expose the new router endpoints.

The one genuinely new capability is the vendor list endpoint (SHOP-03), which requires a new paginated GraphQL query on the `products` connection. All other endpoints reuse existing service functions with minor parameter changes.

**Primary recommendation:** Clone the `_sales_worker` / `_sales_job` threading pattern from `ingreso.py` into `reposiciones.py`, adapt the bulk query, persist results to Firestore `sales_cache`, add the `currentBulkOperation` guard (409 on conflict), and expose all 6 endpoints. No new libraries needed.

---

## Standard Stack

### Core (all already in requirements.txt — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastapi` | >=0.115.0 | Router, request validation, HTTP responses | Already in prod; all other routers use it |
| `requests` | >=2.31.0 | Shopify GraphQL and REST calls | Already used by shopify_service.py throughout |
| `firebase-admin` | >=6.4.0 | Firestore writes for sales_cache and bulk_op_state | Already used in webhooks.py via firebase_service.py |
| `python-dotenv` | >=1.0.0 | Read SHOPIFY_ACCESS_TOKEN, SHOPIFY_SHOP_URL from env | Already wired in config.py |
| `threading` (stdlib) | stdlib | Background worker for Bulk Operation polling | Same pattern as ingreso.py `_sales_worker` |
| `json` (stdlib) | stdlib | JSONL parsing: `json.loads()` per line | Already used in download_and_process_bulk_results() |
| `datetime` (stdlib) | stdlib | Compute 180-day lookback date, timestamp comparisons | Already used in shopify_service.py |

### No New Dependencies Required

The entire phase is implementable with the existing stack. Confirmed by `.planning/research/STACK.md`.

**Installation:** None needed — all libraries are in `backend/requirements.txt`.

---

## Architecture Patterns

### New File to Create

```
backend/
  routers/
    reposiciones.py          <- NEW: all 6 endpoints for Phase 4
  services/
    shopify_service.py       <- MODIFY: add vendors query + adapt bulk query
```

### Pattern 1: Router Registration

Register in `backend/main.py` alongside existing routers:

```python
# backend/main.py — add after existing imports
from routers import reposiciones

# In the router registration block, with auth:
app.include_router(reposiciones.router, dependencies=_auth)
```

The `_auth = [Depends(verify_firebase_token)]` dependency is already defined.

### Pattern 2: Background Thread Worker (clone from ingreso.py)

The threading pattern for the Bulk Operation job is proven and must be cloned verbatim:

```python
# backend/routers/reposiciones.py

import threading
from datetime import datetime, timezone

# In-memory job state (supplemented by Firestore for restart survival)
_reposiciones_job: dict = {
    "running": False,
    "error": None,
    "started_at": None,
    "operation_id": None,
}

def _sales_refresh_worker(date_range_days: int = 180):
    """Background worker: Bulk Op -> JSONL parse -> Firestore write."""
    try:
        # 1. Start bulk operation
        operation_id, error = shopify_service.start_bulk_operation_reposiciones(date_range_days)
        if error:
            _reposiciones_job["error"] = error
            return

        # Persist job state to Firestore (survives restart)
        _persist_job_state(operation_id, "RUNNING")

        # 2. Poll until complete (same loop as load_sales_sync)
        for _ in range(120):
            result = shopify_service.check_bulk_operation_status()
            status = result.get("status")
            if status == "COMPLETED":
                url = result.get("url")
                sales_by_sku_month = _download_and_aggregate(url, date_range_days)
                _write_sales_cache_to_firestore(sales_by_sku_month)
                _persist_job_state(operation_id, "COMPLETED")
                return
            elif status in ("FAILED", "CANCELED"):
                _reposiciones_job["error"] = f"Bulk Op {status}"
                _persist_job_state(operation_id, status)
                return
            time.sleep(5)

        _reposiciones_job["error"] = "Timeout"
    except Exception as e:
        _reposiciones_job["error"] = str(e)
    finally:
        _reposiciones_job["running"] = False


@router.post("/sales/refresh")
def sales_refresh(date_range_days: int = 180):
    """
    Triggers Bulk Operation for sales history. Returns 409 if one is already running.
    """
    # Guard: check for stale jobs (>15 min means worker died)
    if _reposiciones_job["running"]:
        started = _reposiciones_job.get("started_at")
        if started and (datetime.now(timezone.utc) - started).seconds < 900:
            raise HTTPException(status_code=409, detail={"error": "OPERATION_IN_PROGRESS"})
        # Stale job: reset and allow restart
        _reposiciones_job["running"] = False

    # Guard: check Shopify for any running bulk op (from ingreso or other)
    current = shopify_service.check_bulk_operation_status()
    if current.get("status") in ("RUNNING", "CREATED"):
        raise HTTPException(status_code=409, detail={"error": "OPERATION_IN_PROGRESS",
                                                       "message": "Hay una operación en curso. Espera o cancela la actual."})

    # Check cache freshness first (SHOP-06)
    cache_doc = _get_sales_cache_meta()
    if cache_doc and not _is_cache_stale(cache_doc):
        return {"status": "cached", "message": "Cache vigente, no se necesita refresh",
                "last_refreshed": cache_doc.get("last_refreshed")}

    _reposiciones_job["running"] = True
    _reposiciones_job["error"] = None
    _reposiciones_job["started_at"] = datetime.now(timezone.utc)
    thread = threading.Thread(target=_sales_refresh_worker, args=(date_range_days,), daemon=True)
    thread.start()
    return {"status": "running", "message": "Bulk Operation iniciada en background"}
```

### Pattern 3: Bulk Query for Sales (adapted from existing start_bulk_operation)

The existing `start_bulk_operation()` uses `quantity` and 12 months. The new version needs:

- `currentQuantity` instead of `quantity`
- `createdAt` on the order node (for Phase 5 in-transit detection)
- Configurable date range (default 180 days)

```graphql
# New bulk query for reposiciones (not the ingreso query)
mutation {
  bulkOperationRunQuery(
    query: """
    {
      orders(query: "created_at:>='DATE_START' financial_status:paid") {
        edges {
          node {
            id
            createdAt
            lineItems {
              edges {
                node {
                  sku
                  currentQuantity
                }
              }
            }
          }
        }
      }
    }
    """
  ) {
    bulkOperation { id status }
    userErrors { field message }
  }
}
```

The JSONL output will have lines like:
- `{"id": "gid://shopify/Order/123", "createdAt": "2025-10-01T14:00:00Z"}` — order line
- `{"sku": "9780...", "currentQuantity": 2, "__parentId": "gid://shopify/Order/123"}` — line item line

### Pattern 4: JSONL Aggregation by SKU + Month

```python
def _download_and_aggregate(url: str, date_range_days: int) -> dict:
    """
    Downloads JSONL, aggregates currentQuantity by SKU + year-month.
    Returns {sku: {"2025-10": 5, "2025-11": 12, ...}}
    """
    orders_by_id = {}        # {order_gid: {"createdAt": "2025-10-01T..."}}
    sales_by_sku_month = {}  # {sku: {"2025-10": int, ...}}

    response = requests.get(url, timeout=120, stream=True)
    for line in response.iter_lines():
        if not line:
            continue
        data = json.loads(line.decode("utf-8"))

        if "createdAt" in data:
            # Order parent record
            orders_by_id[data["id"]] = {"createdAt": data["createdAt"]}
        elif "sku" in data and "currentQuantity" in data:
            # Line item child record
            sku = str(data["sku"]).strip()
            qty = int(data.get("currentQuantity") or 0)
            if not sku or qty <= 0:
                continue
            parent_id = data.get("__parentId", "")
            order = orders_by_id.get(parent_id, {})
            created_at = order.get("createdAt", "")
            if created_at:
                year_month = created_at[:7]  # "2025-10"
            else:
                year_month = "unknown"

            if sku not in sales_by_sku_month:
                sales_by_sku_month[sku] = {}
            sales_by_sku_month[sku][year_month] = (
                sales_by_sku_month[sku].get(year_month, 0) + qty
            )

    return sales_by_sku_month
```

**Critical note:** The JSONL is streamed sequentially. Order lines appear BEFORE their line-item children — this ordering is guaranteed by Shopify's bulk export format. Build the `orders_by_id` lookup on-the-fly.

### Pattern 5: Firestore Cache Write

```python
def _write_sales_cache_to_firestore(sales_by_sku_month: dict, date_range_days: int = 180):
    """Writes aggregated sales to Firestore sales_cache collection."""
    from services.firebase_service import get_firestore_db
    from google.cloud.firestore_v1 import SERVER_TIMESTAMP
    from datetime import datetime, timezone, timedelta
    import json

    db = get_firestore_db()
    now = datetime.now(timezone.utc)
    doc_data = {
        "last_refreshed": now.isoformat(),
        "date_range_start": (now - timedelta(days=date_range_days)).strftime("%Y-%m-%d"),
        "date_range_end": now.strftime("%Y-%m-%d"),
        "sku_count": len(sales_by_sku_month),
        "status": "ready",
    }

    # Check if data fits in 1MB (Firestore limit)
    # Rough estimate: 1 SKU entry ~100 bytes, 10,000 SKUs = 1MB
    if len(sales_by_sku_month) <= 8000:
        doc_data["data"] = sales_by_sku_month
        db.collection("sales_cache").document("6m_global").set(doc_data)
    else:
        # Metadata doc only, data in subcollection chunks
        db.collection("sales_cache").document("6m_global").set(doc_data)
        # Write in chunks of 500 SKUs
        skus = list(sales_by_sku_month.items())
        for i, chunk_start in enumerate(range(0, len(skus), 500)):
            chunk = dict(skus[chunk_start:chunk_start + 500])
            db.collection("sales_cache").document("6m_global") \
              .collection("chunks").document(str(i)).set({"data": chunk})
```

### Pattern 6: Vendors Endpoint (New GraphQL Query)

This is the only net-new query in the phase. Use paginated `products` connection:

```python
def get_vendors_from_shopify() -> list[dict]:
    """Returns distinct vendor names with product count. Paginated via cursor."""
    graphql_url = settings.get_graphql_url()
    headers = settings.get_shopify_headers()

    vendor_counts = {}
    cursor = None

    while True:
        after_clause = f', after: "{cursor}"' if cursor else ""
        query = """
        {
          products(first: 250%s) {
            pageInfo { hasNextPage endCursor }
            edges {
              node { vendor }
            }
          }
        }
        """ % after_clause

        _throttler.wait_if_needed()
        resp = requests.post(graphql_url, json={"query": query}, headers=headers, timeout=30)
        _throttler.update_from_response(resp)

        if resp.status_code != 200:
            break

        data = resp.json().get("data", {}).get("products", {})
        for edge in data.get("edges", []):
            vendor = edge["node"].get("vendor", "").strip()
            if vendor:
                vendor_counts[vendor] = vendor_counts.get(vendor, 0) + 1

        page_info = data.get("pageInfo", {})
        if not page_info.get("hasNextPage"):
            break
        cursor = page_info.get("endCursor")

    return [{"name": v, "product_count": c} for v, c in sorted(vendor_counts.items())]
```

### Pattern 7: Inventory Endpoint (adapted from search_inventory)

The existing `search_inventory()` requires an `isbn_list` and quantities. For the reposiciones module, the need is: get ALL inventory for a location, filtered by vendor. Use a different GraphQL approach — query through the `location` node's `inventoryLevels`:

```graphql
{
  location(id: "gid://shopify/Location/LOCATION_ID") {
    inventoryLevels(first: 250, after: CURSOR) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          quantities(names: ["available"]) {
            name
            quantity
          }
          item {
            id
            sku
            variant {
              product {
                vendor
                title
              }
            }
          }
        }
      }
    }
  }
}
```

Filter in Python after fetching: only keep items where `vendor in vendor_filter`.

### Pattern 8: Bulk Op State Persistence in Firestore

Per D-14, job state must survive backend restarts:

```python
BULK_OP_STATE_DOC = "bulk_op_state"
BULK_OP_COLLECTION = "reposiciones_meta"

def _persist_job_state(operation_id: str, status: str):
    from services.firebase_service import get_firestore_db
    from datetime import datetime, timezone
    db = get_firestore_db()
    db.collection(BULK_OP_COLLECTION).document(BULK_OP_STATE_DOC).set({
        "operation_id": operation_id,
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
```

On router startup (module import), read this doc to detect orphaned jobs.

### Recommended Project Structure

```
backend/
  routers/
    reposiciones.py          <- NEW: APIRouter + 6 endpoints + worker thread
  services/
    shopify_service.py       <- ADD: get_vendors_from_shopify(),
                                      start_bulk_operation_reposiciones(),
                                      get_inventory_by_location()
  main.py                    <- ADD: import + include_router for reposiciones
```

### Anti-Patterns to Avoid

- **Copying `load_sales_sync()` verbatim:** The existing function uses `quantity` not `currentQuantity` and has a 12-month window. Clone and adapt, do not reuse directly.
- **Forgetting `createdAt` in the bulk query:** Phase 5 in-transit detection depends on per-order timestamps. If `createdAt` is absent from the bulk query now, Phase 5 requires a full re-run of all sales data.
- **Storing JSONL URL in Firestore:** The Shopify-signed JSONL URL expires in 7 days. Only store processed output (sku -> monthly dict) in Firestore.
- **Running vendor query without pagination:** Bukz has 150+ vendors across thousands of products. Without `pageInfo.hasNextPage` cursor loop, results are truncated at 250 products.
- **Not checking `currentBulkOperation` before starting:** The ingreso module also uses Bulk Operations. Without the guard, two simultaneous modules will produce a `userError` from Shopify and the job will silently fail.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP rate limiting to Shopify | Custom delay logic | `ShopifyThrottler` (existing in shopify_service.py) | Already handles REST header parsing, GraphQL cost extensions, 429 backoff |
| Location fetching | New GraphQL locations query | `get_locations()` (existing in shopify_service.py) | Proven, handles both GraphQL and REST fallback, returns `{name: id}` dict |
| Bulk operation start | New mutation builder | `start_bulk_operation()` pattern (adapt, not rewrite) | The mutation shape and error handling are already correct |
| Bulk operation polling | New status polling loop | `check_bulk_operation_status()` (existing) | Uses `currentBulkOperation` which is correct for API version 2025-01 |
| Firebase connection | New SDK initialization | `get_firestore_db()` from firebase_service.py | Idempotent, handles all credential methods, already in prod |
| Auth on new router | Re-implementing token validation | `Depends(verify_firebase_token)` via `dependencies=_auth` in main.py | Same dependency as all other routers |

**Key insight:** This phase is assembly, not invention. 80% of the required code exists — the work is adapting existing functions (new query fields, new persistence target) and creating the thin router layer on top.

---

## Common Pitfalls

### Pitfall 1: `currentQuantity` vs `quantity` in Bulk Query
**What goes wrong:** The existing `start_bulk_operation()` uses `quantity` (line item field at order time). This inflates sales for orders that were partially edited or cancelled after placement.
**Why it happens:** `quantity` was the original field; `currentQuantity` is the post-edit value.
**How to avoid:** The new bulk query for reposiciones MUST use `currentQuantity`. Decision D-03 locks this. Never copy from the existing ingreso bulk query.
**Warning signs:** Sales figures consistently higher than Shopify Analytics dashboard.

### Pitfall 2: JSONL Parent-Child Order Dependence
**What goes wrong:** The JSONL parser must handle two record types interleaved: order objects (have `createdAt`) and line item objects (have `sku`, `currentQuantity`, `__parentId`). If the parser only looks for `sku`, it loses the order date, making per-month aggregation impossible.
**Why it happens:** Shopify Bulk Operations JSONL is flattened — each nested level becomes its own line, linked by `__parentId`.
**How to avoid:** Two-pass state: build `orders_by_id` dict first (from lines with `createdAt`), then resolve `__parentId` when processing line items. Since Shopify guarantees parent appears before children in JSONL, a single sequential pass works.
**Warning signs:** `year_month = "unknown"` appearing frequently in aggregated data.

### Pitfall 3: OPERATION_IN_PROGRESS Conflict with Ingreso Module
**What goes wrong:** If a user triggers ingreso's `/sales/load` while a reposiciones job is running (or vice versa), Shopify returns `userErrors: "A bulk operation for this app is already in progress"`. Without the guard, the reposiciones worker silently receives `(None, error_message)` and the background job exits with error.
**Why it happens:** Shopify API 2025-01 allows only one bulk operation per app per shop at a time.
**How to avoid:** Decision D-13 mandates checking `currentBulkOperation` status before calling `bulkOperationRunQuery`. Return HTTP 409 with `{"error": "OPERATION_IN_PROGRESS"}` if status is `RUNNING` or `CREATED`.
**Warning signs:** `_reposiciones_job["error"]` populated with "userError" immediately after job start.

### Pitfall 4: Stale `running=True` After Worker Crash
**What goes wrong:** If the EasyPanel container restarts mid-job, `_reposiciones_job["running"]` remains `True` in the new process (initialized to `False` at module import). BUT the Firestore `bulk_op_state` doc shows `status: "RUNNING"`. The `/sales/refresh` endpoint checks Firestore on startup and must handle this gracefully.
**Why it happens:** In-memory state is reset on restart; Firestore persists.
**How to avoid:** On module startup, read `bulk_op_state` from Firestore. If `status == "RUNNING"` and `updated_at` is older than 15 minutes, reset status to `"STALE"` and allow new jobs. This is the Pitfall 15 prevention from PITFALLS.md.
**Warning signs:** `/sales/status` shows "running" permanently after a deploy.

### Pitfall 5: Firestore 1MB Document Limit on sales_cache
**What goes wrong:** One Firestore document is limited to 1MB. With 15,000 SKUs × 6 months of data, the `sales_cache/6m_global` document may approach or exceed this.
**Why it happens:** Decision D-08 accounts for this: "one document per cache run with subcollection for per-SKU data if document exceeds 1MB."
**How to avoid:** Estimate data size before writing. If `len(sales_by_sku_month) > 8000`, write metadata to the main doc and split SKU data into subcollection chunks of 500 SKUs each. Log a warning when this path is taken.
**Warning signs:** Firestore write error `"INVALID_ARGUMENT: Value for argument 'document_data' is too large (>1048487 bytes)"`.

### Pitfall 6: Vendors Query Without Cursor Pagination Returns Only 250 Products
**What goes wrong:** Bukz has a large catalog. A single `products(first: 250)` query returns at most 250 products. If vendor uniqueness is computed only from those 250, minority vendors (alphabetically after position 250) are silently omitted.
**Why it happens:** Shopify GraphQL requires explicit cursor pagination for result sets beyond 250.
**How to avoid:** Implement cursor-based pagination loop using `pageInfo { hasNextPage endCursor }`. Continue fetching until `hasNextPage == false`.
**Warning signs:** Vendor list in frontend multi-select shows fewer vendors than users expect.

### Pitfall 7: UTC vs Local Time in Date Filters
**What goes wrong:** `datetime.now()` returns the server's local time. EasyPanel containers run in UTC, but using naive datetimes can cause off-by-one-day errors at period boundaries when comparing Shopify UTC timestamps to Firestore-stored dates.
**Why it happens:** `datetime.now()` is timezone-naive. Shopify timestamps are always UTC ISO 8601.
**How to avoid:** Always use `datetime.now(timezone.utc)` (not `datetime.now()`) when computing date filters. Format as `%Y-%m-%dT00:00:00Z` for Shopify query parameters.
**Warning signs:** Inconsistent SKU counts between runs executed at similar times; off-by-one on the most recent month's data.

---

## Code Examples

Verified patterns from existing codebase:

### Registering the New Router (backend/main.py pattern)
```python
# Source: backend/main.py (existing pattern — clone for reposiciones)
from routers import reposiciones
app.include_router(reposiciones.router, dependencies=_auth)
```

### Router Prefix Pattern
```python
# Source: backend/routers/ingreso.py line 17
router = APIRouter(prefix="/api/reposiciones", tags=["Reposiciones"])
```

### Firestore Write Pattern
```python
# Source: backend/services/firebase_service.py (existing)
from services.firebase_service import get_firestore_db
db = get_firestore_db()
db.collection("sales_cache").document("6m_global").set({...})
```

### Existing `check_bulk_operation_status()` Response Shape
```python
# Source: backend/services/shopify_service.py lines 888-920
# Returns: {"status": "RUNNING"|"COMPLETED"|"FAILED"|"CANCELED"|None,
#           "url": str|None, "object_count": int, "error_code": str|None}
result = shopify_service.check_bulk_operation_status()
if result.get("status") in ("RUNNING", "CREATED"):
    raise HTTPException(status_code=409, detail={"error": "OPERATION_IN_PROGRESS"})
```

### Existing `get_locations()` Return Shape
```python
# Source: backend/services/shopify_service.py lines 113-168
# Returns: {"Sede Bogota": 12345678, "Sede Medellin": 87654321}
locations = shopify_service.get_locations()
# For the endpoint response:
return {"locations": [{"name": k, "id": v} for k, v in locations.items()]}
```

### Background Thread Pattern (clone from ingreso.py lines 224-263)
```python
# Source: backend/routers/ingreso.py
_sales_job: dict = {"running": False, "error": None}

def _sales_worker():
    try:
        # ... work ...
    except Exception as e:
        _sales_job["error"] = str(e)
    finally:
        _sales_job["running"] = False

thread = threading.Thread(target=_sales_worker, daemon=True)
thread.start()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `quantity` in line items | `currentQuantity` | Always existed — just not used | Excludes post-edit/refund inflation |
| `currentBulkOperation` polling | `bulkOperation(id:)` polling | API 2026-01+ | NOT applicable to this phase (locked to 2025-01) |
| In-memory sales cache | Firestore-persisted sales cache | This phase introduces it | Survives backend restarts |
| 12-month sales window (ingreso) | 6-month configurable window (reposiciones) | This phase | Better velocity calculation for replenishment |

**Deprecated/outdated:**
- `currentBulkOperation`: Deprecated in 2026-01 API — acceptable for this phase since API is locked to 2025-01 (D-01, D-02). Will need migration when API is upgraded.

---

## Open Questions

1. **`financial_status:paid` vs `fulfillment_status:fulfilled` for real sales**
   - What we know: Decision D-04 locks to `financial_status:paid`.
   - What's unclear: A pending todo in STATE.md notes: "Confirmar con equipo Bukz qué `financial_status` representa ventas reales." This should have been confirmed before implementing.
   - Recommendation: Proceed with `financial_status:paid` as decided. Add a code comment noting this was confirmed as the intent. If incorrect, only the bulk query filter needs updating — no structural change.

2. **Firestore `sales_cache` document size in production**
   - What we know: D-08 and D-09 account for it. Subcollection fallback is planned.
   - What's unclear: Actual Bukz catalog size (SKU count) is unknown until first run.
   - Recommendation: Implement both paths (inline and subcollection) from the start. Test with a sample run in development to measure document size.

3. **`reposiciones_meta` collection for `bulk_op_state` — not yet in firestore.rules**
   - What we know: firestore.rules has no rules for new reposiciones collections.
   - What's unclear: `bulk_op_state` is written by the backend (firebase-admin SDK bypasses rules). But if any future frontend reads are needed, rules must be added.
   - Recommendation: For Phase 4, backend-only writes work without rules changes (Admin SDK bypasses rules). Add a comment in code: "Firestore rules for sales_cache and reposiciones_meta needed before frontend reads."

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | Backend execution | Yes | 3.13.7 | — |
| `fastapi` | New router | Yes (in requirements.txt) | >=0.115.0 | — |
| `requests` | Shopify API calls | Yes (in requirements.txt) | >=2.31.0 | — |
| `firebase-admin` | Firestore writes | Yes (in requirements.txt) | >=6.4.0 | — |
| Shopify Admin API (2025-01) | All SHOP-* requirements | Yes (existing connection verified) | 2025-01 | — |
| Firestore (`sales_cache` collection) | SHOP-05, SHOP-06 | Yes (collection created on first write — Firestore schemaless) | — | — |
| SHOPIFY_ACCESS_TOKEN, SHOPIFY_SHOP_URL env vars | Config | Yes (already configured in EasyPanel) | — | — |

**Missing dependencies with no fallback:** None — all dependencies are confirmed available.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) — no backend test framework currently configured |
| Config file | `vitest.config.ts` (frontend only) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

**Note:** The existing test infrastructure (`src/test/`) covers frontend React components only. There are no existing Python/pytest tests for the backend. Phase 4 is pure backend — manual validation against a live Shopify dev store or staging environment is the primary verification method.

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHOP-01 | GET /api/reposiciones/locations returns locations list | smoke (curl) | `curl $BACKEND/api/reposiciones/locations -H "Authorization: Bearer $TOKEN"` | No — manual |
| SHOP-02 | GET /api/reposiciones/inventory returns stock by location+vendor | smoke (curl) | `curl "$BACKEND/api/reposiciones/inventory?location_id=X"` | No — manual |
| SHOP-03 | GET /api/reposiciones/vendors returns vendor names | smoke (curl) | `curl $BACKEND/api/reposiciones/vendors` | No — manual |
| SHOP-04 | POST /api/reposiciones/sales/refresh starts bulk op, uses currentQuantity | smoke (curl) + manual Shopify verification | `curl -X POST $BACKEND/api/reposiciones/sales/refresh` | No — manual |
| SHOP-05 | Firestore sales_cache contains SKU+month aggregation after refresh | manual Firestore console | — | No — manual |
| SHOP-06 | Second call to /sales/refresh within 24h returns cached response | smoke | Two successive curls, verify `status: "cached"` on second | No — manual |
| SHOP-07 | 409 returned when bulk op is in progress | smoke (curl) | Start job, immediately call refresh again | No — manual |

### Wave 0 Gaps

No automated tests exist for the backend. All Phase 4 validation is smoke-tested via curl against the running backend. The planner should include a verification step for each endpoint in the implementation plan, with example curl commands.

*(If a pytest setup is desired: `pip install pytest httpx` and create `backend/tests/test_reposiciones.py`. Not required for this phase.)*

---

## Project Constraints (from CLAUDE.md)

These directives apply to Phase 4 and the planner must verify compliance:

| Directive | Applies To Phase 4? | Compliance Check |
|-----------|---------------------|-----------------|
| UI en Español | No — Phase 4 is pure backend, no UI text | N/A |
| No modificar `src/components/ui/` | No — no frontend changes in Phase 4 | N/A |
| No commitear `.env` | Yes | Ensure no secrets in committed files |
| No modificar `firestore.rules` sin confirmación | Yes — new collections need rules eventually | Do NOT modify firestore.rules in Phase 4. Backend Admin SDK bypasses rules. Add TODO comment. |
| No agregar dependencias sin confirmar | Yes | Confirmed: no new dependencies (stack research verifies this) |
| Al crear páginas nuevas, registrar en `App.tsx` y `navigation_permissions` | No — Phase 4 adds no pages | N/A |
| Mantener soporte dark/light mode | No — Phase 4 is pure backend | N/A |
| Backend patterns: FastAPI routers, errores, concurrencia | Yes | Follow ingreso.py patterns exactly |

---

## Sources

### Primary (HIGH confidence)
- Direct codebase: `backend/services/shopify_service.py` — `get_locations()`, `start_bulk_operation()`, `check_bulk_operation_status()`, `download_and_process_bulk_results()`, `search_inventory()`, `ShopifyThrottler`, `load_sales_sync()`
- Direct codebase: `backend/routers/ingreso.py` — `_sales_worker()`, `_sales_job`, `/sales/load`, `/sales/status` threading pattern
- Direct codebase: `backend/services/firebase_service.py` — `get_firestore_db()` pattern
- Direct codebase: `backend/config.py` — Settings class, API version 2025-01, helper methods
- Direct codebase: `backend/main.py` — router registration pattern, auth dependency
- Direct codebase: `firestore.rules` — existing collections, confirms `sales_cache` and `reposiciones_meta` are absent (need to be added for frontend reads)
- `.planning/research/STACK.md` — no new dependencies needed (HIGH confidence)
- `.planning/research/PITFALLS.md` — critical pitfalls for bulk ops, cache, and job state (HIGH confidence)
- `.planning/research/ARCHITECTURE.md` — data flow, Firestore schema, component boundaries (HIGH confidence)
- `.planning/phases/04-pipeline-de-datos-shopify/04-CONTEXT.md` — locked decisions D-01 through D-16

### Secondary (MEDIUM confidence)
- Shopify Bulk Operations docs: `https://shopify.dev/docs/api/usage/bulk-operations/queries` — JSONL format, `__parentId`, URL expiry, concurrent op limit
- Shopify `currentBulkOperation` vs `bulkOperation(id:)` deprecation timeline verified against 2026-01 release notes

### Tertiary (LOW confidence)
- None — all claims in this document are backed by direct codebase inspection or official Shopify docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified by direct requirements.txt inspection, no new dependencies confirmed
- Architecture: HIGH — based on direct codebase reading of ingreso.py, shopify_service.py, firebase_service.py
- Pitfalls: HIGH — most sourced from existing PITFALLS.md (already researched) + direct code inspection

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain; Shopify API version locked by D-01)
