# Phase 7: Aprobación, Pedidos y Exportación - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Flujo post-cálculo en el mismo módulo `/reposiciones`: el usuario aprueba el borrador (Borrador→Aprobado con transacción Firestore), selecciona proveedores del resumen para generar pedidos individuales, descarga un ZIP con un Excel por proveedor, y puede marcar cada pedido como "Enviado". Los KPIs (total analizados, urgentes, agotados, proveedores con pedidos) son visibles en todo momento. NO incluye historial de pedidos ni transiciones Enviado→Parcial→Recibido (eso es Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Approval Flow
- **D-01:** Botón "Aprobar Sugerido" visible solo cuando hay resultados de cálculo y el draft está en estado Borrador. Se ubica entre la tabla de sugeridos y el resumen por proveedor — prominente, no perdido al fondo.
- **D-02:** Al aprobar, transacción Firestore que: (1) lee el documento borrador, (2) verifica status === "borrador", (3) actualiza a status "aprobado" con approved_by (UID), approved_at (serverTimestamp), y los productos efectivos (con overrides y eliminaciones aplicadas). Si otro ya aprobó, la transacción falla → toast de error claro.
- **D-03:** Después de aprobar, el botón "Aprobar" desaparece y se muestra un badge "Aprobado" con nombre del aprobador y fecha. La sección de config queda deshabilitada (no se puede recalcular sobre un borrador ya aprobado).

### Vendor Selection & Order Generation
- **D-04:** En el VendorSummaryPanel (ya existente), se añade un checkbox por proveedor. Default: todos seleccionados. El usuario deselecciona los que no quiere incluir en el pedido.
- **D-05:** Botón "Generar Pedidos" visible solo después de aprobar. Al hacer click, crea un documento por proveedor seleccionado en Firestore `replenishment_orders` con status "aprobado", items (SKUs filtrados por ese proveedor con cantidades efectivas), y metadata (draft_id, created_by, created_at).
- **D-06:** Schema del pedido en Firestore: `{ draft_id, vendor, status: "aprobado", items: [{sku, title, quantity, stock}], created_by, created_at, sent_at?, sent_by? }`

### Excel Export & ZIP Download
- **D-07:** Botón "Descargar ZIP" visible después de generar pedidos. El backend genera los Excel y devuelve un ZIP en base64 — mismo patrón que envío-cortes (`downloadZipFromBase64`).
- **D-08:** Backend endpoint `POST /api/reposiciones/orders/export` recibe lista de order_ids, genera un .xlsx por pedido (columnas: SKU, Título, Cantidad, Stock Actual), los empaqueta en ZIP y devuelve base64.
- **D-09:** El nombre del ZIP: `pedidos_reposicion_YYYY-MM-DD.zip`. Cada Excel: `pedido_{vendor_name}.xlsx`.

### Mark as Sent
- **D-10:** Después de descargar, cada proveedor en el VendorSummaryPanel muestra un botón "Marcar Enviado". Al hacer click, actualiza status del pedido a "enviado" con sent_at y sent_by en Firestore.
- **D-11:** El badge de estado cambia visualmente: "Aprobado" (azul) → "Enviado" (verde). El botón desaparece una vez marcado.

### KPIs
- **D-12:** Los KPIs ya están implementados en Phase 6 (StatCards en index.tsx). Se mantienen visibles: total productos, necesitan reposición, urgentes, agotados. Se agrega un KPI más: "Proveedores con pedidos" que se calcula del vendor_summary.
- **D-13:** Los KPIs no cambian al aprobar/generar pedidos — reflejan el resultado del cálculo, no el estado del flujo.

### Backend Endpoints Nuevos
- **D-14:** `POST /api/reposiciones/approve` — Aprueba un draft (transacción Firestore). Body: `{draft_id, products: [{sku, quantity}]}`. Response: `{status: "approved", approved_at}`.
- **D-15:** `POST /api/reposiciones/orders/generate` — Genera pedidos por proveedor. Body: `{draft_id, vendors: ["vendor1", ...]}`. Response: `{orders: [{order_id, vendor, item_count}]}`.
- **D-16:** `POST /api/reposiciones/orders/export` — Genera ZIP con Excel. Body: `{order_ids: ["id1", ...]}`. Response: base64 ZIP.
- **D-17:** `PATCH /api/reposiciones/orders/{order_id}/send` — Marca pedido como enviado. Response: `{status: "enviado", sent_at}`.

### Page Flow
- **D-18:** El flujo en la misma página es lineal: Config → Calcular → [Ver resultados + editar] → Aprobar → [Seleccionar proveedores] → Generar Pedidos → Descargar ZIP → Marcar Enviados.
- **D-19:** Cada paso habilita el siguiente. No se puede generar pedidos sin aprobar. No se puede descargar sin generar. No se puede marcar enviado sin descargar (o generar al menos).

### Claude's Discretion
- Estructura interna de componentes nuevos vs modificar existentes
- Diseño exacto de los badges de estado (colores, iconos)
- Animaciones de transición entre estados del flujo
- Cómo deshabilitar visualmente la sección de config después de aprobar
- Manejo de errores para cada endpoint (toasts específicos)

</decisions>

<canonical_refs>
## Canonical References

### Phase 6 codebase (build on top of this)
- `src/pages/reposiciones/index.tsx` — Main page with draftId state already wired
- `src/pages/reposiciones/components/VendorSummaryPanel.tsx` — Add checkboxes + status badges here
- `src/pages/reposiciones/components/SuggestionsTable.tsx` — Existing editable table
- `src/pages/reposiciones/types.ts` — Extend with approval/order types
- `src/pages/reposiciones/api.ts` — Add approve, generate, export, send endpoints
- `src/pages/reposiciones/hooks.ts` — Add useApprove, useGenerateOrders, useExportZip, useMarkSent mutations

### Backend
- `backend/routers/reposiciones.py` — Add approve, orders/generate, orders/export, orders/{id}/send endpoints
- `backend/services/reposicion_service.py` — Extend with approval and order generation logic

### Existing patterns for ZIP/Excel
- `src/pages/envio-cortes/api.ts` — `downloadZipFromBase64()` pattern to reuse
- `backend/routers/envio_cortes.py` — Excel generation + ZIP + base64 response pattern
- `backend/routers/corte_museo.py` — Another Excel generation example

### Firestore
- `replenishment_orders` collection — Already used for drafts in Phase 5, extend for orders
- `firestore.rules` — May need update for order documents (check if current rules cover it)

</canonical_refs>

<code_context>
## Existing Code Insights

### Already Wired
- `draftId` state exists in index.tsx — ready for approval flow
- `VendorSummaryPanel` already shows vendor list — add checkboxes
- `overridesMap` and `deletedSkus` — effective products can be computed for approval
- `replenishment_orders` Firestore collection — drafts already use it
- `downloadZipFromBase64` utility — exact pattern needed for ZIP download

### Patterns to Follow
- API: resilientFetch + handleResponse<T>
- Hooks: useMutation with queryClient.invalidateQueries
- Toast: toast.success/error from Sonner
- Backend: FastAPI router with Pydantic models
- Excel: openpyxl in backend (already in requirements.txt)

</code_context>

<specifics>
## Specific Ideas

- El flujo se siente como un pipeline vertical: cada acción habilita la siguiente sección
- Los productos efectivos al aprobar deben incluir overrides y exclusiones del usuario (no los originales del cálculo)
- La transacción de aprobación es crítica para evitar doble aprobación
- El "Proveedores con pedidos" KPI solo es relevante después de generar pedidos

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-aprobaci-n-pedidos-y-exportaci-n*
*Context gathered: 2026-03-30*
