---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-01-PLAN.md — reposicion_service.py + test suite
last_updated: "2026-03-30T19:31:34.551Z"
last_activity: 2026-03-30
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 4
  completed_plans: 3
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-30)

**Core value:** Centralizar y automatizar las operaciones diarias de Bukz
**Current focus:** Phase 05 — motor-de-c-lculo-de-reposici-n

## Current Position

Phase: 05 (motor-de-c-lculo-de-reposici-n) — EXECUTING
Plan: 2 of 2
Status: Ready to execute
Last activity: 2026-03-30

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 4. Pipeline de Datos Shopify | 0/? | - | - |
| 5. Motor de Cálculo de Reposición | 0/? | - | - |
| 6. Wizard Frontend — Config y Sugeridos | 0/? | - | - |
| 7. Aprobación, Pedidos y Exportación | 0/? | - | - |
| 8. Historial de Pedidos | 0/? | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

| Phase 04-pipeline-de-datos-shopify P01 | 5 | 2 tasks | 3 files |
| Phase 04-pipeline-de-datos-shopify P02 | 3 | 2 tasks | 2 files |
| Phase 05-motor-de-c-lculo-de-reposici-n P01 | 3m23s | 2 tasks | 2 files |

## Accumulated Context

### Decisions

- Shopify Bulk Operations API para ventas históricas (6 meses, async, cualquier volumen)
- Cache de ventas agregadas en Firestore (primera vez 1-3 min, recurrentes instantáneo)
- Motor de cálculo en Python backend (datos de Shopify, no CSV)
- Inventario en tránsito basado en ventas reales de Shopify desde fecha del pedido
- Módulo nuevo "/reposiciones" separado del existente "/reposicion" hasta validar
- Fases v2.0 numeradas 4–8 (continúan desde el 3 del milestone v1.0 pausado)
- No agregar nuevas dependencias: openpyxl, pandas, httpx, firebase-admin ya en requirements.txt
- Usar `bulkOperation(id: $id)` (no `currentBulkOperation` — deprecado en API 2026-01+)
- Nunca almacenar la URL JSONL de Shopify en Firestore (expira en 7 días)
- Usar `currentQuantity` en bulk query (no `quantity`) para evitar inflación por ediciones
- Job state de Bulk Operations persistido en Firestore para sobrevivir reinicios del backend
- Firestore transactions para todas las transiciones de estado (prevenir race conditions)
- openpyxl write-only mode + generación secuencial por proveedor (prevenir memory explosion)
- Ruta del módulo: /reposiciones (registrar en PAGE_REGISTRY de pages.ts)
- [Phase 04]: get_locations() devuelve {name: id} int, el router reposiciones convierte a [{name, id}] para la API frontend
- [Phase 04]: Endpoint /inventory usa alias vendors[] en Query param para compatibilidad con frontend multi-select
- [Phase 04]: Use currentQuantity (not quantity) in reposiciones bulk query to avoid order edit inflation
- [Phase 04]: 409 guard in sales/refresh checks both local job state AND live Shopify API to prevent ingreso module conflicts
- [Phase 05-motor-de-c-lculo-de-reposici-n]: Calculos como funciones puras sin dependencias HTTP/Firestore — testables en aislamiento (Plan 01)
- [Phase 05-motor-de-c-lculo-de-reposici-n]: Tests en TypeScript (no pytest) — proyecto sin test framework backend configurado

### Context from initialization

- Proyecto brownfield con 14+ módulos validados
- Backend FastAPI ya tiene integración Shopify GraphQL con `get_locations()`, `start_bulk_operation()`, `check_bulk_operation_status()`
- Módulo actual "Reposición" es 100% client-side (CSV upload → cálculo → ZIP download) — NO tocar
- El motor de cálculo existente (replenishment-engine.ts) tiene lógica válida para portar a Python
- Shopify tiene Locations (sedes), Products con vendor, Orders para ventas
- Se preserva descarga ZIP con Excel por proveedor como feature clave
- 150+ proveedores en backend — el filtro multi-select de proveedores es obligatorio
- Nuevas colecciones Firestore: `sales_cache`, `replenishment_orders`, `replenishment_config` — requieren confirmación explícita de firestore.rules antes de deploy

### Pending Todos

- Confirmar con equipo Bukz qué `financial_status` de Shopify representa ventas reales (¿`paid`? ¿`fulfilled`?) antes de construir bulk query en Phase 4
- Verificar tamaño del documento `sales_cache/6m_global` durante Phase 4 — si >1MB, dividir en subcollections por prefijo de proveedor
- Confirmar que el cambio a `bulkOperation(id: $id)` en Phase 4 no rompe el módulo de ingreso existente (audit de código antes de implementar)
- Actualizar firestore.rules para nuevas colecciones antes de deploy de Phase 4

### Blockers/Concerns

- Auth deshabilitado temporalmente en backend (placeholder) — no bloquea desarrollo, sí bloquea deploy en producción
- Bulk Operations API requiere webhook o polling para saber cuándo termina — usar React Query `refetchInterval` para polling

## Session Continuity

Last session: 2026-03-30T19:31:34.547Z
Stopped at: Completed 05-01-PLAN.md — reposicion_service.py + test suite
Resume file: None
