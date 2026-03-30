---
phase: 04-pipeline-de-datos-shopify
plan: 01
subsystem: api
tags: [shopify, graphql, fastapi, inventory, vendors, locations]

# Dependency graph
requires:
  - phase: existing-backend
    provides: shopify_service.get_locations(), ShopifyThrottler, settings helpers

provides:
  - "GET /api/reposiciones/locations — lista de sedes Shopify [{name, id}]"
  - "GET /api/reposiciones/vendors — proveedores con conteo [{name, product_count}]"
  - "GET /api/reposiciones/inventory — niveles de stock filtrados por sede y proveedor"
  - "get_vendors_from_shopify() en shopify_service.py (paginado)"
  - "get_inventory_by_location() en shopify_service.py (paginado, filtro vendor)"

affects:
  - 04-02-pipeline-de-datos-shopify
  - 06-wizard-frontend

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "APIRouter con prefix /api/reposiciones siguiendo patrón existente de ingreso.py"
    - "Paginación GraphQL con pageInfo/hasNextPage/endCursor"
    - "Rate limiting reactivo con _throttler.wait_if_needed() antes de cada request"

key-files:
  created:
    - backend/routers/reposiciones.py
  modified:
    - backend/services/shopify_service.py
    - backend/main.py

key-decisions:
  - "get_locations() devuelve {name: id} (int) — el router lo convierte a [{name, id}] para la API"
  - "vendor_filter=None significa 'todos los proveedores' (no filtrar); lista vacía también retorna todos"
  - "Endpoint inventory acepta vendors[] como alias de Query param para compatibilidad con frontend"

patterns-established:
  - "Patrón paginación GraphQL: cursor = None, while True, after_clause condicional, break en !hasNextPage"
  - "Patrón filtro vendor: if vendor_filter and vendor not in vendor_filter: continue"

requirements-completed: [SHOP-01, SHOP-02, SHOP-03]

# Metrics
duration: 5min
completed: 2026-03-30
---

# Phase 4 Plan 01: Pipeline de Datos Shopify — Endpoints Maestros

**Router FastAPI /api/reposiciones con 3 endpoints GET paginados para locations, vendors e inventory usando GraphQL de Shopify**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-30T18:49:00Z
- **Completed:** 2026-03-30T18:53:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Agregadas `get_vendors_from_shopify()` y `get_inventory_by_location()` a shopify_service.py con paginación completa via GraphQL cursor y rate limiting reactivo
- Creado router `reposiciones.py` con 3 endpoints GET bajo `/api/reposiciones` protegidos con Firebase auth
- Router registrado en `main.py` siguiendo el patrón existente con `dependencies=_auth`

## Task Commits

Cada tarea fue commiteada atómicamente:

1. **Tarea 1: Agregar funciones get_vendors_from_shopify() y get_inventory_by_location()** - `1c2f676` (feat)
2. **Tarea 2: Crear router reposiciones.py y registrar en main.py** - `953477b` (feat)

**Plan metadata:** (pendiente — creado después del commit final)

## Files Created/Modified
- `backend/services/shopify_service.py` - Agregadas 2 funciones nuevas al final: get_vendors_from_shopify() (paginación de todos los productos) y get_inventory_by_location() (inventario por sede con filtro vendor)
- `backend/routers/reposiciones.py` - Router nuevo con endpoints /locations, /vendors, /inventory
- `backend/main.py` - Agregado import y include_router de reposiciones con auth Firebase

## Decisions Made
- `get_locations()` existente devuelve `{name: int_id}` — el endpoint `/locations` convierte a `[{name, id}]` en el router para consistencia con el contrato del frontend
- `vendor_filter=None` y lista vacía equivalen a "sin filtro" (todos los proveedores)
- Endpoint `/inventory` usa `alias="vendors[]"` para aceptar query params repetibles desde el frontend

## Deviations from Plan

None - plan ejecutado exactamente como estaba escrito.

## Issues Encountered

- El entorno local no tiene todas las dependencias de `main.py` instaladas (firebase_admin, httpx) — esto es pre-existente y no afecta el código entregado. La verificación se realizó importando el router directamente (`from routers.reposiciones import router`) confirmando las 3 rutas y el prefix correcto.

## User Setup Required

None - no se requiere configuración externa adicional. Los endpoints usan las mismas credenciales Shopify ya configuradas en el backend.

## Next Phase Readiness
- Los 3 endpoints maestros están listos para consumo del frontend (Phase 6)
- Plan 02 puede construir sobre este router agregando endpoints `/sales/refresh`, `/sales/status`, `/sales/data` para las Bulk Operations

---
*Phase: 04-pipeline-de-datos-shopify*
*Completed: 2026-03-30*
