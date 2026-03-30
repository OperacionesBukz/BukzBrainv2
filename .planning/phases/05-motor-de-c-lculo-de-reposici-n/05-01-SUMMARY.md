---
phase: 05-motor-de-c-lculo-de-reposici-n
plan: 01
subsystem: backend-calculation-engine
tags: [python, pure-functions, tdd, replenishment, calculation]
dependency_graph:
  requires: []
  provides: [backend/services/reposicion_service.py, src/test/replenishment-calc.test.ts]
  affects: [backend/routers/reposiciones.py (Plan 02 imports calculate_replenishment)]
tech_stack:
  added: []
  patterns:
    - Pure Python calculation service (no FastAPI, no Firestore dependencies)
    - TDD with TypeScript reference tests for Python behavioral contract
    - Month-range sales aggregation with proportional day-weighting
    - Absorption-based in-transit detection using oldest pending order date
key_files:
  created:
    - backend/services/reposicion_service.py
    - src/test/replenishment-calc.test.ts
  modified: []
decisions:
  - "Calculos como funciones puras sin dependencias HTTP/Firestore — testables en aislamiento"
  - "Tests en TypeScript (no pytest) — proyecto sin test framework backend configurado"
  - "aggregate_sales_in_range usa +1 para inclusion de ambos extremos (Pitfall 1 guardado)"
  - "None como sentinel para days_of_inventory cuando daily_sales=0 (vs string N/A del TypeScript)"
metrics:
  duration: "3 minutes 23 seconds"
  completed_date: "2026-03-30"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 05 Plan 01: Motor de Calculo de Reposicion — Service Layer Summary

**One-liner:** Pure Python replenishment calculation engine with TDD — absorption-based in-transit detection using oldest pending order date anchor and proportional month-range sales aggregation.

## What Was Built

`backend/services/reposicion_service.py` — Python service module of pure calculation functions with no FastAPI or Firestore dependencies. Implements CALC-01 through CALC-06 as described in 05-CONTEXT.md decisions D-01 to D-18.

`src/test/replenishment-calc.test.ts` — TypeScript test suite (30 tests, 6 describe blocks) that documents behavioral contract for the Python implementation. Written as reference implementation tests using equivalent TypeScript functions.

## Functions Exported

| Function | Requirement | Description |
|----------|-------------|-------------|
| `classify_product(sales_per_month)` | CALC-02 | Returns (classification, label) — Bestseller/Regular/Slow/Long Tail |
| `classify_urgency(days_of_inventory)` | CALC-03 | Returns (urgency, label) — URGENTE/PRONTO/NORMAL/OK; None → OK |
| `aggregate_sales_in_range(monthly_sales, start, end)` | CALC-04 | Proportional month-range sales sum with +1 inclusive bounds |
| `calculate_in_transit_real(sku, pending_orders, monthly_sales, today)` | CALC-04+05 | D-01 absorption model — oldest date anchor, multi-order support |
| `calculate_replenishment(inventory, sales_cache, pending_orders_map, params)` | CALC-01+06 | Main entry point — full per-SKU analysis + vendor aggregation + stats |

## Key Implementation Details

**Absorption algorithm (D-01):**
- Collects ALL pending orders for a SKU (status aprobado/enviado)
- Uses oldest pending order date as absorption anchor
- `absorbed = min(sales_since_oldest_date, total_pending_qty)`
- `in_transit_real = max(0, total_pending_qty - absorbed)`
- Empty pending orders → 0 (D-03, first-run correct behavior)

**Core formula (D-05):**
```python
suggested_qty = max(0, math.ceil((daily_sales * lead_time_days * safety_factor) - stock - in_transit_real))
```

**Month-range aggregation (Pitfall 1 guard):**
```python
days_covered = (overlap_end - overlap_start).days + 1  # CRITICAL: +1 inclusive
```

**Zero-velocity guard (Pitfall 2):**
```python
days_of_inventory = (stock / daily_sales) if daily_sales > 0 else None
```

## Test Coverage

All 30 tests GREEN:
- `classify_product`: 7 cases (boundary at 10, 3, 1)
- `classify_urgency`: 7 cases (boundary at 7, 14, 30; null → OK)
- `calculate_suggested_qty`: 4 formula cases (D-05 variants)
- `aggregate_sales_in_range`: 4 cases (full month, partial, cross-month, empty)
- `calculate_in_transit_real`: 4 cases (empty, fully absorbed, partial, multi-order)
- `aggregate_by_vendor`: 4 cases (totals, sort, tie-break, exclusion of zero-qty)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (RED) | 3cf8438 | test(05-01): add replenishment calc test suite CALC-01 to CALC-06 |
| Task 2 (GREEN) | 648dfa1 | feat(05-01): implement reposicion_service.py — motor de calculo puro |

## Deviations from Plan

None — plan executed exactly as written.

## Integration Contract for Plan 02

Plan 02 (`backend/routers/reposiciones.py`) imports:
```python
from services.reposicion_service import calculate_replenishment
```

Call signature:
```python
result = calculate_replenishment(
    inventory_items=inventory,          # [{sku, title, vendor, available}]
    sales_cache=sales_cache,            # {sku: {YYYY-MM: int}}
    pending_orders_map=pending_map,     # {sku: [pending_order_dicts]}
    params={
        "lead_time_days": 14,
        "safety_factor": 1.5,
        "date_range_days": 180,
        "date_range_start": date(...),
        "date_range_end": date(...),
    }
)
# result: {"products": [...], "vendor_summary": [...], "stats": {...}}
```

## Known Stubs

None — all functions are fully implemented with no placeholder data.

## Self-Check: PASSED

- [x] `backend/services/reposicion_service.py` exists and has 5 functions
- [x] `src/test/replenishment-calc.test.ts` exists with 6 describe blocks and 30 tests
- [x] Commit 3cf8438 exists (test file)
- [x] Commit 648dfa1 exists (service file)
- [x] No pandas/numpy imports
- [x] SCHEMA CONTRACT comment present
- [x] All 30 tests GREEN
