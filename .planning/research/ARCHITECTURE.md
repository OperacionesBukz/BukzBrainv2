# Architecture Patterns — Reposiciones Automatizadas

**Domain:** Automated inventory replenishment module for existing BukzBrain app
**Researched:** 2026-03-30
**Confidence:** HIGH — based on direct codebase inspection, not assumptions

---

## Existing Architecture (Baseline)

The app already has a clear, proven three-tier pattern established across multiple modules
(ingreso, gift-cards, devoluciones, envio-cortes):

```
GitHub Pages (React SPA)
    │  resilientFetch + Firebase ID token header
    ▼
EasyPanel (FastAPI)
    │  requests + ShopifyThrottler
    ▼
Shopify Admin API (GraphQL + REST)
    │
    ▼  (separately, direct from both tiers)
Firebase Firestore
    ├── Written by FastAPI (firebase_admin SDK) — webhooks, celesa_orders
    └── Read/Written by React (firebase/firestore SDK) — tasks, requests, etc.
```

Auth flow: Firebase ID token injected by `resilientFetch` automatically →
`verify_firebase_token` dependency in FastAPI validates every request.

---

## How the New Module Integrates

### Component Map

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND  (src/pages/reposiciones-v2/)                             │
│                                                                     │
│  ReposicionesV2.tsx  ←── Page shell, multi-step wizard              │
│    ├── Step 1: ConfigStep.tsx                                       │
│    │     sede selector, vendor filter, lead time, date range        │
│    ├── Step 2: SuggestionStep.tsx                                   │
│    │     triggers backend calc, shows ProductAnalysis table         │
│    │     editable quantities, vendor grouping                       │
│    ├── Step 3: ApprovalStep.tsx                                     │
│    │     review totals, select vendors, approve → save to Firestore │
│    ├── Step 4: OrdersStep.tsx                                       │
│    │     list pending orders, download ZIP Excel                    │
│    └── Tab: HistorialStep.tsx                                       │
│          onSnapshot → replenishment_orders collection               │
│                                                                     │
│  api.ts        ← resilientFetch wrappers for all backend calls      │
│  hooks.ts      ← React Query hooks (useQuery + useMutation)         │
│  types.ts      ← TypeScript interfaces matching backend schemas     │
└─────────────────────────────────────────────────────────────────────┘
          │                                │
          │ HTTP (Firebase JWT)             │ onSnapshot
          ▼                                ▼
┌──────────────────────┐    ┌──────────────────────────────────────┐
│  BACKEND  (FastAPI)  │    │  FIRESTORE                           │
│                      │    │                                      │
│  routers/            │    │  replenishment_orders/               │
│    reposiciones.py   │    │    {orderId}/                        │
│                      │    │      status, sede, config,           │
│  services/           │    │      suggestions[], vendors[],       │
│    replenishment_    │    │      createdAt, approvedAt,          │
│    service.py        │◄──►│      approvedBy, sentAt              │
│    shopify_service.py│    │                                      │
│    firebase_service.py    │  sales_cache/                        │
│                      │    │    {cacheId}/  (e.g. "6m_global")   │
└──────────────────────┘    │      data: {sku: {qty, months}},     │
          │                 │      fetchedAt, bulkOpId,            │
          │ GraphQL         │      expiresAt                       │
          ▼                 │                                      │
   Shopify Admin API        │  replenishment_config/               │
   - locations              │    {userId}/                         │
   - inventory levels       │      defaultSede, defaultLeadTime,   │
   - products by vendor     │      defaultMonths, lastUsed         │
   - sales (Bulk Ops)       └──────────────────────────────────────┘
```

---

## Component Boundaries

### Frontend Components

| Component | Responsibility | Talks To |
|-----------|---------------|----------|
| `ReposicionesV2.tsx` | Page shell, wizard state machine | All child steps |
| `ConfigStep.tsx` | Sede/vendor/lead time config; triggers location fetch | `api.ts` (GET /locations), Firestore (user config) |
| `SuggestionStep.tsx` | Displays suggestions, allows qty editing | `api.ts` (POST /calculate), local state |
| `ApprovalStep.tsx` | Review + approve; saves order to Firestore | Firestore (`replenishment_orders`) directly via `db` |
| `OrdersStep.tsx` | Shows approved orders, triggers ZIP download | `api.ts` (POST /generate-zip), Firestore |
| `HistorialStep.tsx` | Order history, status updates | Firestore `onSnapshot` on `replenishment_orders` |
| `api.ts` | All HTTP calls wrapped in `resilientFetch` | FastAPI backend |
| `hooks.ts` | React Query hooks wrapping api.ts | `api.ts`, QueryClient |
| `types.ts` | Shared TypeScript interfaces | Consumed by all above |

### Backend Components

| Component | Responsibility | Talks To |
|-----------|---------------|----------|
| `routers/reposiciones.py` | FastAPI router, request validation, auth | `services/replenishment_service.py` |
| `services/replenishment_service.py` | NEW — calculation engine ported from TS | `shopify_service.py`, `firebase_service.py` |
| `services/shopify_service.py` | Existing — inventory + sales fetch | Shopify Admin API |
| `services/firebase_service.py` | Existing — Firestore Admin SDK client | Firestore |

---

## Data Flow

### Flow A: Fetch Sales Cache (slow path, ~1-3 min on first run)

```
Frontend ConfigStep
  → POST /api/reposiciones/sales/refresh  (if cache stale/missing)
  ← {job_id, status: "running"}
  → GET /api/reposiciones/sales/status  (polls every 5s, React Query refetchInterval)
  ← {status: "completed", cached_at, skus_count}

Backend (background thread, same pattern as existing ingreso.py):
  shopify_service.start_bulk_operation()
    → Shopify bulkOperationRunQuery (orders last 6 months)
  loop check_bulk_operation_status()
    until COMPLETED
  download JSONL from result URL
  parse into {sku: {qty_by_month}}
  firebase_service.get_firestore_db()
    .collection("sales_cache").doc("6m_global").set(data)
```

### Flow B: Calculate Suggestions (fast path, ~2-5s after cache loaded)

```
Frontend SuggestionStep
  → POST /api/reposiciones/calculate
      {sede, vendor_filter[], lead_time_days, sales_months}
  ← {suggestions: ProductAnalysis[], stats, vendors: VendorSummary[]}

Backend replenishment_service.py:
  1. shopify_service.get_locations() → resolve sede → location_id
  2. shopify_service.get_inventory_by_location(location_id, vendor_filter)
     → Shopify GraphQL inventoryItems with inventoryLevels
  3. firebase_service.get_firestore_db()
     .collection("sales_cache").doc("6m_global").get()
     → filter to requested months, filter to requested vendors
  4. Run calculation (port of replenishment-engine.ts logic to Python)
     same formula: salesPerDay, reorderPoint, orderQuantity
     PLUS: transit inventory detection (see Flow C)
  5. Return suggestions JSON
```

### Flow C: Transit Inventory Detection

This is the key differentiator. For each product that has a pending replenishment order:

```
replenishment_service.calculate():
  for each pending order in Firestore replenishment_orders
    where status in ["Aprobado", "Enviado", "Parcial"]:
      pendingOrderDate = order.approvedAt
      for each item in order.suggestions:
        sales_since_order = sales_cache.get_sales_between(
          sku, pendingOrderDate, now
        )
        in_transit_qty = item.orderQuantity - sales_since_order
        effective_stock = current_stock + max(in_transit_qty, 0)
  # Use effective_stock instead of current_stock in calculation
```

### Flow D: Approve and Save Order

```
Frontend ApprovalStep
  (direct Firestore write — no backend needed, same pattern as tasks/requests)
  db.collection("replenishment_orders").add({
    status: "Aprobado",
    sede, config, suggestions, vendors,
    approvedAt: serverTimestamp(),
    approvedBy: auth.currentUser.uid
  })
  ← Firestore doc ref (auto-id)
```

Rationale for direct Firestore write: Approval is metadata-only, no Shopify API call needed.
Consistent with how tasks, bookstore_requests, celesa_orders are written.

### Flow E: Generate and Download ZIP

```
Frontend OrdersStep
  → POST /api/reposiciones/generate-zip
      {order_id, vendor_names[]}
  ← StreamingResponse (application/zip)
  Frontend: downloadBlob(blob, "Pedidos_Reposicion.zip")

Backend:
  Reads order from Firestore by order_id
  Filters to requested vendor_names
  Generates Excel XML per vendor (port of excel-generator.ts logic)
  Bundles into ZIP via zipfile module
  Streams back
```

---

## Firestore Collection Design

### `replenishment_orders` (new)

```
replenishment_orders/{orderId}
  status: "Borrador" | "Aprobado" | "Enviado" | "Parcial" | "Recibido"
  sede: string                        // e.g. "Bogotá - Sede Principal"
  location_id: number                 // Shopify location ID
  config: {
    lead_time_days: number
    sales_months: number              // how many months of sales used
    vendor_filter: string[]           // empty = all vendors
    generated_at: Timestamp
  }
  suggestions: ProductAnalysis[]      // snapshot of calculated suggestions
  vendors: VendorSummary[]            // snapshot grouped by vendor
  stats: ReplenishmentStats
  created_at: Timestamp
  created_by: string                  // uid
  approved_at: Timestamp | null
  approved_by: string | null          // uid
  sent_at: Timestamp | null
  notes: string
```

ProductAnalysis and VendorSummary shapes are identical to existing TypeScript types in
`src/pages/reposicion/types.ts` — reuse for frontend, port to Python Pydantic models for backend.

### `sales_cache` (new)

```
sales_cache/{cacheId}
  // cacheId = "6m_global" (global cache, not per-user)
  data: {
    [sku: string]: {
      title: string
      vendor: string
      monthly: {
        [yearMonth: string]: number   // e.g. {"2025-10": 5, "2025-11": 12}
      }
      total: number
    }
  }
  fetched_at: Timestamp
  expires_at: Timestamp              // fetched_at + 24h suggested
  bulk_op_id: string
  skus_count: number
```

Storing monthly breakdown (not just total) is required for transit detection in Flow C,
which needs `get_sales_between(sku, date_from, date_to)`.

### `replenishment_config` (new, optional — enhances UX)

```
replenishment_config/{userId}
  default_sede: string
  default_lead_time: number
  default_months: number
  last_used_vendors: string[]
  updated_at: Timestamp
```

Written by frontend directly via `setDoc` (same pattern as user preferences elsewhere).

---

## Suggested Build Order

Dependencies drive this order — each phase unblocks the next.

### Phase 1: Backend Foundation
**What:** `routers/reposiciones.py` skeleton + Shopify data fetch endpoints

Endpoints to build:
- `GET /api/reposiciones/health` — Shopify connection check
- `GET /api/reposiciones/locations` — reuse `shopify_service.get_locations()` directly
- `GET /api/reposiciones/products` — inventory by location + vendor filter
- `POST /api/reposiciones/sales/refresh` — trigger Bulk Op background job (port of ingreso.py `_sales_worker`)
- `GET /api/reposiciones/sales/status` — job + cache status

**Why first:** Everything else depends on having real Shopify data available.
**Reuse:** `shopify_service.get_locations()`, `start_bulk_operation()`, `check_bulk_operation_status()`,
`load_sales_sync()` already exist — wire them into the new router.

### Phase 2: Calculation Engine
**What:** `services/replenishment_service.py` — Python port of the TypeScript engine

- Port `calculateReplenishment()` logic from `replenishment-engine.ts`
- Accept Shopify inventory data + Firestore sales cache (instead of CSV text)
- Add transit inventory detection (new capability)
- Endpoint: `POST /api/reposiciones/calculate`

**Why second:** Depends on Phase 1 data sources. Can be tested with mocked data before Phase 1.
**Reuse:** All business formulas are already proven in `replenishment-engine.ts` — direct port.

### Phase 3: Frontend Config + Suggestion Steps
**What:** `src/pages/reposiciones-v2/` — Steps 1 and 2 of wizard

- `ConfigStep.tsx` — sede select, vendor filter, lead time, date range
- `SuggestionStep.tsx` — table with editable quantities
- `api.ts` + `hooks.ts` wrappers
- Sales cache polling (same `refetchInterval` pattern as `useSalesStatus` in ingreso hooks)
- Register new page in `PAGE_REGISTRY` (pages.ts)

**Why third:** Depends on Phase 1+2 backend.

### Phase 4: Approval + Firestore Persistence
**What:** `ApprovalStep.tsx` + `HistorialStep.tsx` + Firestore writes

- Approval saves to `replenishment_orders` (direct Firestore write)
- History tab uses `onSnapshot` for real-time status
- Status badge progression (Borrador → Aprobado → Enviado → Parcial → Recibido)
- Manual status updates (admin only)

**Why fourth:** Depends on Phase 3 suggestion data to approve.

### Phase 5: ZIP Download + Polish
**What:** `OrdersStep.tsx` + `POST /api/reposiciones/generate-zip`

- Port `excel-generator.ts` to Python (openpyxl or the existing XML approach)
- ZIP bundling via Python `zipfile`
- Frontend streaming download via `downloadBlob`

**Why last:** Non-blocking — existing module already has Excel download. New module needs
Phases 1-4 working before this adds value.

---

## Integration Points with Existing Code

| Existing File | How New Module Uses It |
|---------------|----------------------|
| `backend/services/shopify_service.py` | Call `get_locations()`, `start_bulk_operation()`, `check_bulk_operation_status()`, `load_sales_sync()` directly. No modifications needed. |
| `backend/services/firebase_service.py` | Call `get_firestore_db()` for reading sales cache and writing order history. No modifications needed. |
| `backend/config.py` | Use `settings.get_graphql_url()`, `get_shopify_headers()`. No modifications needed. |
| `backend/auth.py` | New router uses same `Depends(verify_firebase_token)` pattern. |
| `backend/main.py` | Add `app.include_router(reposiciones.router, dependencies=_auth)` — one line. |
| `src/lib/resilient-fetch.ts` | `api.ts` imports and uses it exactly like gift-cards, ingreso, etc. |
| `src/pages/reposicion/types.ts` | Import `ProductAnalysis`, `VendorSummary`, `ReplenishmentResult`, `ReplenishmentStats` — they match the new module's data shape exactly. |
| `src/pages/reposicion/excel-generator.ts` | Keep for existing CSV-based module. Python port for backend ZIP generation. |
| `firestore.rules` | New collections need read/write rules — requires explicit confirmation before changing. |

---

## Key Architectural Decisions

### Why the old Reposicion.tsx module stays untouched

The existing module works 100% client-side (CSV upload → JS engine → Excel download).
Build the new module at a new route (`/reposiciones-v2` or `/reposiciones-automatizadas`)
with no dependency on the old files. Only share the TypeScript type definitions.
After the new module is validated, the old one can be deprecated.

### Why sales cache goes in Firestore (not memory)

The existing `_sales_cache` in `ingreso.py` is in-process memory, which is lost on restart.
For the replenishment module, the cache must survive restarts (it takes 1-3 min to rebuild)
and must be readable by both the backend (for calculations) and frontend (for status display).
Firestore is already available, already integrated, and already used for persistent state.

### Why approval writes directly to Firestore (not via backend)

Approval is a metadata operation — no Shopify API call, no heavy computation.
Direct Firestore writes from the frontend are the established pattern for tasks,
bookstore_requests, and celesa_orders. Going through the backend would add a round-trip
with no benefit.

### Why Bulk Operations for sales data

The existing `ingreso.py` already implements the full Bulk Operations async job pattern
(start → poll → download JSONL → parse). This code is proven and handles any catalog size.
For 6 months of sales data across thousands of SKUs, it is the only viable Shopify API approach.

### Why monthly breakdown in sales cache

The transit inventory detection (Flow C) needs to sum sales between an arbitrary date
(`order.approvedAt`) and now. A flat total is insufficient. Monthly buckets allow a fast
approximation: sum full months + pro-rate partial months. No need to store every day.

---

## Scalability Considerations

| Concern | Current Scale (Bukz) | Notes |
|---------|---------------------|-------|
| Sales cache size | ~5,000-15,000 SKUs × 6 months | Firestore doc limit is 1MB. If monthly per-SKU data exceeds this, split into subcollections by vendor prefix. |
| Bulk Op time | 1-3 min | Acceptable. Frontend polls with 5s interval. Show progress indicator. |
| Concurrent calculations | Single user at a time (internal tool) | No locking needed at current scale. |
| Firestore `replenishment_orders` | Tens of orders/month | `onSnapshot` on full collection is fine indefinitely. |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Recomputing sales data on every calculation request
**What:** Calling Shopify Bulk Operations on every `/calculate` call.
**Why bad:** 1-3 min wait, Shopify rate limits, blocks other API usage.
**Instead:** Check Firestore cache age first. Only refresh if missing or older than 24h.

### Anti-Pattern 2: Storing ProductAnalysis[] as a flat array in Firestore without indexing
**What:** Saving the full suggestions array as a nested array in Firestore.
**Why bad:** Querying individual items, Firestore 1MB doc limit if catalog is large.
**Instead:** Store suggestions as-is for now (it's a snapshot, not queried individually).
If the limit is hit, store suggestions in a subcollection `replenishment_orders/{id}/items/{sku}`.

### Anti-Pattern 3: Modifying the existing Reposicion.tsx or its engine files
**What:** Editing `replenishment-engine.ts`, `csv-parser.ts`, `excel-generator.ts`.
**Why bad:** Breaks the working module that users currently depend on.
**Instead:** New module is fully isolated in a new directory. Share only type definitions.

### Anti-Pattern 4: Fetching all inventory without vendor filter
**What:** Pulling the entire Shopify catalog to calculate replenishment for one vendor.
**Why bad:** Shopify catalog can have 10,000+ products. Calculation time and rate limit usage.
**Instead:** Always pass vendor filter to inventory queries. If "all vendors" is selected,
paginate with cursor-based GraphQL rather than fetching all at once.

---

## Sources

- Direct codebase inspection: `backend/routers/ingreso.py` (existing Bulk Ops + polling pattern)
- Direct codebase inspection: `backend/services/shopify_service.py` (ShopifyThrottler, get_locations, start_bulk_operation, load_sales_sync)
- Direct codebase inspection: `backend/services/firebase_service.py` (Admin SDK pattern)
- Direct codebase inspection: `src/lib/resilient-fetch.ts` (auth injection pattern)
- Direct codebase inspection: `src/pages/gift-cards/` (api.ts + hooks.ts + types.ts module pattern)
- Direct codebase inspection: `src/pages/ingreso/hooks.ts` (useSalesStatus refetchInterval pattern)
- Direct codebase inspection: `src/pages/reposicion/` (existing engine and types to reuse)
- Project context: `.planning/PROJECT.md`
