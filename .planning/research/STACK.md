# Technology Stack

**Project:** BukzBrain v2.0 — Módulo Reposiciones Automatizadas
**Researched:** 2026-03-30
**Scope:** Additions and integration points for automated inventory replenishment

---

## Verdict: No New Dependencies Required

Every capability needed for Reposiciones is already covered by the existing
`requirements.txt`. The module can be built entirely on what is already installed
and deployed.

---

## Existing Stack (Confirmed Sufficient)

| Technology | Current Pin | Role in Reposiciones | Confidence |
|------------|-------------|----------------------|------------|
| `fastapi>=0.115.0` | ✓ in prod | Router for bulk-op endpoints, polling, suggestions | HIGH |
| `requests>=2.31.0` | ✓ in prod | Shopify GraphQL calls (same pattern as shopify_service.py) | HIGH |
| `httpx>=0.27.0` | ✓ in prod | Async JSONL download from Shopify CDN URL after bulk op completes | HIGH |
| `openpyxl>=3.1.2` (latest: 3.1.5) | ✓ in prod | Excel generation per supplier — already used in envio_cortes.py, scrap.py | HIGH |
| `pandas>=2.0.0` | ✓ in prod | DataFrame manipulation for replenishment calculations; already used in cortes.py | HIGH |
| `firebase-admin>=6.4.0` | ✓ in prod | Firestore reads/writes for sales cache, suggestions, orders (same firebase_service.py pattern) | HIGH |
| `python-dotenv>=1.0.0` | ✓ in prod | Environment config (SHOPIFY_TOKEN, etc.) — already wired in config.py | HIGH |
| `zipfile` (stdlib) | stdlib | In-memory ZIP of per-supplier Excel files → StreamingResponse | HIGH |
| `json` (stdlib) | stdlib | JSONL parsing: iterate lines, `json.loads()` per line — no library needed | HIGH |

---

## Shopify API Integration

### Bulk Operations (Sales History — 6 Months)

Use `bulkOperationRunQuery` GraphQL mutation. Pattern is identical to what
`shopify_service.py` already does for other GraphQL calls.

**Workflow:**

1. POST `bulkOperationRunQuery` mutation with orders query filtered by
   `created_at:>='YYYY-MM-DD'` — returns a bulk operation ID.
2. Poll via `bulkOperation(id:)` query (API 2026-01+) or `currentBulkOperation`
   (pre-2026-01). Check `status` field: RUNNING → COMPLETED/FAILED.
   Recommended interval: 5–15 seconds. No webhook needed for internal tool.
3. When `status == "COMPLETED"`, download the JSONL file from the `url` field
   using `httpx` streaming (`response.aiter_lines()`) to avoid loading entire
   file into memory.
4. Parse JSONL: one `json.loads(line)` per line — stdlib `json` is sufficient.
   No `jsonlines` library needed; the extra dependency is not justified.

**API version to target:** Use `2025-10` (same as existing shopify_service.py
pattern). Do NOT upgrade to 2026-01 just for concurrent bulk ops — the module
only needs one bulk op at a time.

**Important constraint:** Only one bulk operation at a time per shop on pre-2026-01.
The backend must check for a running operation before starting a new one and
surface a clear error to the frontend if one is already in progress.

**GraphQL query shape for orders bulk op:**
```graphql
{
  orders(query: "created_at:>='2025-09-30' financial_status:paid") {
    edges {
      node {
        id
        createdAt
        lineItems {
          edges {
            node {
              sku
              quantity
              vendor
            }
          }
        }
      }
    }
  }
}
```

### Inventory / Locations API (Real-Time Stock)

`get_locations()` already exists in `shopify_service.py` and returns
`{location_name: location_id}`. Reposiciones reuses it directly.

For per-location inventory levels, use the existing GraphQL pattern:

```graphql
{
  locations(first: 50) {
    edges {
      node {
        id
        name
        inventoryLevels(first: 250) {
          edges {
            node {
              quantities(names: ["available", "on_hand", "incoming"]) {
                name
                quantity
              }
              item {
                sku
                variant { product { vendor } }
              }
            }
          }
        }
      }
    }
  }
}
```

This is a standard paginated GraphQL call — no bulk operation needed since it is
real-time and scoped to one location at a time.

---

## Excel Generation

**Use `openpyxl` directly** (not `xlsxwriter`, not `pandas.ExcelWriter` with
xlsxwriter engine).

Rationale:
- `openpyxl` is already used for styled output in `formatter_creacion.py` and
  `envio_cortes.py`. Team already knows the API.
- Replenishment Excel files need formatting (header colors, column widths, number
  formats). `openpyxl` supports in-place formatting; xlsxwriter is write-only
  and has a steeper learning curve for styled multi-sheet outputs.
- File sizes will be small (one sheet per supplier, tens to hundreds of rows) —
  xlsxwriter's performance advantage is irrelevant at this scale.

**ZIP generation** uses stdlib `zipfile.ZipFile` with a `BytesIO` buffer,
returned as `StreamingResponse(buffer, media_type="application/zip")`. This
pattern is already established in the codebase (envio_cortes.py ZIP logic).

---

## Firestore Data Model (New Collections)

These are new Firestore collections the module requires. No schema migration tool
is needed — Firestore is schemaless.

| Collection | Purpose | Key Fields |
|------------|---------|-----------|
| `reposiciones_ventas_cache` | Cached 6-month JSONL results from bulk op | `sku`, `qty_sold`, `vendor`, `period_start`, `period_end`, `updated_at` |
| `reposiciones_sugeridos` | Replenishment suggestions (one doc per run) | `id`, `status` (borrador/aprobado/enviado), `items[]`, `created_by`, `created_at` |
| `reposiciones_pedidos` | Approved orders with lifecycle tracking | `id`, `sugerido_id`, `vendor`, `items[]`, `status`, `created_at`, `updated_at` |
| `reposiciones_config` | Per-user or global config (sede, lead time, etc.) | `sede_id`, `lead_time_days`, `ventas_rango_dias`, `proveedores_filtro[]` |

**Access pattern:** Backend writes via `firebase_admin` (same `get_firestore_db()`
pattern from `firebase_service.py`). Frontend reads via `onSnapshot()` for
real-time status updates during bulk op polling.

---

## Frontend (No New Dependencies)

The React frontend requires no new packages. All needed capabilities exist:

| Need | Solution | Already In Project |
|------|----------|--------------------|
| Polling bulk op status | `useQuery` with `refetchInterval` (React Query) | YES |
| Real-time order status | `onSnapshot` on `reposiciones_pedidos` | YES |
| Table with overflow | shadcn `Table` + `overflow-x-auto` wrapper | YES |
| Excel ZIP download | `fetch` + `Blob` + anchor click | YES (pattern in ingreso.tsx) |
| Progress indicator | shadcn `Progress` component | YES |

---

## What NOT to Add

| Library | Why Not |
|---------|---------|
| `celery` / `rq` | Bulk op polling does not need a task queue. A simple background thread or FastAPI `BackgroundTasks` is sufficient for an internal tool with one user at a time. |
| `jsonlines` (PyPI) | stdlib `json` + iterate lines handles JSONL perfectly. Last release 2023, no recent activity. Unnecessary dependency. |
| `aiofiles` | httpx async streaming already handles JSONL download without filesystem writes. |
| `SQLAlchemy` / PostgreSQL | All persistence goes to Firestore for consistency with the rest of the app. |
| `numpy` | pandas covers all replenishment math. No need for raw numpy. |
| Any new frontend library | shadcn/ui + React Query + Tailwind covers all UI needs. |

---

## Integration Points With Existing Code

| Existing Module | Reused By Reposiciones | Notes |
|-----------------|----------------------|-------|
| `shopify_service.py` → `get_locations()` | Location dropdown and inventory fetch | Direct import |
| `shopify_service.py` → `ShopifyThrottler` | Bulk op polling loop | Reuse throttler |
| `shopify_service.py` → `_graphql_post()` | Bulk op mutation | Reuse helper |
| `firebase_service.py` → `get_firestore_db()` | All Firestore writes (cache, orders) | Direct import |
| `envio_cortes.py` ZIP pattern | Per-supplier Excel ZIP download | Copy pattern |
| `config.py` → `settings` | Shopify token/URL | Direct import |

---

## Sources

- [Shopify Bulk Operations — Official Docs](https://shopify.dev/docs/api/usage/bulk-operations/queries)
- [BulkOperation Object — GraphQL Admin](https://shopify.dev/docs/api/admin-graphql/latest/objects/BulkOperation)
- [InventoryLevel — GraphQL Admin](https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryLevel)
- [openpyxl 3.1.5 — PyPI](https://pypi.org/project/openpyxl/)
- [HTTPX Async Support](https://www.python-httpx.org/async/)
- [FastAPI Custom Response / StreamingResponse](https://fastapi.tiangolo.com/advanced/custom-response/)
