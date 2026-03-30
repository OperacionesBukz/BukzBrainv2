# Phase 5: Motor de Cálculo de Reposición - Research

**Researched:** 2026-03-30
**Domain:** Python replenishment calculation engine — port TypeScript logic to FastAPI, add in-transit detection via Firestore pending orders + Shopify sales cache
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** In-transit algorithm: collect ALL pending orders (status `aprobado` or `enviado`) for a SKU, sum total pending quantity, then calculate `absorbed = min(total_sales_since_oldest_pending_order_date, total_pending_qty)` using real Shopify sales from sales cache. `in_transit_real = max(0, total_pending_qty - absorbed)`.
- **D-02:** Sales data for absorption comes from Firestore `sales_cache` (same cache built by Phase 4).
- **D-03:** If no pending orders exist for a SKU, `in_transit_real = 0`.
- **D-04:** Pending orders read from Firestore collection `replenishment_orders` where status is `aprobado` or `enviado`.
- **D-05:** Core formula: `suggested_qty = max(0, ceil((daily_sales * lead_time_days * safety_factor) - current_stock - in_transit_real))`
- **D-06:** `daily_sales = total_units_sold_in_period / days_in_period` (from sales cache, configurable period default 180 days)
- **D-07:** Safety factor: configurable via request param, default `1.5`
- **D-08:** If `suggested_qty <= 0`, product still appears in results with "OK" urgency.
- **D-09:** Classification thresholds (monthly average): Bestseller ≥10, Regular ≥3, Slow ≥1, Long Tail <1
- **D-10:** Urgency thresholds (days of inventory): Urgente ≤7, Pronto ≤14, Normal ≤30, OK >30. If daily_sales=0 → urgency="OK".
- **D-11:** Single endpoint: `POST /api/reposiciones/calculate`
- **D-12:** Request body: `{ location_id: str, vendors: list[str] | None, lead_time_days: int = 14, safety_factor: float = 1.5, date_range_days: int = 180 }`
- **D-13:** Response: full calculation results AND persists draft suggestion to Firestore `replenishment_orders` with status `borrador`
- **D-14:** Response structure mirrors TypeScript types: `ReplenishmentResult` with `products: list[ProductAnalysis]`, `vendorSummary: list[VendorSummary]`, `stats: ReplenishmentStats`
- **D-15:** Include ALL products that have inventory at the selected location, regardless of velocity. Zero-velocity = Long Tail.
- **D-16:** If `vendors` filter provided, only include products from those vendors. If null/empty, include all vendors.
- **D-17:** Vendor aggregation: group results by vendor with `total_skus`, `total_units_to_order`, `urgent_count`.
- **D-18:** Sort vendors by `urgent_count` descending, then by `total_units_to_order` descending.

### Claude's Discretion

- Internal module structure (single file vs separate service file)
- Error handling for edge cases (missing sales data, API failures)
- Whether to use numpy/pandas for calculations or pure Python (pure Python preferred — no new deps)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CALC-01 | Motor calcula cantidad sugerida por SKU: `(velocidad_ventas * lead_time * safety_factor) - stock_actual - en_transito_real` | D-05/D-06/D-07 define formula exactly; direct Python port of `replenishment-engine.ts` `calculateReplenishment()` |
| CALC-02 | Motor clasifica productos por velocidad de ventas (Bestseller ≥10/mes, Regular ≥3, Slow ≥1, Long Tail <1) | D-09 defines thresholds; direct port of `classifyProduct()` from `replenishment-engine.ts` |
| CALC-03 | Motor asigna nivel de urgencia basado en días de inventario (Urgente ≤7, Pronto ≤14, Normal ≤30, OK >30) | D-10 defines thresholds; direct port of `classifyUrgency()` from `replenishment-engine.ts` |
| CALC-04 | Motor detecta inventario en tránsito inteligentemente — consulta ventas reales de Shopify desde la fecha del pedido; solo descuenta como en tránsito las unidades no absorbidas por ventas | D-01/D-02/D-03/D-04 define algorithm; sales cache aggregated by month requires date-range aggregation logic |
| CALC-05 | Motor soporta múltiples pedidos pendientes por SKU (lista, no escalar) y calcula en tránsito neto correctamente | D-01 explicitly defines multi-order algorithm using oldest pending order date as absorption anchor |
| CALC-06 | Motor agrega resultados por proveedor (total SKUs, total unidades, conteo urgentes) | D-17/D-18 define aggregation and sort order |

</phase_requirements>

---

## Summary

Phase 5 is a pure backend Python phase. There is no frontend work. The deliverable is a single FastAPI endpoint `POST /api/reposiciones/calculate` added to the existing `backend/routers/reposiciones.py` router.

The calculation logic already exists as a working TypeScript engine in `src/pages/reposicion/replenishment-engine.ts`. The port to Python is straightforward — same formula, same thresholds — with one significant addition: in-transit detection. The TypeScript engine has no concept of pending orders; in Phase 5, the backend queries Firestore for `replenishment_orders` documents with status `aprobado` or `enviado` and uses the Phase 4 sales cache to determine how much of those pending orders has been "absorbed" by real Shopify sales since the order date.

The key complexity is the absorption algorithm: since the sales cache stores data by SKU+month (not by exact date), a date-range aggregation helper is needed to sum sales from a given date to today across partial and full months. The formula itself (D-01) is decided and locked. The implementation must handle the monthly-granularity-to-date-range conversion correctly, and must use only the oldest pending order date as the absorption anchor (D-01 specifies "sales since oldest pending order date").

**Primary recommendation:** Implement as a single service function `calculate_replenishment()` called from the endpoint handler in `reposiciones.py`. Pure Python, no new dependencies (pandas and openpyxl already in requirements.txt but should not be used here — keep calculation path dependency-free for testability).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.115.0 (already in requirements) | Endpoint definition, Pydantic models | Already in use across all routers |
| firebase-admin | >=6.4.0 (already in requirements) | Firestore reads (sales_cache, replenishment_orders) + writes (borrador) | Already used via `firebase_service.get_firestore_db()` |
| math (stdlib) | stdlib | `math.ceil()` for suggested quantity rounding | Pure Python, no dep |
| datetime (stdlib) | stdlib | Date arithmetic for month-range aggregation | Pure Python, no dep |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pydantic (via FastAPI) | bundled | Request/response model validation | All endpoint I/O |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure Python math | pandas/numpy | pandas is already in requirements but adds complexity and import overhead to a pure calculation function; pure Python is simpler and testable without dataframe knowledge |

**Installation:** No new dependencies needed. All required libraries already in `backend/requirements.txt`.

---

## Architecture Patterns

### Recommended Project Structure

The calculate endpoint follows the same pattern as existing endpoints in `reposiciones.py`:

```
backend/
  routers/
    reposiciones.py          # Add POST /calculate endpoint here (D-11)
  services/
    shopify_service.py       # Already has get_inventory_by_location() — no changes
    firebase_service.py      # Already has get_firestore_db() — no changes
    reposicion_service.py    # NEW: calculation logic isolated for testability
```

The decision to create a separate `reposicion_service.py` vs inline is Claude's discretion (per CONTEXT.md). A separate file is recommended because:
- The calculation logic is ~150 lines of pure functions
- Isolated functions are directly unit-testable without FastAPI overhead
- Mirrors the existing pattern: `shopify_service.py` contains business logic, routers contain HTTP concerns

### Pattern 1: Pydantic Request/Response Models

**What:** Define typed request body and response models at the top of `reposiciones.py` or in the service file.
**When to use:** All FastAPI endpoints with complex I/O.

```python
# In reposiciones.py — mirrors TypeScript types from src/pages/reposicion/types.ts
from pydantic import BaseModel
from typing import Optional
import math

class CalculateRequest(BaseModel):
    location_id: str
    vendors: Optional[list[str]] = None
    lead_time_days: int = 14
    safety_factor: float = 1.5
    date_range_days: int = 180

class ProductAnalysis(BaseModel):
    sku: str
    title: str
    vendor: str
    classification: str          # "Bestseller" | "Regular" | "Slow" | "Long Tail"
    classification_label: str
    sales_per_month: float
    sales_per_week: float
    sales_per_day: float
    total_sold: int
    stock: int
    days_of_inventory: Optional[float]  # None when daily_sales == 0 (replaces "N/A")
    urgency: str                 # "URGENTE" | "PRONTO" | "NORMAL" | "OK"
    urgency_label: str
    reorder_point: float
    needs_reorder: bool
    suggested_qty: int
    in_transit_real: int

class VendorSummary(BaseModel):
    vendor: str
    total_skus: int
    total_units_to_order: int
    urgent_count: int

class ReplenishmentStats(BaseModel):
    total_products: int
    needs_replenishment: int
    urgent: int
    out_of_stock: int
    vendors_with_orders: int

class CalculateResponse(BaseModel):
    products: list[ProductAnalysis]
    vendor_summary: list[VendorSummary]
    stats: ReplenishmentStats
    draft_id: str               # Firestore document ID of the created borrador
```

### Pattern 2: Sales Cache Month-Range Aggregation

**What:** The sales cache stores `{sku: {"2025-10": 5, "2025-11": 12, ...}}`. The in-transit absorption check requires total sales between a specific date and today. This requires summing partial months correctly.
**When to use:** For both `daily_sales` calculation (over full `date_range_days` period) and for absorption calculation (from oldest pending order date to today).

```python
from datetime import datetime, timezone, date
import calendar

def aggregate_sales_in_range(
    monthly_sales: dict[str, int],  # {"2025-10": 5, "2025-11": 12, ...}
    start_date: date,
    end_date: date
) -> int:
    """
    Sum units sold between start_date (inclusive) and end_date (inclusive).
    Uses proportional day-weighting for partial months.

    The sales cache stores full-month totals. For a month that is partially
    covered by the range, we prorate: units * (days_in_range / days_in_month).

    Example: start_date=2025-10-15, end_date=2025-11-30
      Oct: 5 units * (17/31) ≈ 2.7 → rounded to int
      Nov: 12 units (full month)
    """
    total = 0.0
    current = date(start_date.year, start_date.month, 1)
    while current <= end_date:
        year_month = current.strftime("%Y-%m")
        month_units = monthly_sales.get(year_month, 0)
        days_in_month = calendar.monthrange(current.year, current.month)[1]

        # Determine coverage overlap
        month_start = date(current.year, current.month, 1)
        month_end = date(current.year, current.month, days_in_month)
        overlap_start = max(start_date, month_start)
        overlap_end = min(end_date, month_end)
        days_covered = (overlap_end - overlap_start).days + 1

        total += month_units * (days_covered / days_in_month)

        # Advance to next month
        if current.month == 12:
            current = date(current.year + 1, 1, 1)
        else:
            current = date(current.year, current.month + 1, 1)

    return int(total)
```

### Pattern 3: In-Transit Detection (D-01 Algorithm)

**What:** Multi-order absorption using sales since oldest pending order date.
**When to use:** For every SKU that has any pending orders in `replenishment_orders`.

```python
def calculate_in_transit_real(
    sku: str,
    pending_orders: list[dict],     # [{qty: int, created_at: datetime, ...}, ...]
    monthly_sales: dict[str, int],  # from sales_cache
    today: date
) -> int:
    """
    D-01: Chronological list model for multiple pending orders.
    1. Sum total pending quantity across ALL pending orders for this SKU
    2. Find oldest pending order date
    3. Sum sales from oldest order date to today (from sales_cache)
    4. absorbed = min(total_sales_since_oldest, total_pending_qty)
    5. in_transit_real = max(0, total_pending_qty - absorbed)
    """
    if not pending_orders:
        return 0  # D-03

    total_pending_qty = sum(o["quantity"] for o in pending_orders)
    oldest_date = min(o["created_at"].date() for o in pending_orders)

    sales_since_oldest = aggregate_sales_in_range(monthly_sales, oldest_date, today)
    absorbed = min(sales_since_oldest, total_pending_qty)
    return max(0, total_pending_qty - absorbed)
```

### Pattern 4: Firestore Draft Persistence

**What:** After calculation, persist results as a `borrador` document in `replenishment_orders`.
**When to use:** At the end of the `POST /calculate` handler, always (D-13).

```python
def _persist_draft(db, result: dict, request_params: dict) -> str:
    """
    Creates a new borrador document in replenishment_orders.
    Returns the new document ID.
    """
    from datetime import datetime, timezone
    doc_ref = db.collection("replenishment_orders").document()
    doc_ref.set({
        "status": "borrador",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "params": request_params,
        "products": result["products"],
        "vendor_summary": result["vendor_summary"],
        "stats": result["stats"],
    })
    return doc_ref.id
```

### Pattern 5: Reading Sales Cache (Handling Chunked Storage)

**What:** The sales cache may be inline (`data` field on the doc) or chunked (>8000 SKUs in subcollection). Both cases must be handled.
**When to use:** At the start of `calculate_replenishment()`.

```python
def _load_sales_cache(db) -> dict[str, dict[str, int]]:
    """
    Returns {sku: {"YYYY-MM": units, ...}, ...} or empty dict if no cache.
    Handles both inline and chunked storage (from Phase 4).
    """
    doc = db.collection("sales_cache").document("6m_global").get()
    if not doc.exists:
        return {}
    data = doc.to_dict()
    if "data" in data:
        return data["data"]
    if data.get("chunked"):
        merged = {}
        chunks = db.collection("sales_cache").document("6m_global") \
                   .collection("chunks").stream()
        for chunk in chunks:
            merged.update(chunk.to_dict().get("data", {}))
        return merged
    return {}
```

### Anti-Patterns to Avoid

- **Using pandas for calculation:** The calculation is straightforward arithmetic. Importing pandas adds startup overhead and obscures simple math. Pure Python dicts are sufficient.
- **Recomputing sales cache inside the endpoint:** Do NOT call `GET /sales/data` via HTTP from within the calculate endpoint. Read Firestore directly — avoids HTTP round-trip within the same process.
- **Using daily granularity from cache:** The cache is monthly. Do NOT attempt to re-derive daily granularity — use `total_monthly_units / days_in_period` as the daily rate (D-06).
- **Using `datetime.now()` (naive):** Always use `datetime.now(timezone.utc)` to avoid timezone issues (Pitfall 6 from PITFALLS.md).
- **Blocking the endpoint during Firestore writes:** The `replenishment_orders` draft write should happen synchronously but after calculating all results — not in a background thread — since the response includes the `draft_id`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Firestore client | Custom HTTP calls to Firestore REST API | `firebase_service.get_firestore_db()` | Already initialized, handles auth, idempotent |
| Shopify inventory fetch | New GraphQL query in calculate endpoint | `shopify_service.get_inventory_by_location()` | Already implemented with pagination, throttling, vendor filter |
| Request validation | Manual parameter checks | Pydantic `BaseModel` via FastAPI | Automatic validation, clear error messages |
| Month arithmetic | Manual month iteration | `calendar.monthrange()` from stdlib | Handles leap years, variable month lengths |
| Ceiling arithmetic | Manual rounding logic | `math.ceil()` from stdlib | Correct for D-05 formula |

**Key insight:** This phase is almost entirely a port + integration exercise. All transport layers (Shopify, Firestore) and data are already built by Phase 4. The new code is the calculation logic itself (~150 lines) and the endpoint (~50 lines).

---

## Runtime State Inventory

> Not a rename/refactor phase. Skipped.

---

## Common Pitfalls

### Pitfall 1: Monthly Sales Aggregation Off-By-One for Absorption

**What goes wrong:** The absorption check (D-01) uses "sales since oldest pending order date." If the sales cache for the current in-progress month is not yet complete (e.g., today is mid-March, cache was refreshed today), including it is correct. But if the implementation uses `>` instead of `>=` for the overlap check in `aggregate_sales_in_range`, the month containing the pending order's creation date is excluded.

**Why it happens:** Date boundary edge cases — `start_date` falls on a day within a month, not on the first.

**How to avoid:** Use `max(start_date, month_start)` and `min(end_date, month_end)` for overlap calculation (shown in Pattern 2 above). Include both endpoints (`days_covered = (overlap_end - overlap_start).days + 1`).

**Warning signs:** Absorption values consistently 0 when there clearly were sales in the same month as the pending order.

---

### Pitfall 2: `daily_sales = 0` Division Guard for `days_of_inventory`

**What goes wrong:** `days_of_inventory = current_stock / daily_sales` divides by zero when a product has no sales in the period. The TypeScript engine handles this with a `rawDaysInv < 999` check and returns `"N/A"`. Python must handle this explicitly.

**Why it happens:** Zero-velocity Long Tail products are included (D-15). Some will have zero daily sales.

**How to avoid:** `days_of_inventory = None` (not `"N/A"` — use Python None for unset numeric values), set urgency to `"OK"` when `daily_sales == 0` (D-10 explicitly states this). In the Pydantic model, `days_of_inventory: Optional[float] = None`.

**Warning signs:** `ZeroDivisionError` in backend logs on first run with real data containing books with no sales.

---

### Pitfall 3: Pending Orders Query Returns All Statuses Unless Filtered

**What goes wrong:** A query on `replenishment_orders` without a `where` clause returns ALL orders including completed ones (`recibido`, `cancelado`). This inflates in-transit inventory and causes systematic under-ordering.

**Why it happens:** D-04 specifies statuses `aprobado` and `enviado` but an unfiltered `.stream()` call is easy to write by mistake.

**How to avoid:** Use compound `where` with `in` operator:
```python
db.collection("replenishment_orders") \
  .where("status", "in", ["aprobado", "enviado"]) \
  .stream()
```
Note: `replenishment_orders` may be empty on first run (Phase 5 is the first time the collection is written to). This is correct behavior per D-03 — `in_transit_real = 0` for all SKUs.

**Warning signs:** Suggested quantities are 0 for products that are clearly understocked with no pending orders.

---

### Pitfall 4: Sales Cache May Not Exist or May Be Stale

**What goes wrong:** If Phase 4 has never been run (or a fresh environment), `sales_cache/6m_global` does not exist. The calculate endpoint must handle this gracefully — not with a 500 error.

**Why it happens:** Phase 5 depends on Phase 4 data being present, but that's a runtime dependency, not a code dependency.

**How to avoid:** Return HTTP 424 (Failed Dependency) or HTTP 400 with a clear message: `"Cache de ventas no disponible. Ejecuta POST /sales/refresh primero."` Do NOT return 500.

**Warning signs:** New environment deployments where Phase 4 has not been run fail with confusing errors.

---

### Pitfall 5: Firestore `replenishment_orders` Pending Orders Structure Unknown

**What goes wrong:** Phase 5 reads `replenishment_orders` collection for pending orders. But Phase 5 is ALSO the first phase that writes to `replenishment_orders` (as `borrador`). The structure of future `aprobado`/`enviado` documents (created in Phase 7) is not yet defined. If Phase 5's calculation engine assumes a field name that Phase 7 uses differently, the in-transit detection breaks.

**Why it happens:** Cross-phase data contract not yet specified.

**How to avoid:** Define the pending order document schema NOW in this phase so Phase 7 can conform to it. Minimum required fields for CALC-04/CALC-05:
```python
# replenishment_orders/{id}/items — subcollection OR embedded list
{
  "status": "aprobado" | "enviado",
  "created_at": "ISO 8601 UTC string",
  "location_id": str,
  "items": [
    {"sku": str, "vendor": str, "quantity": int, "title": str},
    ...
  ]
}
```
The calculate engine needs to group items by SKU across all pending orders. The `items` embedded list is simpler than a subcollection for this query pattern.

**Warning signs:** In-transit detection always returns 0 even when orders exist, because field names don't match.

---

### Pitfall 6: Inventory Items with `tracked=false` Create False Stockout Signals

**What goes wrong:** `get_inventory_by_location()` returns `available: 0` for untracked inventory items (gift cards, digital products). These appear as high-urgency stockouts in replenishment results.

**Why it happens:** Shopify doesn't distinguish between genuine zero stock and untracked in the inventory levels query (Pitfall 7 from PITFALLS.md).

**How to avoid:** The existing `get_inventory_by_location()` does not expose a `tracked` field. Since we cannot change that function in this phase, document that the `tracked` filter is a known gap. As a workaround: products with `stock == 0` AND `sales_per_month == 0` in the entire history may be flagged in the response as potentially untracked (cosmetic warning, not exclusion).

**Warning signs:** Consistently the same SKUs at top urgency with zero sales history and zero stock.

---

## Code Examples

Verified patterns from existing codebase:

### Reading Firestore (existing pattern from reposiciones.py)
```python
# Source: backend/routers/reposiciones.py lines 101-103
def _get_firestore():
    from services.firebase_service import get_firestore_db
    return get_firestore_db()
```

### Classification Function (port of replenishment-engine.ts)
```python
# Source: TypeScript original at src/pages/reposicion/replenishment-engine.ts lines 5-9
# Constants from src/pages/reposicion/types.ts lines 69-81
CLASSIFICATION_THRESHOLDS = {"BESTSELLER": 10, "REGULAR": 3, "SLOW": 1}
URGENCY_THRESHOLDS = {"URGENT": 7, "SOON": 14, "NORMAL": 30}

def classify_product(sales_per_month: float) -> tuple[str, str]:
    if sales_per_month >= CLASSIFICATION_THRESHOLDS["BESTSELLER"]:
        return "Bestseller", "Bestseller"
    if sales_per_month >= CLASSIFICATION_THRESHOLDS["REGULAR"]:
        return "Regular", "Venta Regular"
    if sales_per_month >= CLASSIFICATION_THRESHOLDS["SLOW"]:
        return "Slow", "Venta Lenta"
    return "Long Tail", "Cola Larga"

def classify_urgency(days_of_inventory: float | None) -> tuple[str, str]:
    if days_of_inventory is None:
        return "OK", "OK"  # D-10: daily_sales=0 → OK
    if days_of_inventory <= URGENCY_THRESHOLDS["URGENT"]:
        return "URGENTE", "URGENTE"
    if days_of_inventory <= URGENCY_THRESHOLDS["SOON"]:
        return "PRONTO", "PRONTO"
    if days_of_inventory <= URGENCY_THRESHOLDS["NORMAL"]:
        return "NORMAL", "NORMAL"
    return "OK", "OK"
```

### Endpoint Shape (mirrors existing router pattern)
```python
# Source: pattern from backend/routers/reposiciones.py line 313
@router.post("/calculate")
def calculate_replenishment(body: CalculateRequest):
    """
    CALC-01 through CALC-06.
    1. Load inventory from Shopify (get_inventory_by_location)
    2. Load sales cache from Firestore (sales_cache/6m_global)
    3. Load pending orders from Firestore (replenishment_orders where status in [aprobado, enviado])
    4. Calculate per-SKU metrics
    5. Persist borrador to replenishment_orders
    6. Return full results
    """
    ...
```

### Firestore Compound Where Query (firebase-admin SDK)
```python
# Source: firebase-admin Python SDK (verified in requirements.txt >=6.4.0)
db = _get_firestore()
pending = db.collection("replenishment_orders") \
            .where("status", "in", ["aprobado", "enviado"]) \
            .stream()
```

---

## State of the Art

| Old Approach (TypeScript engine) | New Approach (Python Phase 5) | What Changes | Impact |
|----------------------------------|-------------------------------|--------------|--------|
| CSV upload as data source | Shopify API + Firestore cache | Data is always current, no manual export | Users never upload stale CSVs |
| No in-transit detection | Absorption algorithm against pending orders | Smarter suggestions | Prevents double-ordering |
| Single lead time global | Configurable per request | More accurate timing | Per-vendor flexibility in Phase 6+ |
| `orderQuantity` calculation in TS | `suggested_qty` with D-05 formula | Formula includes safety factor explicitly | Cleaner, more conservative |

**Key divergence from TypeScript engine:** The TypeScript `calculateReplenishment()` only includes products that have sales (`data.total > 0`, line 58 of replenishment-engine.ts). Phase 5 MUST include all products with inventory at the location (D-15), including zero-velocity ones. This is a deliberate behavioral change.

---

## Open Questions

1. **Pending orders item structure for in-transit detection**
   - What we know: `replenishment_orders` collection will be written by Phase 5 (borrador) and Phase 7 (aprobado/enviado)
   - What's unclear: Phase 7 has not been designed yet. The `items` field path (embedded list vs subcollection) must be decided now so Phase 5's reader and Phase 7's writer agree.
   - Recommendation: Define the schema in this phase (embedded list), document it as the contract Phase 7 must follow. Include a code comment: `# SCHEMA CONTRACT: Phase 7 must write replenishment_orders with this structure`.

2. **Sales cache date_range coverage vs request date_range_days**
   - What we know: The sales cache was built with a `date_range_days` param (default 180). The calculate request also takes `date_range_days`.
   - What's unclear: If user requests `date_range_days=90` but cache only has data for 180 days, the engine should use only the last 90 days of cached data. The cache includes `date_range_start` and `date_range_end` metadata for this.
   - Recommendation: Compute `effective_start = max(cache_start, today - date_range_days_requested)` when aggregating daily sales. This way the user's requested range is respected even if the cache has more data.

3. **Firestore document size for borrador with many products**
   - What we know: A typical calculation may produce 1000+ SKUs. Each `ProductAnalysis` has ~15 fields.
   - What's unclear: At ~200 bytes/product, 1000 products = 200KB, well under Firestore's 1MB limit. But if Bukz has 5000+ products at one location, the borrador document could approach limits.
   - Recommendation: Include a size guard — if `len(products) > 4000`, emit a warning log but continue. The 1MB document limit should not be hit at typical Bukz scale.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| firebase-admin | Firestore reads/writes | Already in requirements.txt | >=6.4.0 | — |
| FastAPI / Pydantic | Endpoint + models | Already in requirements.txt | >=0.115.0 | — |
| Python stdlib (math, datetime, calendar) | Calculation | Always available | N/A | — |
| Firestore `sales_cache/6m_global` | Sales data for calculation | Runtime: populated by Phase 4 | N/A | Return 424 with instructions |
| Firestore `replenishment_orders` | Pending orders for in-transit | Runtime: empty on first run | N/A | in_transit_real=0 (correct per D-03) |

**Missing dependencies with no fallback:** None — all libraries already available.

**Runtime dependency:** Phase 4 must have been executed at least once to populate `sales_cache/6m_global`. The calculate endpoint must detect absence and return a clear error, not 500.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) — no backend test framework configured |
| Config file | None found — `src/test/example.test.ts` uses Vitest for frontend only |
| Quick run command | `npx vitest run src/test/` |
| Full suite command | `npx vitest run src/test/` |
| Backend tests | No pytest or backend test framework configured |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CALC-01 | `suggested_qty = max(0, ceil((daily * lt * sf) - stock - transit))` | unit | `npx vitest run src/test/replenishment-calc.test.ts` | Wave 0 |
| CALC-02 | Classification thresholds: Bestseller/Regular/Slow/Long Tail | unit | `npx vitest run src/test/replenishment-calc.test.ts` | Wave 0 |
| CALC-03 | Urgency thresholds: Urgente/Pronto/Normal/OK, zero-velocity=OK | unit | `npx vitest run src/test/replenishment-calc.test.ts` | Wave 0 |
| CALC-04 | In-transit detection: absorbed = min(sales_since_oldest, pending_qty) | unit | `npx vitest run src/test/replenishment-calc.test.ts` | Wave 0 |
| CALC-05 | Multi-order in-transit: uses oldest date across all pending orders | unit | `npx vitest run src/test/replenishment-calc.test.ts` | Wave 0 |
| CALC-06 | Vendor aggregation: total_skus, total_units, urgent_count; sort by urgent_count desc | unit | `npx vitest run src/test/replenishment-calc.test.ts` | Wave 0 |

> Note: Backend has no pytest configured. Tests will be written as Vitest unit tests that test the calculation logic as pure functions (TypeScript equivalents). The Python calculation logic should be structured as pure functions that are testable in isolation. If the project adds pytest in the future, the pure-function structure makes porting tests trivial.

**Alternative:** The calculation logic can also be tested via the TypeScript reference implementation. Given that the Python port must produce identical results to `replenishment-engine.ts`, cross-validating against that is a valid test strategy.

### Sampling Rate
- **Per task commit:** `npx vitest run src/test/replenishment-calc.test.ts`
- **Per wave merge:** `npx vitest run src/test/`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/test/replenishment-calc.test.ts` — covers CALC-01 through CALC-06 with pure function test cases
- [ ] Test fixtures: sample sales cache data, sample inventory, sample pending orders

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/pages/reposicion/replenishment-engine.ts` — reference TypeScript implementation read directly
- Existing codebase: `src/pages/reposicion/types.ts` — threshold constants verified (BESTSELLER=10, REGULAR=3, SLOW=1, URGENT=7, SOON=14, NORMAL=30)
- Existing codebase: `backend/routers/reposiciones.py` — router patterns, Firestore helpers, sales cache read logic
- Existing codebase: `backend/services/firebase_service.py` — `get_firestore_db()` API verified
- Existing codebase: `backend/services/shopify_service.py` — `get_inventory_by_location()` signature verified
- `.planning/phases/05-motor-de-c-lculo-de-reposici-n/05-CONTEXT.md` — all locked decisions (D-01 through D-18)
- `.planning/research/PITFALLS.md` — in-transit detection pitfalls (Pitfall 4, 6, 7) verified against codebase
- `backend/requirements.txt` — verified all dependencies already present (no new deps needed)

### Secondary (MEDIUM confidence)
- `.planning/phases/04-pipeline-de-datos-shopify/04-CONTEXT.md` — sales cache format: `{sku: {"YYYY-MM": int}}`, confirmed monthly granularity

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use in the codebase, no new dependencies
- Architecture: HIGH — direct port of existing TypeScript + existing FastAPI patterns in same file
- Calculation formulas: HIGH — all thresholds and formulas locked in CONTEXT.md and verified against TypeScript source
- In-transit algorithm: HIGH — locked in D-01, implementation pattern documented with examples
- Pitfalls: HIGH — sourced from PITFALLS.md (already researched for this project) + direct code audit

**Research date:** 2026-03-30
**Valid until:** 2026-05-30 (stable domain — calculations are pure math, Firestore SDK is stable, no external API changes expected for Phase 5 scope)
