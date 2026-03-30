# Project Research Summary

**Project:** BukzBrain v2.0 — Módulo Reposiciones Automatizadas
**Domain:** Automated inventory replenishment with approval workflow (Shopify-native internal ops tool)
**Researched:** 2026-03-30
**Confidence:** HIGH

## Executive Summary

Reposiciones Automatizadas is a classical purchase-order replenishment system built directly on top of Shopify inventory and sales data, with a human approval gate before any supplier contact. The core loop is: fetch real sales history via Shopify Bulk Operations → calculate reorder quantities per SKU per location → present editable suggestions → approve → generate per-vendor Excel files → ZIP download. The module replaces a manual CSV-upload workflow and the primary value is eliminating data-prep errors and the 15–30 minute setup time per replenishment run. An existing TypeScript engine (`replenishment-engine.ts`) already proves the calculation logic; this module ports it to Python and replaces the CSV input with live Shopify data.

The recommended implementation requires zero new dependencies. Every capability needed — GraphQL calls, JSONL parsing, Firestore persistence, Excel generation, ZIP streaming, async job polling — is covered by the existing `requirements.txt` and frontend libraries. The module integrates cleanly into the three-tier pattern already established across ingreso, envio-cortes, and gift-cards: React SPA on GitHub Pages → FastAPI on EasyPanel → Shopify Admin API + Firestore. The existing codebase already contains `get_locations()`, `start_bulk_operation()`, `check_bulk_operation_status()`, `load_sales_sync()`, and `get_firestore_db()` — the new module wires these into a dedicated router rather than building from scratch.

The highest-risk area is the Shopify data pipeline. Three confirmed bugs lurk in it: `currentBulkOperation` is deprecated in API 2026-01+ and must be replaced with `bulkOperation(id:)` on day 1; the bulk query must use `currentQuantity` not `quantity` on line items to avoid overstating sales for edited orders; and the JSONL bulk URL must be processed immediately and discarded — never stored in Firestore. The second risk is the in-transit detection calculation, which requires modeling pending orders as a list (not a scalar) and using UTC timestamps throughout. Both risks are fully preventable with the mitigations documented in PITFALLS.md.

## Key Findings

### Recommended Stack

No new dependencies are required. The module uses `fastapi`, `requests`, `httpx` (async JSONL streaming), `openpyxl` (Excel), `pandas` (DataFrame calculations), `firebase-admin` (Firestore), and stdlib `zipfile` + `json` — all already pinned in `requirements.txt`. The frontend uses React Query's `refetchInterval` for polling, `onSnapshot` for real-time order status, and the existing `resilientFetch` + Firebase JWT auth pattern.

Do NOT add: `celery`, `rq`, `jsonlines`, `aiofiles`, `SQLAlchemy`, `numpy`, or any new frontend library. A `threading.Thread` + FastAPI `BackgroundTasks` is sufficient for an internal single-user tool. Avoid upgrading the Shopify API version to 2026-01 just for concurrent bulk ops — the module needs one operation at a time.

**Core technologies:**
- `fastapi` + `routers/reposiciones.py`: new router for all replenishment endpoints — same auth/pattern as ingreso
- `httpx` async streaming: download JSONL from Shopify CDN URL without loading into memory
- `openpyxl` write-only mode: per-vendor Excel generation; avoids 50x memory inflation on large catalogs
- `firebase-admin` via `get_firestore_db()`: Firestore persistence for sales cache, order history, job state
- `pandas`: replenishment math and DataFrame joins between inventory and sales data
- stdlib `zipfile` + `BytesIO`: in-memory ZIP of all vendor Excels, returned as `StreamingResponse`

### Expected Features

**Must have (table stakes):**
- Calculation engine: `(sales_velocity × lead_time) − current_stock − in_transit_qty` using real Shopify data
- Editable suggestions table: inline quantity override per SKU before approval
- Approval gate: Borrador → Aprobado state transition with Firestore transaction to prevent double-approval
- Order state tracking: Borrador → Aprobado → Enviado → Parcial → Recibido (explicit user actions)
- Vendor filter: multi-select with search (Bukz has 150+ vendors; users never process all at once)
- Per-vendor Excel generation + ZIP download (same format as current manual module)
- Configuration form: sede (Shopify location), vendor filter, lead time, sales date range
- In-transit detection: pending open orders reduce suggested qty to avoid over-ordering
- Basic audit trail: `createdBy`, `approvedBy`, `createdAt`, `approvedAt` on every order document
- Order history list with filter by state, vendor, date

**Should have (differentiators):**
- Sales cache in Firestore via Bulk Operations (first run ~1-3 min; subsequent runs instant — without this the module is unusable daily)
- Sales data from Shopify (no manual CSV upload — eliminates the main pain point of the current module)
- Recalculate without losing manual overrides (client state: `{ suggested, override }` per line)
- Vendor quantity summary at approval (totals per vendor before committing)

**Defer (v2+):**
- Sales velocity trend indicator (requires two-period comparison — significant compute complexity)
- Shopify draft order linking (useful traceability but not operationally blocking)
- Per-vendor lead time config UI (model the data correctly from day 1; dedicated config screen can come later)
- Vendor quantity summary panel (derivable from the table; convenience only)

**Anti-features (never build):**
- Automatic order submission to vendor (no EDI — vendors receive Excel by email)
- Multi-level approval chains (single approver is correct for Bukz scale)
- Real-time Shopify inventory push (conflicts with receiving workflow in Inventory module)
- ML/AI demand forecasting (configurable date range is sufficient and auditable)

### Architecture Approach

The module follows the established three-tier pattern without deviation. A new `routers/reposiciones.py` and `services/replenishment_service.py` are added to the FastAPI backend; a new `src/pages/reposiciones-v2/` directory with the standard `api.ts` + `hooks.ts` + `types.ts` structure is added to the frontend. The existing module (`src/pages/reposicion/`) is left completely untouched — only its TypeScript type definitions are imported. The new route is registered in `PAGE_REGISTRY` in `pages.ts` per the established pattern.

**Major components:**
1. `routers/reposiciones.py` — FastAPI router; validates auth, delegates to service layer; handles job state for bulk op polling
2. `services/replenishment_service.py` — calculation engine (Python port of `replenishment-engine.ts`); in-transit detection; reads sales cache from Firestore
3. Firestore `sales_cache/6m_global` — persistent sales cache (monthly breakdown per SKU); survives backend restarts; 24h TTL
4. Firestore `replenishment_orders/` — order lifecycle from Borrador to Recibido; written directly by frontend (approval) and by backend (job metadata)
5. `src/pages/reposiciones-v2/` — multi-step wizard (Config → Suggestions → Approval → Orders → Historial) with React Query polling and `onSnapshot`

### Critical Pitfalls

1. **`currentBulkOperation` deprecation (Phase 1)** — Refactor `check_bulk_operation_status()` to accept and pass the `operation_id` from the mutation response. Use `bulkOperation(id: $id)` query from day 1. This is a confirmed API breaking change in 2026-01+; fixing it after the fact requires touching the ingreso module too.

2. **JSONL URL expires in 7 days (Phase 1)** — Never store the signed Shopify CDN URL in Firestore. Download and parse the JSONL immediately on `COMPLETED`, write only the aggregated `{sku: {monthly: {year-month: qty}}}` dict to Firestore, then discard the URL.

3. **`currentQuantity` not `quantity` on line items (Phase 1)** — Using `quantity` inflates sales for orders with edits or partial cancellations. Use `currentQuantity` in the bulk query node. Validate by cross-checking one known SKU against Shopify Analytics before trusting replenishment calculations.

4. **In-transit double-counting (Phase 2)** — Model in-transit as a list of `{order_id, quantity_ordered, quantity_received}` per SKU, not a scalar. Calculate `net_in_transit − absorbed` using cumulative sales since the oldest pending order date. Add a `max_pending_age_days` threshold to flag stale orders for manual confirmation.

5. **Stale bulk job state on backend restart (Phase 1)** — The in-memory `running = True` flag does not survive container restarts. Persist job state to Firestore; on startup, check for jobs older than 15 minutes and reset them. Use UTC timestamps throughout to avoid timezone drift in date comparisons with Shopify data.

6. **openpyxl memory explosion on large reports (Phase 5)** — Use `write_only=True` mode in openpyxl. Generate one workbook per vendor sequentially (not all in memory simultaneously). For ZIP, use `io.BytesIO` + `StreamingResponse`.

7. **Concurrent approval race condition (Phase 4)** — Wrap all Firestore state transitions in transactions. Assert the document is in the expected predecessor state before writing the new state. Return 409 Conflict if not.

## Implications for Roadmap

Based on research, the dependency chain is strict: Shopify data layer → calculation engine → UI → approval → export. All research files converge on a 5-phase build order.

### Phase 1: Shopify Data Pipeline + Firestore Cache

**Rationale:** Everything downstream depends on having real, cached Shopify data. This phase has the highest pitfall density (Pitfalls 1, 2, 3, 5, 6, 15) and must be built correctly before any calculation work begins. Fixing the deprecated `currentBulkOperation` here also protects the existing ingreso module.

**Delivers:** Working `/reposiciones/locations`, `/reposiciones/sales/refresh`, `/reposiciones/sales/status` endpoints; Firestore `sales_cache/6m_global` with monthly breakdown; job state persisted to Firestore with restart recovery; `OPERATION_IN_PROGRESS` detection and clear error surfacing.

**Addresses features:** Sales cache (differentiator — makes module usable daily), real Shopify sales data (replaces CSV upload)

**Avoids:** Pitfall 1 (deprecated API), Pitfall 2 (bulk op conflict), Pitfall 3 (JSONL refund inflation), Pitfall 5 (cache evaporation), Pitfall 6 (timezone UTC), Pitfall 11 (URL expiry), Pitfall 16 (`currentQuantity`)

### Phase 2: Calculation Engine

**Rationale:** Direct Python port of the proven TypeScript engine in `replenishment-engine.ts`. Can be developed with mocked data from Phase 1, but requires Phase 1's Firestore schema to be finalized. This is the highest-complexity design phase due to in-transit detection.

**Delivers:** `services/replenishment_service.py` with `POST /api/reposiciones/calculate`; formula `(sales_velocity × lead_time) − current_stock − effective_in_transit`; per-SKU transit detection from open Firestore orders; vendor filter applied in Python post-processing (not in Shopify query); untracked product filtering.

**Addresses features:** Calculation engine (table stakes), in-transit detection (table stakes)

**Avoids:** Pitfall 4 (in-transit double-counting), Pitfall 7 (untracked phantom zeros), Pitfall 8 (vendor filter at API level)

### Phase 3: Frontend Config + Suggestion Steps

**Rationale:** Depends on Phase 1+2 backend endpoints being live. Standard React wizard pattern — well-documented, lower risk.

**Delivers:** `src/pages/reposiciones-v2/` directory with `ConfigStep.tsx` (sede select, vendor multi-select, lead time, date range), `SuggestionStep.tsx` (editable quantities table with override tracking), `api.ts` + `hooks.ts` + `types.ts`, sales cache polling via `refetchInterval`, page registered in `PAGE_REGISTRY`

**Addresses features:** Configuration form, editable suggestions, recalculate-without-losing-overrides

**Avoids:** Table overflow (wrap in `overflow-x-auto` per project pattern), missing firestore.rules update (requires explicit user confirmation before deploy)

### Phase 4: Approval Workflow + Order History

**Rationale:** Depends on Phase 3 suggestion data being confirmed correct. Firestore write pattern mirrors existing tasks and bookstore_requests — well-understood, but the state transition logic needs transactions.

**Delivers:** `ApprovalStep.tsx` (direct Firestore write with transaction), `HistorialStep.tsx` (`onSnapshot` on `replenishment_orders`), full state machine Borrador → Aprobado → Enviado → Parcial → Recibido, admin-only status update controls, audit fields on every document

**Addresses features:** Approval gate, order state tracking, order history list, basic audit trail

**Avoids:** Pitfall 9 (concurrent approval race condition via Firestore transaction)

### Phase 5: Excel/ZIP Export + Polish

**Rationale:** Non-blocking — the existing manual module already handles Excel download. New module needs Phases 1-4 validated before export adds value. Isolating Excel generation last means the full data pipeline is confirmed before writing output logic.

**Delivers:** `OrdersStep.tsx`, `POST /api/reposiciones/generate-zip`, Python port of `excel-generator.ts` using openpyxl write-only mode, per-vendor workbooks zipped in-memory, `StreamingResponse` download, "Marcar como Enviado" post-download action

**Addresses features:** Per-vendor Excel, ZIP download

**Avoids:** Pitfall 10 (openpyxl memory explosion via write-only mode and sequential generation)

### Phase Ordering Rationale

- Data before calculation: the engine is useless without confirmed, cached, correctly-parsed Shopify data. Building Phase 2 first and mocking Phase 1 data creates integration risk.
- Backend before frontend: the wizard UI depends entirely on backend endpoints. Phase 3 cannot be validated without Phase 1+2 being real.
- Calculation before approval: you cannot approve suggestions that don't exist yet. Phase 4's approval documents reference Phase 2's `ProductAnalysis[]` shape.
- Export last: it reads from approved Firestore documents. Adding it before Phases 1-4 are validated would obscure whether errors originate in data, calculation, or formatting.
- The `firestore.rules` update for new collections (`replenishment_orders`, `sales_cache`, `replenishment_config`) must be confirmed by the user before any phase that writes to those collections is deployed.

### Research Flags

Phases needing deeper research during planning:
- **Phase 1 (Bulk Ops pipeline):** The `check_bulk_operation_status()` refactor touches code shared with the ingreso module. Verify that the existing `load_sales_sync()` call in ingreso is not broken by the operation-ID parameter addition. Light codebase audit recommended before implementation.
- **Phase 2 (in-transit detection):** The absorption formula (multi-order, partial receipt) has no existing precedent in the codebase. Recommend a design review step with a concrete example calculation (e.g., 2 pending orders for same SKU, one partially marked Parcial) before coding.

Phases with standard patterns (skip research-phase):
- **Phase 3 (frontend wizard):** Identical pattern to `src/pages/ingreso/` and `src/pages/gift-cards/`. No research needed — follow the established module structure exactly.
- **Phase 4 (Firestore approval):** Direct write pattern is established in tasks, bookstore_requests, celesa_orders. Firestore transactions are well-documented. No research needed beyond confirming transaction syntax.
- **Phase 5 (Excel/ZIP):** openpyxl write-only mode and zipfile are documented in PITFALLS.md with the exact mitigation. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against existing `requirements.txt` and codebase; zero new dependencies confirmed |
| Features | HIGH | Table stakes derived from codebase audit + domain research; anti-features explicitly grounded in PROJECT.md decisions |
| Architecture | HIGH | Based on direct codebase inspection of all existing modules; component boundaries match established patterns exactly |
| Pitfalls | HIGH | 12 of 16 pitfalls verified against official Shopify docs or direct code review; 4 from community sources (MEDIUM) |

**Overall confidence:** HIGH

### Gaps to Address

- **`financial_status` filter validation:** Research flags that `financial_status:paid` may exclude valid inventory movement (cash-on-delivery, manual orders). Verify with Bukz operations team which statuses represent real sales before building the bulk query in Phase 1. Consider `fulfillment_status:fulfilled` as an alternative or addition.
- **Firestore 1MB document limit for `sales_cache`:** At 5,000–15,000 SKUs with 6 months of monthly data, the `sales_cache/6m_global` document may approach or exceed 1MB. If it does, split into subcollections keyed by vendor prefix. Measure during Phase 1 implementation — not a blocker but needs a contingency path documented before Phase 2.
- **Per-vendor lead time UI:** PITFALLS.md recommends modeling lead time per-vendor from day 1 (data model). The Phase 5 config UI for editing per-vendor lead times is deferred. The data field should be added to `replenishment_config` in Phase 1 even if the edit UI comes later.
- **`firestore.rules` changes:** All new Firestore collections require explicit user confirmation of rule changes before deploy. This is a hard dependency for every phase that introduces a new collection. Flag at the start of Phase 1.

## Sources

### Primary (HIGH confidence)
- Shopify Bulk Operations Official Docs — bulk op workflow, JSONL format, URL expiry, concurrent limits
- BulkOperation GraphQL Object — `errorCode`, `objectCount`, `partialDataUrl`, `status` enum
- bulkOperationRunQuery Mutation docs — `OPERATION_IN_PROGRESS` error behavior
- Shopify API Release Notes 2025-01 and 2026-01 — `currentBulkOperation` deprecation timeline
- openpyxl Performance Docs — 50x memory ratio, write-only mode confirmed
- Firebase Firestore transaction docs — optimistic concurrency, contention limits
- Direct codebase inspection: `backend/services/shopify_service.py`, `backend/routers/ingreso.py`, `backend/config.py`, `backend/services/firebase_service.py`, `src/lib/resilient-fetch.ts`, `src/pages/gift-cards/`, `src/pages/ingreso/hooks.ts`, `src/pages/reposicion/`

### Secondary (MEDIUM confidence)
- Shopify Community: JSONL parent-child `__parentId` behavior
- Shopify Community: REST-to-GraphQL UTC timezone issue
- eTurns, Moxo, Fabrikator, Zip, Prediko — replenishment workflow domain patterns and PO approval models
- Flieber, Netstock, Fabrikator — replenishment mistake patterns and reorder point formulas

---
*Research completed: 2026-03-30*
*Ready for roadmap: yes*
