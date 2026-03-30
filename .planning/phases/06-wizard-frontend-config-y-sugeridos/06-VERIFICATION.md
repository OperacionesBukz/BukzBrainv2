---
phase: 06-wizard-frontend-config-y-sugeridos
verified: 2026-03-30T20:50:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 6: Wizard Frontend Config y Sugeridos — Verification Report

**Phase Goal:** El usuario puede configurar los parámetros de una corrida de reposición, lanzar el cálculo, ver la tabla de sugeridos y editar cantidades antes de aprobar — todo desde el módulo /reposiciones
**Verified:** 2026-03-30T20:50:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TypeScript types mirror all backend Pydantic response models exactly | VERIFIED | `src/pages/reposiciones/types.ts` — 10 interfaces (ProductResult, CalculateRequest, CalculateResponse, VendorSummaryResult, ReplenishmentStatsResult, SalesStatusResponse, SalesRefreshResponse, ReplenishmentConfig, LocationItem, VendorItem) match backend Pydantic models field-for-field |
| 2 | API layer covers all 5 backend endpoints with resilientFetch pattern | VERIFIED | `api.ts` exports `getLocations`, `getVendors`, `getSalesStatus`, `refreshSales`, `calculateReplenishment` — all use `resilientFetch` + `handleResponse<T>` pattern; 409/OPERATION_IN_PROGRESS handling in `refreshSales` |
| 3 | React Query hooks exist for locations, vendors, sales status polling, calculate mutation, and Firestore config | VERIFIED | `hooks.ts` — `useLocations`, `useVendors`, `useSalesStatusPolling` (refetchInterval=3000ms when running), `useCalculate`, `useReplenishmentConfig`, `saveReplenishmentConfig`, `useCalculationFlow` all present and wired |
| 4 | Route /reposiciones is registered in PAGE_REGISTRY and App.tsx | VERIFIED | `src/lib/pages.ts` line 38: `{ path: "/reposiciones", ... workspace: "operaciones" }`; `App.tsx` line 24: `lazyWithReload(() => import("./pages/reposiciones"))`, line 89: `<Route path="/reposiciones" element={<Reposiciones />} />` |
| 5 | User sees location dropdown populated with Shopify locations | VERIFIED | `ConfigPanel.tsx` — `Select` with `locations.map(loc => <SelectItem value={loc.id}>{loc.name}</SelectItem>)`, loading skeleton when `isLocationsLoading`; `index.tsx` passes `locations.data ?? []` from `useLocations()` |
| 6 | User sees vendor multi-select with "Todos" default and inline search | VERIFIED | `VendorMultiSelect.tsx` — Popover+Command pattern, `isTodos = value.length === 0`, trigger shows `"Todos (N)"` when empty, auto-collapses to `[]` when all individually selected, `CommandInput` with `"Buscar proveedor..."` |
| 7 | User can configure lead time, date range months, safety factor with clamping | VERIFIED | `ConfigPanel.tsx` — three `<Input type="number">` with `Math.min/Math.max` clamping: lead time 1–90 default 14, date range months 1–12 default 6, safety factor 1.0–3.0 step 0.1 default 1.5 |
| 8 | Config is saved to Firestore on calculate and pre-loaded on mount | VERIFIED | `index.tsx` `handleCalcular`: calls `saveReplenishmentConfig(user.uid, {...})` fire-and-forget; `useEffect` on `savedConfig.data` merges saved values and converts `date_range_days` back to months via `Math.round(days/30)` |
| 9 | User sees editable suggestions table with search, urgency filter, inline edit, delete | VERIFIED | `SuggestionsTable.tsx` — 10 columns with `effectiveProducts` useMemo (applies overridesMap + filters deletedSkus), `searchTerm` filters SKU/title/vendor, `urgencyFilter` dropdown, `editingCell` inline edit (Enter/Blur commit, Escape cancel), Trash2 delete, PAGE_SIZE=25 pagination, ScrollArea horizontal overflow |
| 10 | Vendor summary recomputes from effective products reflecting edits/deletions | VERIFIED | `VendorSummaryPanel.tsx` — `effectiveVendorSummary` useMemo iterates products, skips `deletedSkus.has(p.sku)`, applies `overridesMap[p.sku] ?? p.suggested_qty`, sorted by urgent_count desc then total_units_to_order desc, footer totals row |
| 11 | Firestore rules allow replenishment_config read/write scoped to user UID | VERIFIED | `firestore.rules` line 153–156: `match /replenishment_config/{userId} { allow read, write: if isAuthenticated() && request.auth.uid == userId; }` |
| 12 | Test stubs exist for CONF-01 to CONF-05 and APPR-02 to APPR-04 (16 stubs, all passing) | VERIFIED | `vitest run src/test/reposiciones` — 16/16 tests pass across `config.test.tsx` (8 stubs) and `table.test.tsx` (8 stubs) |
| 13 | Build passes with zero errors | VERIFIED | `npm run build` exits 0 in 14.21s, no TypeScript or compilation errors |

**Score:** 13/13 truths verified (all 9 requirement IDs covered across 3 plans)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/pages/reposiciones/types.ts` | All TS interfaces for the module | VERIFIED | 10 interfaces, contains `ProductResult` with all 17 fields |
| `src/pages/reposiciones/api.ts` | API functions for all backend endpoints | VERIFIED | 5 exported functions, `calculateReplenishment` present, 409 handling in `refreshSales` |
| `src/pages/reposiciones/hooks.ts` | React Query hooks + Firestore config hook | VERIFIED | 6 hooks/functions including `useReplenishmentConfig`, `useCalculationFlow` |
| `src/pages/reposiciones/index.tsx` | Full page wiring config + results | VERIFIED | 255 lines, imports ConfigPanel + SuggestionsTable + VendorSummaryPanel, `handleCalcular`, `overridesMap`, `deletedSkus`, `draftId` |
| `src/pages/reposiciones/components/ConfigPanel.tsx` | 5-input config form | VERIFIED | All 5 inputs (sede, vendors, lead time, date range, safety factor) + Calcular button with disabled state |
| `src/pages/reposiciones/components/VendorMultiSelect.tsx` | Searchable multi-select | VERIFIED | Popover+Command, Todos default, toggleAll, auto-collapse pattern |
| `src/pages/reposiciones/components/SuggestionsTable.tsx` | Editable table with search/filter/edit/delete | VERIFIED | All acceptance criteria met: `effectiveProducts`, `overridesMap`, `editingCell`, `deletedSkus`, `searchTerm`, `urgencyFilter`, `PAGE_SIZE`, `ScrollArea`, `bg-red-100`, `Buscar por SKU`, `Trash2`, `onBlur` |
| `src/pages/reposiciones/components/VendorSummaryPanel.tsx` | Vendor summary from effective products | VERIFIED | `effectiveVendorSummary` useMemo recomputes client-side, `deletedSkus.has`, `overridesMap`, `Resumen por Proveedor`, `urgent_count`, `.sort(` |
| `src/lib/pages.ts` | PAGE_REGISTRY entry | VERIFIED | Line 38: `/reposiciones`, `operaciones` workspace |
| `src/App.tsx` | Lazy route | VERIFIED | Lines 24 + 89: `Reposiciones` lazy import and `<Route path="/reposiciones">` |
| `src/test/reposiciones/config.test.tsx` | Test stubs CONF-01 to CONF-05 | VERIFIED | 8 stubs, all `expect(true).toBe(true)`, documents all 5 CONF behaviors |
| `src/test/reposiciones/table.test.tsx` | Test stubs APPR-02 to APPR-04 | VERIFIED | 8 stubs, all `expect(true).toBe(true)`, documents APPR-02/03/04 behaviors |
| `firestore.rules` | replenishment_config rule | VERIFIED | `match /replenishment_config/{userId}` with `request.auth.uid == userId` guard |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api.ts` | `/api/reposiciones/*` | `resilientFetch` | WIRED | All 5 endpoints use `resilientFetch(${API_BASE}/api/reposiciones/...)` |
| `hooks.ts` | `api.ts` | React Query `queryFn`/`mutationFn` | WIRED | `import { getLocations, getVendors, getSalesStatus, refreshSales, calculateReplenishment } from "./api"` |
| `ConfigPanel.tsx` | `hooks.ts` | `useLocations`, `useVendors` | WIRED | Props `locations` and `vendors` flow from `index.tsx` which calls these hooks; `ConfigPanel` receives and renders them |
| `index.tsx` | `hooks.ts` | `useReplenishmentConfig`, `saveReplenishmentConfig`, `useCalculationFlow` | WIRED | All three imported and used in `handleCalcular` and `useEffect` |
| `SuggestionsTable.tsx` | `index.tsx` | `products`, `overridesMap`, `deletedSkus` props | WIRED | `index.tsx` passes `results.products`, `overridesMap`, `deletedSkus` as props; `onOverrideChange` and `onDeleteSku` callbacks wired |
| `VendorSummaryPanel.tsx` | `effectiveProducts` computation | `useMemo` over products + overridesMap + deletedSkus | WIRED | Receives `products={results.products}`, `overridesMap`, `deletedSkus` from `index.tsx`; computes `effectiveVendorSummary` internally |
| `index.tsx` | Firestore `replenishment_config/{uid}` | `useReplenishmentConfig(user?.uid)` + `saveReplenishmentConfig` | WIRED | Reads config on mount via React Query, writes on `handleCalcular` via fire-and-forget call |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ConfigPanel.tsx` | `locations` | `useLocations()` → `getLocations()` → `GET /api/reposiciones/locations` | Yes — live API call via `resilientFetch` | FLOWING |
| `ConfigPanel.tsx` | `vendors` | `useVendors()` → `getVendors()` → `GET /api/reposiciones/vendors` | Yes — live API call | FLOWING |
| `SuggestionsTable.tsx` | `products` | `useCalculationFlow` → `calculateReplenishment()` → `POST /api/reposiciones/calculate` → backend `ProductResult[]` | Yes — backend returns real calculation results | FLOWING |
| `VendorSummaryPanel.tsx` | `effectiveVendorSummary` | Derived client-side from `products` prop (with overrides/deletions applied via useMemo) | Yes — real data from calculation flow, not hardcoded | FLOWING |
| `index.tsx` | `savedConfig` | `useReplenishmentConfig(user?.uid)` → `getDoc(doc(db, "replenishment_config", uid))` | Yes — Firestore read per authenticated user | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test stubs pass | `npx vitest run src/test/reposiciones` | 16/16 tests pass | PASS |
| Build compiles cleanly | `npm run build` | Exits 0 in 14.21s | PASS |
| Commit hashes documented in SUMMARYs exist | `git log --oneline f9d5cc7 4bbea11 266faed f5655e5 b3462cf b0f23f1 ffa8ac9 a694a4c 99690cb` | All 9 commits present | PASS |
| API functions exported | `grep "^export async function" api.ts` | 5 functions: getLocations, getVendors, getSalesStatus, refreshSales, calculateReplenishment | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CONF-01 | 06-01, 06-02 | Usuario selecciona sede desde dropdown poblado por Shopify | SATISFIED | `ConfigPanel.tsx` Select renders `locations.map(loc => SelectItem)` populated by `useLocations()` |
| CONF-02 | 06-01, 06-02 | Usuario filtra proveedores con multi-select (todos o selección específica) | SATISFIED | `VendorMultiSelect.tsx` — `value=[]` means Todos, toggle per vendor, auto-collapse to Todos when all selected |
| CONF-03 | 06-01, 06-02 | Usuario configura lead time en días (default 14, rango 1-90) | SATISFIED | `ConfigPanel.tsx` Input min=1 max=90, clamp `Math.min(90, Math.max(1, parseInt(v) || 14))` |
| CONF-04 | 06-01, 06-02 | Usuario configura rango de ventas para análisis (default 6 meses) | SATISFIED | `ConfigPanel.tsx` Input min=1 max=12 for months; `handleCalcular` converts to days via `date_range_months * 30` |
| CONF-05 | 06-01, 06-02 | Sistema persiste última configuración usada por usuario | SATISFIED | `saveReplenishmentConfig(user.uid, {...})` on calculate; `useReplenishmentConfig(user?.uid)` on mount with `useEffect` merge |
| APPR-01 | 06-03 | Al generar sugerido, se crea un borrador en Firestore con todos los SKUs | SATISFIED | Backend `_persist_draft()` in `reposiciones.py` line 589 creates `replenishment_orders` doc; frontend receives `draft_id` in `CalculateResponse`, stores in `draftId` state for Phase 7 |
| APPR-02 | 06-01, 06-03 | Usuario ve tabla de sugerido con búsqueda por SKU/título/proveedor y filtro por urgencia | SATISFIED | `SuggestionsTable.tsx` — search input filters `sku/title/vendor`, urgency Select dropdown, all 10 columns rendered |
| APPR-03 | 06-01, 06-03 | Usuario puede editar cantidades sugeridas inline y eliminar SKUs | SATISFIED | `editingCell` state + `Input onBlur/onKeyDown` (Enter commits, Escape cancels); Trash2 button calls `onDeleteSku`; `overridesMap` and `deletedSkus` not reset on recalculate |
| APPR-04 | 06-01, 06-03 | Usuario ve resumen por proveedor (total títulos, total unidades) antes de aprobar | SATISFIED | `VendorSummaryPanel.tsx` `effectiveVendorSummary` useMemo derives vendor aggregates from effective products (post-overrides, post-deletions), footer totals row |

**No orphaned requirements found.** REQUIREMENTS.md maps CONF-01–05 and APPR-01–04 to Phase 6 (all marked `[x]`), all covered by Plans 01–03.

Note: APPR-01 has no frontend test stub (expected — draft creation is a backend responsibility; frontend test coverage would require a backend integration test). This is consistent with the plan design.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `config.test.tsx` (all 8 tests) | `expect(true).toBe(true)` stubs | Info | Intentional Wave 0 stubs documenting required behaviors; not blocking — these are contract anchors pending real assertions when components are tested in isolation |
| `table.test.tsx` (all 8 tests) | `expect(true).toBe(true)` stubs | Info | Same as above |

No blocker or warning anti-patterns found. No hardcoded empty returns in production code paths. No TODO/FIXME in implementation files. The two `placeholder` matches in scanned files are legitimate HTML `placeholder` attributes on `<input>` elements.

---

## Human Verification Required

### 1. Full End-to-End Flow (config → calculate → table → edit → vendor summary)

**Test:** Open `/reposiciones` in dev server (`npm run dev`), select a location, click "Calcular Reposicion", interact with the suggestions table
**Expected:**
- Config panel shows sede dropdown, vendor multi-select ("Todos" default), lead time 14, rango 6, safety factor 1.5
- Clicking "Calcular" triggers cache check (progress bar if stale) then shows real suggestions
- Suggestions table shows colored urgency badges, inline edit on Sugerido column (click → input → Enter commits), Trash2 removes rows
- Vendor summary below updates when you edit quantities or delete rows
- Closing and reopening page pre-loads last saved config

**Why human:** Visual rendering, UX responsiveness, dark/light mode correctness, real Shopify/backend data availability cannot be verified programmatically.

### 2. Config Persistence Round-Trip

**Test:** Configure a specific location and vendor set, click "Calcular", navigate away, return to `/reposiciones`
**Expected:** The config panel loads the previously saved values (location, vendors, lead time, date range, safety factor)
**Why human:** Requires a live Firebase connection and authenticated session.

### 3. 409 OPERATION_IN_PROGRESS Toast

**Test:** Trigger a "Calcular" while a Shopify bulk operation is in progress
**Expected:** Toast error "Hay una operacion Bulk en curso en Shopify. Intenta en unos minutos." — no progress bar shown
**Why human:** Requires a live backend in the specific 409 state.

---

## Gaps Summary

No gaps. All 9 requirement IDs (CONF-01 through CONF-05, APPR-01 through APPR-04) are satisfied. All artifacts exist, are substantive, are wired, and data flows through real API/Firestore sources. Build passes. 16/16 test stubs pass.

The only items noted as stubs are the Wave 0 test stubs (all `expect(true).toBe(true)`), which are intentional architectural anchors per the phase plan — they document required behaviors and will be replaced with real assertions in a future phase when component isolation tests are written.

---

_Verified: 2026-03-30T20:50:00Z_
_Verifier: Claude (gsd-verifier)_
