# Phase 6: Wizard Frontend — Config y Sugeridos - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Módulo React en `/reposiciones` que permite al usuario configurar parámetros de reposición (sede, proveedores, lead time, rango de fechas), lanzar el cálculo contra el backend, ver una tabla editable de sugeridos por SKU y un resumen por proveedor. Todo desde una single-page sin stepper. NO incluye aprobación, generación de pedidos ni exportación Excel (eso es Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Wizard Flow / Page Structure
- **D-01:** Single-page layout con secciones — configuración arriba, resultados abajo. No stepper ni tabs. Consistente con el patrón de `ConfigurationPanel.tsx` existente.
- **D-02:** La sección de resultados aparece solo después de un cálculo exitoso. Antes del primer cálculo, solo se muestra la configuración.
- **D-03:** Ruta nueva `/reposiciones` (plural) — separada del módulo existente `/reposicion` (CSV-based). Ambas coexisten en PAGE_REGISTRY.

### Sales Cache Handling
- **D-04:** Flujo automático de cache: al lanzar cálculo, si no hay sales cache o está stale (>24h), el sistema automáticamente lanza refresh, muestra barra de progreso con polling a `/sales/status`, y ejecuta el cálculo al completar.
- **D-05:** Si hay cache válido (<24h), el cálculo se ejecuta directamente sin refresh. El usuario ve un indicador de "última actualización" del cache.
- **D-06:** Si hay una Bulk Operation en progreso (409), mostrar mensaje claro al usuario con opción de reintentar después.

### Tabla de Sugeridos
- **D-07:** Inline edit directo en celda — click en la celda de `suggested_qty` la convierte en input editable. Enter o blur confirma. Patrón natural para tablas de datos.
- **D-08:** El usuario puede eliminar filas (SKUs) del sugerido con botón de eliminar por fila.
- **D-09:** Si el usuario recalcula, los overrides manuales (cantidades editadas) se preservan para SKUs que sigan en el resultado. Mantener map local de overrides por SKU.
- **D-10:** Búsqueda por SKU/título/proveedor y filtro por urgencia (URGENTE/PRONTO/NORMAL/OK) en la tabla.
- **D-11:** Columnas de la tabla: SKU, Título, Proveedor, Stock, Ventas/mes, Urgencia (badge color), Sugerido (editable), En Tránsito. Clasificación visible como badge.

### Resumen por Proveedor
- **D-12:** Card o tabla resumen debajo de la tabla de sugeridos — muestra por proveedor: total títulos, total unidades a pedir, conteo de urgentes. Ordenado por urgentes desc.

### Configuración UI
- **D-13:** Location: dropdown simple poblado por `GET /locations` (useLocations hook).
- **D-14:** Proveedores: multi-select con "Todos" como default. Poblado por `GET /vendors`.
- **D-15:** Lead time: input numérico, default 14, rango 1-90.
- **D-16:** Rango de fechas: input numérico en meses (default 6, rango 1-12). NO date picker — simplificado.
- **D-17:** Safety factor: input numérico, default 1.5, rango 1.0-3.0.

### Persistencia de Config (CONF-05)
- **D-18:** Guardar última configuración en Firestore collection `replenishment_config`, documento por user UID. Campos: location_id, vendors, lead_time_days, safety_factor, date_range_days, updated_at.
- **D-19:** Al abrir el módulo, pre-cargar la config guardada. Si no existe, usar defaults (location: primera disponible, vendors: todos, lead_time: 14, safety_factor: 1.5, date_range: 6 meses).

### Claude's Discretion
- Estructura interna de componentes (cuántos archivos, cómo dividir)
- Diseño exacto de la tabla (shadcn Table vs custom)
- Animaciones y transiciones entre estados (loading, empty, results)
- Estado local vs React Query cache para overrides de cantidades
- Estilo de los badges de urgencia y clasificación (colores exactos)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing replenishment module (reference implementation)
- `src/pages/reposicion/types.ts` — TypeScript types: ProductAnalysis, VendorSummary, ReplenishmentStats, thresholds, classification configs
- `src/pages/reposicion/ConfigurationPanel.tsx` — Config panel pattern: sede dropdown + lead time
- `src/pages/reposicion/ProductDetailTable.tsx` — Table with product details (reference for new editable table)
- `src/pages/reposicion/VendorSummaryTable.tsx` — Vendor summary display pattern
- `src/pages/reposicion/StatCards.tsx` — KPI stat cards pattern

### Backend API contract
- `backend/routers/reposiciones.py` — All endpoints: locations, vendors, inventory, sales/*, calculate
- `backend/services/reposicion_service.py` — Calculation service with Pydantic models

### Frontend patterns (follow these)
- `src/pages/gift-cards/api.ts` — API call pattern with resilientFetch + handleResponse
- `src/pages/gift-cards/hooks.ts` — React Query hooks pattern (useQuery, useMutation)
- `src/pages/devoluciones/hooks.ts` — Firestore + React Query mix pattern

### Page registration
- `src/lib/pages.ts` — PAGE_REGISTRY definition, workspace types
- `src/App.tsx` — Lazy route registration pattern

### Phase context
- `.planning/phases/04-pipeline-de-datos-shopify/04-CONTEXT.md` — Phase 4 decisions on endpoints and data formats
- `.planning/phases/05-motor-de-c-lculo-de-reposici-n/05-CONTEXT.md` — Phase 5 decisions on calculation contract and response structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConfigurationPanel.tsx`: Sede dropdown + lead time input pattern — adapt for new module
- `ProductDetailTable.tsx`: Product table with detail rows — reference for editable table
- `VendorSummaryTable.tsx`: Vendor aggregation display — reuse pattern
- `StatCards.tsx`: KPI cards — reuse for stats display
- `types.ts`: ProductAnalysis, VendorSummary, classification/urgency configs — port types to match backend response
- shadcn components: Select, Input, Table, Card, Badge, Button, Toast, Progress — all available

### Established Patterns
- Page structure: `{Page}.tsx` + `api.ts` + `hooks.ts` + `types.ts` + sub-components
- API calls: `resilientFetch` wrapper with `handleResponse<T>()` error handling
- React Query: `useQuery` for GET, `useMutation` for POST, `queryClient.invalidateQueries()` on success
- API_BASE from `import.meta.env.VITE_API_URL`
- Dark/light mode: Tailwind classes with `dark:` prefix
- Toast: `toast.success()`, `toast.error()` from Sonner

### Integration Points
- New route `/reposiciones` in App.tsx (lazy loaded)
- New entry in PAGE_REGISTRY (`src/lib/pages.ts`) with workspace "operaciones"
- Backend endpoints at `/api/reposiciones/*` (already implemented in Phase 4-5)
- Firestore `replenishment_config` collection (new — needs firestore.rules update)
- Firestore `replenishment_orders` for reading draft after calculate

</code_context>

<specifics>
## Specific Ideas

- El flujo es: abrir módulo → config pre-cargada → ajustar si quiere → click "Calcular" → (auto-refresh cache si necesario) → ver tabla de sugeridos → editar cantidades → ver resumen por proveedor → (Phase 7: aprobar)
- El módulo existente de Reposición (CSV) sigue disponible como fallback — NO eliminarlo
- Los badges de urgencia deben usar colores intuitivos: rojo para URGENTE, amarillo para PRONTO, azul para NORMAL, verde para OK
- La tabla debe manejar potencialmente 500+ filas — considerar virtualización si el rendimiento es un problema

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-wizard-frontend-config-y-sugeridos*
*Context gathered: 2026-03-30*
