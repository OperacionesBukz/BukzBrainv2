# Phase 5: Motor de Cálculo de Reposición - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Python service that calculates replenishment suggestions per SKU. Takes sales cache + real-time inventory + pending orders from Firestore → produces suggested quantities with classification (Bestseller/Regular/Slow/Long Tail), urgency levels (Urgente/Pronto/Normal/OK), and intelligent in-transit detection based on real Shopify sales since each pending order date. Exposes as POST endpoint. Persists draft suggestion to Firestore.

</domain>

<decisions>
## Implementation Decisions

### In-Transit Detection Algorithm
- **D-01:** Chronological list model for multiple pending orders per SKU: collect ALL pending orders (status Aprobado or Enviado) for a SKU, sum total pending quantity, then calculate `absorbed = min(total_sales_since_oldest_pending_order_date, total_pending_qty)` using real Shopify sales from the sales cache. `in_transit_real = max(0, total_pending_qty - absorbed)`.
- **D-02:** Sales data for absorption check comes from the Firestore `sales_cache` — the same cache built by Phase 4's Bulk Operations. For the period between the pending order date and today, aggregate daily/monthly sales for that SKU.
- **D-03:** If no pending orders exist for a SKU, `in_transit_real = 0` (first-time run case — correct behavior, not a bug).
- **D-04:** Pending orders are read from Firestore collection `replenishment_orders` where status is `aprobado` or `enviado`.

### Calculation Formula
- **D-05:** Core formula: `suggested_qty = max(0, ceil((daily_sales * lead_time_days * safety_factor) - current_stock - in_transit_real))`
- **D-06:** `daily_sales = total_units_sold_in_period / days_in_period` (from sales cache, configurable period default 180 days)
- **D-07:** Safety factor: configurable via request param, default `1.5`
- **D-08:** If `suggested_qty <= 0`, product still appears in results but marked as "OK" urgency — user can see everything.

### Classification Thresholds
- **D-09:** Sales velocity classification (monthly average):
  - Bestseller: ≥ 10 units/month
  - Regular: ≥ 3 units/month
  - Slow: ≥ 1 unit/month
  - Long Tail: < 1 unit/month (includes zero-velocity products with stock)
- **D-10:** Urgency levels (days of inventory = current_stock / daily_sales):
  - Urgente: ≤ 7 days
  - Pronto: ≤ 14 days
  - Normal: ≤ 30 days
  - OK: > 30 days
  - If daily_sales = 0: urgency = "OK" (no demand = no urgency)

### Endpoint Contract
- **D-11:** Single endpoint: `POST /api/reposiciones/calculate`
- **D-12:** Request body: `{ location_id: str, vendors: list[str] | None, lead_time_days: int = 14, safety_factor: float = 1.5, date_range_days: int = 180 }`
- **D-13:** Response: full calculation results (per-SKU list + vendor aggregation + stats) AND persists draft suggestion to Firestore `replenishment_orders` with status `borrador`
- **D-14:** Response structure mirrors existing TypeScript types: `ReplenishmentResult` with `products: list[ProductAnalysis]`, `vendorSummary: list[VendorSummary]`, `stats: ReplenishmentStats`

### Product Filtering
- **D-15:** Include ALL products that have inventory at the selected location, regardless of velocity. Zero-velocity products classified as Long Tail.
- **D-16:** If `vendors` filter provided, only include products from those vendors. If null/empty, include all vendors.

### Vendor Aggregation
- **D-17:** Group results by vendor with totals: `total_skus`, `total_units_to_order`, `urgent_count`
- **D-18:** Sort vendors by `urgent_count` descending, then by `total_units_to_order` descending

### Claude's Discretion
- Internal module structure (single file vs separate service file)
- Error handling for edge cases (missing sales data, API failures)
- Whether to use numpy/pandas for calculations or pure Python (pure Python preferred — no new deps)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing calculation logic (port to Python)
- `src/pages/reposicion/replenishment-engine.ts` — Original TypeScript engine with classification, urgency, reorder point logic
- `src/pages/reposicion/types.ts` — TypeScript types: ProductAnalysis, VendorSummary, ReplenishmentResult, ReplenishmentStats, thresholds

### Phase 4 artifacts (data sources)
- `backend/routers/reposiciones.py` — Existing endpoints: locations, vendors, inventory, sales/*. The calculate endpoint ADDS to this router.
- `backend/services/shopify_service.py` — `get_inventory_by_location()` for real-time stock, `get_vendors_from_shopify()` for vendor list

### Research
- `.planning/research/PITFALLS.md` — In-transit detection edge cases, multiple pending orders, absorption formula
- `.planning/phases/04-pipeline-de-datos-shopify/04-CONTEXT.md` — Phase 4 decisions affecting data format

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `replenishment-engine.ts`: Full calculation logic to port — `calculateReplenishment()`, `classifyProduct()`, `assessUrgency()`, `calculateReorderPoint()`
- `types.ts`: Type definitions with exact threshold constants
- `reposiciones.py` router: add calculate endpoint here
- `firebase_service.get_firestore_db()`: Firestore client for reading pending orders and writing drafts
- Sales cache in Firestore `sales_cache/6m_global`: aggregated sales by SKU+month

### Established Patterns
- FastAPI router with typed request/response models (Pydantic)
- Firestore reads via firebase-admin SDK
- No new dependencies — pure Python calculations

### Integration Points
- Reads from: `sales_cache/6m_global` (Firestore), `replenishment_orders` where status in [aprobado, enviado] (Firestore), Shopify inventory via `get_inventory_by_location()`
- Writes to: `replenishment_orders` collection (new draft document with status `borrador`)
- Endpoint added to existing `reposiciones.py` router

</code_context>

<specifics>
## Specific Ideas

- The in-transit detection formula was explicitly discussed and approved by the user: use real Shopify sales since pending order date to determine what was absorbed by demand vs what's actually in transit
- The TypeScript engine in `replenishment-engine.ts` is the reference implementation — port the logic faithfully, adding the in-transit layer on top
- Sales cache stores data by SKU+month — the absorption calculation needs to convert monthly aggregates to estimate sales within a specific date range (from pending order date to today)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-motor-de-c-lculo-de-reposici-n*
*Context gathered: 2026-03-30*
