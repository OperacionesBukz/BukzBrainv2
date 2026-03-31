# Phase 8: Historial de Pedidos - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Vista de historial de todos los pedidos generados por el módulo de reposiciones. El usuario puede consultar pedidos pasados, filtrar por proveedor/fecha/estado, ver detalle de SKUs, re-descargar Excel, y avanzar el estado del pedido a través de las transiciones permitidas (Aprobado -> Enviado -> Parcial -> Recibido) con trazabilidad completa (quién creó, quién aprobó, timestamps de cada transición).

NO incluye: modificar cantidades de pedidos ya generados, crear pedidos nuevos desde historial, ni analytics/dashboards de métricas de reposición.

</domain>

<decisions>
## Implementation Decisions

### Vista y Navegacion
- **D-01:** El historial se implementa como un tab dentro de la misma pagina `/reposiciones`. Dos tabs: "Nuevo Sugerido" (flujo actual de config -> calcular -> aprobar -> generar) y "Historial de Pedidos" (lista filtrable). No se registra ruta nueva — se usa estado local para tab activo.
- **D-02:** Al generar pedidos exitosamente en el tab "Nuevo Sugerido", se ofrece un link/boton para ir al tab de historial ("Ver pedidos generados").

### Tabla de Historial
- **D-03:** Tabla con columnas: Proveedor, Fecha Creacion, Estado (badge de color), Items (conteo), Acciones (botones de transicion + re-descarga). Filtros inline sobre la tabla: dropdown de proveedor, dropdown de estado, date range para fecha.
- **D-04:** Los datos se cargan desde Firestore con `onSnapshot` para tiempo real — si otro usuario cambia un estado, se refleja sin recargar (HIST-01 exige esto).
- **D-05:** Ordenamiento por defecto: fecha de creacion descendente (mas recientes primero). El usuario puede hacer click en cabeceras para cambiar ordenamiento.

### Transiciones de Estado
- **D-06:** Cada fila muestra un boton con la siguiente transicion permitida: Aprobado -> "Marcar Enviado", Enviado -> "Marcar Parcial" o "Marcar Recibido", Parcial -> "Marcar Recibido". Las transiciones no son estrictas — desde Enviado se puede ir a Parcial O directamente a Recibido.
- **D-07:** Sin modal de confirmacion para transiciones — boton inline directo con toast de confirmacion. Consistente con el patron de `handleMarkSent` ya implementado en Phase 7.
- **D-08:** Cada transicion se registra con timestamp y UID del usuario en el documento Firestore. Estructura: `status_history: [{status, changed_by, changed_at}]` como array — permite audit trail completo (HIST-05).
- **D-09:** El estado "Recibido" es terminal — no se puede cambiar despues. El boton desaparece.

### Vista de Detalle
- **D-10:** Panel expandible (collapsible row) dentro de la tabla de historial. Al hacer click en una fila, se expande mostrando la tabla de SKUs del pedido (SKU, Titulo, Cantidad, Stock al momento del pedido).
- **D-11:** En el panel expandido se muestra tambien: el audit trail (quien creo, quien aprobo, timestamps de cada transicion) y el boton de re-descarga del Excel.

### Re-descarga Excel
- **D-12:** Boton "Descargar Excel" en el panel de detalle de cada pedido. Reutiliza el endpoint `POST /orders/export` existente del backend pasando un solo order_id. Descarga un .xlsx individual (no ZIP para un solo pedido).
- **D-13:** Alternativa: nuevo endpoint `GET /orders/{order_id}/export` que devuelve el Excel individual en base64. Mas limpio que reusar el endpoint ZIP para un solo archivo. Claude's Discretion en cual enfoque usar.

### Backend Endpoints Nuevos
- **D-14:** `GET /api/reposiciones/orders` — Lista todos los pedidos (no borradores) con filtros opcionales: vendor, status, date_from, date_to. Response: lista de ordenes con metadata (sin items completos para mantener respuesta liviana).
- **D-15:** `GET /api/reposiciones/orders/{order_id}` — Detalle completo de un pedido con items y status_history.
- **D-16:** `PATCH /api/reposiciones/orders/{order_id}/status` — Transicion de estado generica. Body: `{status, changed_by}`. Valida transiciones permitidas. Agrega entrada a status_history.
- **D-17:** El endpoint existente `PATCH /orders/{order_id}/send` de Phase 7 se puede deprecar o mantener como alias del nuevo endpoint generico de transiciones.

### Claude's Discretion
- Estructura interna de componentes del tab de historial (cuantos archivos, como organizar)
- Diseno exacto de los filtros (inline en la tabla vs barra separada)
- Colores de badges por estado (Aprobado=azul, Enviado=verde, Parcial=amber, Recibido=gray)
- Animacion del panel expandible
- Si usar el endpoint ZIP existente o crear uno nuevo para descarga individual de Excel
- Paginacion vs scroll infinito para la tabla (depende del volumen esperado)

### Folded Todos
No hay todos relevantes para esta fase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 7 codebase (build on top of this)
- `src/pages/reposiciones/index.tsx` — Main page, add tab navigation here
- `src/pages/reposiciones/types.ts` — Extend ReplenishmentOrder type with new statuses and status_history
- `src/pages/reposiciones/api.ts` — Add list, detail, status transition, and individual export endpoints
- `src/pages/reposiciones/hooks.ts` — Add useOrderHistory (onSnapshot), useOrderDetail, useStatusTransition hooks
- `src/pages/reposiciones/components/VendorSummaryPanel.tsx` — Reference for mark-sent pattern

### Backend
- `backend/routers/reposiciones.py` — Add GET /orders, GET /orders/{id}, PATCH /orders/{id}/status endpoints
- `backend/services/reposicion_service.py` — Reference for Firestore patterns

### Existing patterns
- `src/pages/envio-cortes/api.ts` — `downloadZipFromBase64()` pattern (already in reposiciones/api.ts)
- `src/pages/reposiciones/api.ts:111-120` — `markOrderSent()` pattern for status transitions

### Firestore
- `replenishment_orders` collection — Orders already stored here from Phase 7; extend documents with `status_history` array
- `firestore.rules` — May need update for new query patterns (list with filters)

### Requirements
- `.planning/REQUIREMENTS.md` §Historial de Pedidos — HIST-01 through HIST-05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ReplenishmentOrder` type (types.ts) — Extend with `"parcial" | "recibido"` statuses and `status_history`
- `downloadZipFromBase64()` (api.ts) — Reuse for re-download
- `handleMarkSent()` pattern (index.tsx) — Template for all status transition handlers
- `resilientFetch` + `handleResponse<T>` — API call pattern
- `useMarkSent` hook (hooks.ts) — Template for generic status transition hook
- `Badge` component — For status display (already used for "Aprobado")
- `StatCard` component — If KPIs are needed in history view

### Established Patterns
- React Query: `useQuery` for reads, `useMutation` for writes, `queryKey` structure `["reposiciones", ...]`
- Firestore: `onSnapshot` for real-time (used in other modules like tasks), but history could use `useQuery` + polling depending on real-time needs
- Toast: `toast.success/error` from Sonner for all user feedback
- Table: Project has `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` from shadcn/ui

### Integration Points
- Tab navigation in `index.tsx` — Wrap existing content in tab, add history tab
- `replenishment_orders` Firestore documents — Need `status_history` migration strategy for existing docs (add field on first transition)
- Backend router in `reposiciones.py` — Add new endpoints alongside existing ones

</code_context>

<specifics>
## Specific Ideas

- El historial complementa el flujo de "Nuevo Sugerido" — son los dos lados del modulo de reposiciones
- Los pedidos con status "borrador" NO deben aparecer en el historial (solo pedidos generados: aprobado, enviado, parcial, recibido)
- El `status_history` array se construye incrementalmente — documentos existentes de Phase 7 no lo tendran, asi que el codigo debe manejar el caso de array ausente
- La transicion "Parcial" es un estado de conveniencia para cuando el proveedor envio parte del pedido — no requiere tracking granular de que items llegaron

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-historial-de-pedidos*
*Context gathered: 2026-03-30*
