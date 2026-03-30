# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-30)

**Core value:** Centralizar y automatizar las operaciones diarias de Bukz
**Current focus:** Milestone v2.0 - Reposiciones Automatizadas — Phase 4

## Current Position

Phase: 4 — Pipeline de Datos Shopify
Plan: —
Status: Roadmap defined, ready for Phase 4 planning
Last activity: 2026-03-30 — Roadmap v2.0 created

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

Last session: 2026-03-30
Stopped at: Roadmap v2.0 creado (5 fases, 34 requirements mapeados), listo para planear Phase 4
Resume file: None
