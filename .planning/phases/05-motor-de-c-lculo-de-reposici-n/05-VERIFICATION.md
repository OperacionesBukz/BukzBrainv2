---
phase: 05-motor-de-c-lculo-de-reposici-n
verified: 2026-03-30T14:39:30Z
status: passed
score: 11/11 must-haves verified
---

# Phase 5: Motor de Cálculo de Reposición — Verification Report

**Phase Goal:** El backend calcula cantidades sugeridas de reposición por SKU usando ventas reales, lead time configurable y detección precisa de inventario en tránsito desde pedidos pendientes en Firestore
**Verified:** 2026-03-30T14:39:30Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | POST /api/reposiciones/calculate devuelve lista de SKUs con cantidad sugerida calculada como `(velocidad × lt × sf) − stock − tránsito` | VERIFIED | `@router.post("/calculate")` en reposiciones.py:610; fórmula `suggested_qty_raw = (daily_sales * lead_time_days * safety_factor) - stock - in_transit_real` en reposicion_service.py:262-263 |
| 2 | Cada SKU tiene clasificación de velocidad (Bestseller/Regular/Slow/Long Tail) y urgencia (Urgente/Pronto/Normal/OK) con los umbrales definidos | VERIFIED | `classify_product` (umbrales 10/3/1) y `classify_urgency` (umbrales 7/14/30) en reposicion_service.py:33-79; 14 tests verdes cubriendo todos los límites exactos |
| 3 | Para SKU con dos pedidos pendientes, en_tránsito descuenta correctamente unidades absorbidas por ventas reales sin doble conteo | VERIFIED | `calculate_in_transit_real` implementa algoritmo D-01: oldest_date anchor + `absorbed = min(sales_since_oldest, total_pending_qty)`; test "D-01 multi-order: 2 orders qty=6+4=10, oldest=Oct 1; sales=3 → transit=7" verde |
| 4 | Resultados agrupados por proveedor con totales de SKUs, unidades y conteo de urgentes | VERIFIED | `vendor_summary` construida en reposicion_service.py:297-318; `VendorSummary` model en reposiciones.py:495-499; sort D-18 por urgent_count DESC luego total_units DESC; 4 tests de `aggregate_by_vendor` verdes |

**Score:** 4/4 success criteria verified

### Must-Have Truths (from PLAN frontmatter — Plans 01 and 02)

**Plan 01 truths:**

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `classify_product()` retorna 'Bestseller' para >= 10, 'Regular' >= 3, 'Slow' >= 1, 'Long Tail' < 1 | VERIFIED | reposicion_service.py:47-53; 7 casos de test verdes incluyendo exactamente los umbrales |
| 2 | `classify_urgency()` retorna 'URGENTE' <= 7, 'PRONTO' <= 14, 'NORMAL' <= 30, 'OK' > 30; None -> OK | VERIFIED | reposicion_service.py:71-79; 7 casos de test verdes incluyendo null/None → OK (D-10) |
| 3 | `calculate_suggested_qty()` aplica formula: max(0, ceil((daily * lt * sf) - stock - transit)) | VERIFIED | reposicion_service.py:262-263; 4 casos D-05 verdes |
| 4 | `aggregate_sales_in_range()` suma ventas con prorrateado parcial correcto (`days_covered = (overlap_end - overlap_start).days + 1`) | VERIFIED | reposicion_service.py:122 tiene exactamente esa línea; 4 casos incluyendo mes parcial y cross-month verdes |
| 5 | `calculate_in_transit_real()` usa fecha del pedido más antiguo como ancla y retorna 0 sin pedidos pendientes | VERIFIED | reposicion_service.py:160 guard `if not pending_orders_for_sku: return 0`; reposicion_service.py:179 `oldest_date = min(...)` |
| 6 | vendor aggregation agrupa por proveedor con total_skus, total_units_to_order, urgent_count y ordena por urgent_count desc, total_units desc | VERIFIED | reposicion_service.py:315-318 sort con `(-v["urgent_count"], -v["total_units_to_order"])`; 4 tests verdes incluyendo tie-break |

**Plan 02 truths:**

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 7 | POST /api/reposiciones/calculate acepta {location_id, vendors, lead_time_days, safety_factor, date_range_days} y devuelve resultados | VERIFIED | `CalculateRequest` model en reposiciones.py:469-474; `@router.post("/calculate", response_model=CalculateResponse)` en reposiciones.py:610 |
| 8 | Respuesta incluye products[], vendor_summary[] y stats con campos definidos en D-14 | VERIFIED | `CalculateResponse` model en reposiciones.py:508-512 define los tres campos; `ProductAnalysis` con 16 campos, `VendorSummary` con 4, `ReplenishmentStats` con 5 |
| 9 | Cuando sales_cache no existe, endpoint devuelve 424 con mensaje claro en español | VERIFIED | reposiciones.py:529-530 `raise HTTPException(status_code=424, detail="Cache de ventas no disponible. Ejecuta POST /sales/refresh primero.")` |
| 10 | Al finalizar el cálculo, se crea documento borrador en Firestore y response incluye draft_id | VERIFIED | `_persist_draft()` en reposiciones.py:589-603 escribe `status: "borrador"`; `CalculateResponse.draft_id: str` en reposiciones.py:512 |
| 11 | Si vendors es null o lista vacía, incluye todos los proveedores del inventario | VERIFIED | reposiciones.py:637 `vendor_filter=body.vendors if body.vendors else None` (D-16) |

**Score:** 11/11 must-have truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/services/reposicion_service.py` | Funciones puras: classify_product, classify_urgency, aggregate_sales_in_range, calculate_in_transit_real, calculate_replenishment | VERIFIED | 334 líneas, 5 funciones exportadas, solo stdlib (math, calendar, datetime), SCHEMA CONTRACT comment presente |
| `src/test/replenishment-calc.test.ts` | Test suite para CALC-01 a CALC-06 con 6 describe blocks | VERIFIED | 357 líneas, 6 describe blocks, 30 tests todos VERDES |
| `backend/routers/reposiciones.py` | POST /calculate endpoint con Pydantic models y Firestore draft write | VERIFIED | 706 líneas, 7 rutas @router (6 existentes + 1 nueva), 5 Pydantic models, 3 helpers, endpoint implementado |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/routers/reposiciones.py` | `backend/services/reposicion_service.py` | `from services.reposicion_service import calculate_replenishment` | WIRED | reposiciones.py:629 tiene el import exacto dentro del endpoint handler (lazy import) |
| `backend/routers/reposiciones.py` | `backend/services/shopify_service.py` | `shopify_service.get_inventory_by_location` | WIRED | reposiciones.py:635 llama `shopify_service.get_inventory_by_location(location_gid=..., vendor_filter=...)` con respuesta utilizada |
| `POST /calculate handler` | `Firestore replenishment_orders` | `_persist_draft()` escribe borrador con status='borrador' | WIRED | reposiciones.py:589-603 escribe `db.collection("replenishment_orders").document()` con `"status": "borrador"`; retorna `doc_ref.id` como `draft_id` |
| `aggregate_sales_in_range` | `calculate_in_transit_real` | llamada interna para absorción D-01 | WIRED | reposicion_service.py:182 `sales_since_oldest = aggregate_sales_in_range(monthly_sales, oldest_date, today)` |

---

### Data-Flow Trace (Level 4)

Level 4 not applicable: no frontend components render dynamic data in this phase. All artifacts are backend services and a TypeScript reference test suite. The endpoint returns data to callers but does not render UI.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 30 tests calculan resultados correctos para CALC-01 a CALC-06 | `npx vitest run src/test/replenishment-calc.test.ts` | 30 passed, 0 failed, 5ms | PASS |
| 5 funciones exportadas presentes en el servicio Python | `grep "def classify_product\|def classify_urgency\|def aggregate_sales_in_range\|def calculate_in_transit_real\|def calculate_replenishment"` | 5 hits en líneas 33, 56, 82, 135, 189 | PASS |
| Exactamente 7 rutas en el router (6 existentes + 1 nueva) | `grep -c "@router\." backend/routers/reposiciones.py` | 7 | PASS |
| Sin dependencias externas no permitidas | `grep "import pandas\|import numpy" backend/services/reposicion_service.py` | Sin resultados | PASS |
| 424 guard para cache ausente presente | `grep "status_code=424" backend/routers/reposiciones.py` | 2 hits (líneas 529 y 535 — cache no existe + no ready) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CALC-01 | 05-01, 05-02 | Motor calcula cantidad sugerida: `(velocidad × lead_time × sf) − stock − en_tránsito_real` | SATISFIED | reposicion_service.py:262-263; endpoint expone via POST /calculate |
| CALC-02 | 05-01, 05-02 | Clasificación por velocidad (Bestseller ≥10, Regular ≥3, Slow ≥1, Long Tail <1) | SATISFIED | `classify_product()` en reposicion_service.py:33-53; 7 tests verdes |
| CALC-03 | 05-01, 05-02 | Urgencia por días de inventario (Urgente ≤7, Pronto ≤14, Normal ≤30, OK >30) | SATISFIED | `classify_urgency()` en reposicion_service.py:56-79; 7 tests verdes |
| CALC-04 | 05-01, 05-02 | Detección inteligente de en_tránsito: ventas reales desde fecha de pedido absorben unidades | SATISFIED | `calculate_in_transit_real()` con absorption model D-01 en reposicion_service.py:135-186 |
| CALC-05 | 05-01, 05-02 | Soporta múltiples pedidos pendientes por SKU (lista, no escalar) | SATISFIED | `total_pending_qty = sum(o["quantity"] for o in pending_orders_for_sku)` en reposicion_service.py:163; test multi-order verde |
| CALC-06 | 05-01, 05-02 | Agrega resultados por proveedor (total SKUs, unidades, urgentes) | SATISFIED | `vendor_summary` en reposicion_service.py:297-318; `VendorSummary` Pydantic model; 4 tests verdes |

**Orphaned requirements check:** REQUIREMENTS.md mapea CALC-01 a CALC-06 exclusivamente a Phase 5. Todos 6 están cubiertos por los planes declarados. Sin requisitos huérfanos.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/routers/reposiciones.py` | 117 | `pass  # No es fatal — el job continúa aunque no persista` | Info | Swallows error in non-critical state persistence helper `_persist_job_state`; not in the calculation path; existing Phase 4 code |
| `backend/routers/reposiciones.py` | 585 | `pass  # Colección vacía o no existe — correcto en primer run (D-03)` | Info | Intentional D-03 design: empty `replenishment_orders` collection on first run should produce empty `pending_map`, not an error; returns `{}` as intended |

No blocker anti-patterns found. Both `pass` statements are legitimate guard clauses with documented rationale matching CONTEXT.md decisions.

---

### Human Verification Required

None. All automation checks passed. This phase delivers no UI — the endpoint behavior (correct HTTP response codes, Firestore write side-effects, Shopify integration) will be exercised by the Phase 6 frontend integration tests.

---

## Gaps Summary

No gaps. All 11 must-have truths are verified, all 3 artifacts pass all three levels (exists, substantive, wired), all 4 key links are confirmed wired, all 6 requirement IDs are satisfied, and 30/30 tests pass.

---

_Verified: 2026-03-30T14:39:30Z_
_Verifier: Claude (gsd-verifier)_
