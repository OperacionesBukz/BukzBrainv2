# Roadmap: BukzBrain v2.0 — Reposiciones Automatizadas

## Overview

Milestone v2.0 entrega un módulo completo de reposición automatizada de inventario. El punto de partida es el pipeline de datos de Shopify — sin datos reales, nada más puede funcionar. Desde ahí, el motor de cálculo Python procesa ventas históricas e inventario en tránsito para generar sugeridos por SKU. El frontend wizard permite configurar parámetros, revisar y editar sugeridos, aprobar el borrador y seleccionar proveedores para generar pedidos. Los pedidos se exportan como Excel por proveedor (descarga ZIP) y se rastrean hasta su recepción en el historial.

Las fases 1–3 del milestone v1.0 están pausadas. Las fases de este milestone continúan desde el 4.

## Phases

**Phase Numbering:**
- Integer phases (4–8): Milestone v2.0 planned work (continues from v1.0's Phase 3)
- Decimal phases (4.1, 4.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 4: Pipeline de Datos Shopify** - Endpoints de Locations, inventario por sede y proveedor, y cache de ventas históricas (6 meses) via Bulk Operations con persistencia en Firestore (completed 2026-03-30)
- [x] **Phase 5: Motor de Cálculo de Reposición** - Servicio Python que calcula cantidad sugerida por SKU con fórmula velocidad×lead_time − stock − en_tránsito, clasificación por velocidad y urgencia, y detección inteligente de inventario en tránsito desde pedidos pendientes (completed 2026-03-30)
- [x] **Phase 6: Wizard Frontend — Config y Sugeridos** - Módulo React /reposiciones con wizard de configuración (sede, proveedores, lead time, rango fechas), tabla editable de sugeridos y resumen por proveedor (completed 2026-03-30)
- [ ] **Phase 7: Aprobación, Pedidos y Exportación** - Flujo Borrador→Aprobado con transacción Firestore, generación de pedidos por proveedor, exportación Excel+ZIP, acción "Marcar como Enviado" y KPIs
- [ ] **Phase 8: Historial de Pedidos** - Lista de todos los pedidos con filtros, detalle por pedido, re-descarga Excel, transiciones de estado Aprobado→Enviado→Parcial→Recibido y audit trail completo

## Phase Details

### Phase 4: Pipeline de Datos Shopify
**Goal**: El backend expone datos reales de Shopify — sedes, inventario y ventas históricas cacheadas — para que el motor de cálculo pueda operar con datos precisos y rápidos
**Depends on**: Nothing (first phase of milestone)
**Requirements**: SHOP-01, SHOP-02, SHOP-03, SHOP-04, SHOP-05, SHOP-06, SHOP-07
**Success Criteria** (what must be TRUE):
  1. GET /api/reposiciones/locations devuelve la lista de sedes de Shopify con id y nombre, y el frontend puede poblar un dropdown con ellas
  2. GET /api/reposiciones/inventory?location_id=X&vendor=Y devuelve niveles de stock reales de Shopify filtrados por sede y proveedor
  3. POST /api/reposiciones/sales/refresh inicia una Bulk Operation y persiste ventas agregadas por SKU/mes en Firestore `sales_cache`; una segunda llamada dentro de 24h devuelve el cache sin lanzar nueva operación
  4. Si ya hay una Bulk Operation corriendo (ya sea del módulo de ingreso u otro), el endpoint devuelve un error claro `OPERATION_IN_PROGRESS` en vez de silenciar el conflicto
  5. Si el backend se reinicia mientras una Bulk Operation está en progreso, el estado del job se recupera desde Firestore y no queda huérfano
**Plans**: 2 planes
Plans:
- [x] 04-01-PLAN.md — Router skeleton + endpoints locations, vendors, inventory + registro en main.py
- [x] 04-02-PLAN.md — Bulk Operations worker + endpoints sales/refresh, status, data + Firestore cache + conflict guard
**UI hint**: no

### Phase 5: Motor de Cálculo de Reposición
**Goal**: El backend calcula cantidades sugeridas de reposición por SKU usando ventas reales, lead time configurable y detección precisa de inventario en tránsito desde pedidos pendientes en Firestore
**Depends on**: Phase 4
**Requirements**: CALC-01, CALC-02, CALC-03, CALC-04, CALC-05, CALC-06
**Success Criteria** (what must be TRUE):
  1. POST /api/reposiciones/calculate devuelve una lista de SKUs con cantidad sugerida calculada como `(velocidad_ventas × lead_time × safety_factor) − stock_actual − en_tránsito_real`
  2. Cada SKU en el resultado tiene clasificación de velocidad (Bestseller / Regular / Slow / Long Tail) y nivel de urgencia (Urgente / Pronto / Normal / OK) basados en los umbrales definidos
  3. Para un SKU con dos pedidos pendientes distintos, el cálculo de en_tránsito descuenta correctamente las unidades absorbidas por ventas reales de Shopify desde la fecha de cada pedido, sin contar doble
  4. Los resultados están agrupados por proveedor con totales de SKUs, unidades y conteo de urgentes
**Plans**: 2 planes
Plans:
- [x] 05-01-PLAN.md — Test scaffold (CALC-01 a CALC-06) + reposicion_service.py con funciones puras de cálculo
- [x] 05-02-PLAN.md — POST /calculate endpoint en reposiciones.py + Pydantic models + Firestore draft persistence
**UI hint**: no

### Phase 6: Wizard Frontend — Config y Sugeridos
**Goal**: El usuario puede configurar los parámetros de una corrida de reposición, lanzar el cálculo, ver la tabla de sugeridos y editar cantidades antes de aprobar — todo desde el módulo /reposiciones
**Depends on**: Phase 4, Phase 5
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, APPR-01, APPR-02, APPR-03, APPR-04
**Success Criteria** (what must be TRUE):
  1. El usuario selecciona una sede desde un dropdown poblado con datos reales de Shopify, elige uno o más proveedores desde un multi-select, define lead time y rango de fechas, y puede lanzar el cálculo con esos parámetros
  2. El sistema recuerda la última configuración del usuario y la pre-carga al abrir el módulo nuevamente
  3. La tabla de sugeridos muestra todos los SKUs con cantidad sugerida, stock actual, velocidad de ventas, urgencia y proveedor; el usuario puede buscar por SKU/título/proveedor y filtrar por urgencia
  4. El usuario puede editar la cantidad sugerida de cualquier línea inline y eliminar SKUs del sugerido; si recalcula, los overrides manuales no se pierden
  5. El usuario ve un resumen por proveedor (total títulos, total unidades) antes de decidir aprobar
**Plans**: 3 planes
Plans:
- [x] 06-01-PLAN.md — Types, API layer, React Query hooks, Firestore config hook, page/route registration
- [x] 06-02-PLAN.md — ConfigPanel + VendorMultiSelect components, main page with config persistence and calculate trigger
- [x] 06-03-PLAN.md — SuggestionsTable (editable) + VendorSummaryPanel + full page wiring + visual verification
**UI hint**: yes

### Phase 7: Aprobación, Pedidos y Exportación
**Goal**: El usuario aprueba el sugerido, selecciona proveedores para generar pedidos y descarga un ZIP con un Excel por proveedor, con KPIs visibles en todo momento
**Depends on**: Phase 6
**Requirements**: APPR-05, APPR-06, ORD-01, ORD-02, ORD-03, ORD-04, ORD-05
**Success Criteria** (what must be TRUE):
  1. Al aprobar el sugerido, el estado cambia de Borrador a Aprobado en Firestore con registro de quién aprobó y cuándo; si dos sesiones intentan aprobar simultáneamente, solo una tiene éxito y la otra recibe un error claro
  2. El usuario selecciona un subconjunto de proveedores del sugerido aprobado y el sistema genera un pedido individual en Firestore por cada proveedor seleccionado
  3. Al hacer click en "Descargar", el sistema genera un ZIP con un archivo Excel por proveedor (SKU, título, cantidad, stock actual) y el navegador descarga el archivo
  4. Después de descargar, el usuario puede marcar el pedido de un proveedor como "Enviado", lo que actualiza el estado visible en pantalla
  5. Los KPIs (total productos analizados, necesitan reposición, urgentes, agotados, proveedores con pedidos) son visibles en la pantalla sin necesidad de navegar a otra sección
**Plans**: 2 planes
Plans:
- [x] 07-01-PLAN.md — Backend 4 endpoints (approve, orders/generate, orders/export, orders/{id}/send) + TypeScript types + API functions + React Query mutations
- [ ] 07-02-PLAN.md — UI wiring: approval button + Aprobado badge, VendorSummaryPanel checkboxes + Marcar Enviado, Generar Pedidos + Descargar ZIP buttons, KPI update, Firestore rules
**UI hint**: yes

### Phase 8: Historial de Pedidos
**Goal**: El usuario puede consultar todos los pedidos históricos, ver su estado actual, re-descargar archivos y registrar transiciones de estado desde Aprobado hasta Recibido con trazabilidad completa
**Depends on**: Phase 7
**Requirements**: HIST-01, HIST-02, HIST-03, HIST-04, HIST-05
**Success Criteria** (what must be TRUE):
  1. El usuario ve la lista de todos los pedidos generados con filtros funcionales por proveedor, fecha de creación y estado; la lista se actualiza en tiempo real si otro usuario cambia un estado
  2. Cada pedido muestra su estado actual y el usuario puede avanzar el estado manualmente a través de las transiciones permitidas (Aprobado → Enviado → Parcial → Recibido)
  3. Al abrir el detalle de un pedido, el usuario ve todos los SKUs con sus cantidades pedidas en ese pedido específico
  4. El usuario puede re-descargar el Excel de cualquier pedido histórico desde la vista de historial
  5. Cada pedido muestra quién lo creó, quién lo aprobó y el timestamp de cada transición de estado registrada
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 4. Pipeline de Datos Shopify | 2/2 | Complete   | 2026-03-30 |
| 5. Motor de Cálculo de Reposición | 2/2 | Complete   | 2026-03-30 |
| 6. Wizard Frontend — Config y Sugeridos | 3/3 | Complete   | 2026-03-30 |
| 7. Aprobación, Pedidos y Exportación | 0/2 | Not started | - |
| 8. Historial de Pedidos | 0/? | Not started | - |
