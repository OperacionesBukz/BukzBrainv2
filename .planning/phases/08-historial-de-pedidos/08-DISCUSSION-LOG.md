# Phase 8: Historial de Pedidos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 08-historial-de-pedidos
**Areas discussed:** Vista y navegacion, Tabla de historial, Transiciones de estado, Vista de detalle
**Mode:** --auto (all decisions auto-selected)

---

## Vista y Navegacion

| Option | Description | Selected |
|--------|-------------|----------|
| Tab dentro de `/reposiciones` | Dos tabs en la misma pagina: Nuevo Sugerido + Historial | :heavy_check_mark: |
| Sub-ruta `/reposiciones/historial` | Pagina separada con ruta propia | |
| Pagina independiente `/historial-pedidos` | Modulo completamente separado | |

**User's choice:** [auto] Tab dentro de `/reposiciones` (recommended default)
**Notes:** Mantiene todo en un solo modulo, no requiere registrar nueva ruta, consistente con flujo lineal existente.

---

## Tabla de Historial

| Option | Description | Selected |
|--------|-------------|----------|
| Tabla con filtros inline | Dropdowns de proveedor, estado y fecha sobre la tabla | :heavy_check_mark: |
| Tabla con barra de filtros separada | Filtros en card separada arriba de la tabla | |
| Cards por pedido | Vista de tarjetas en lugar de tabla | |

**User's choice:** [auto] Tabla con filtros inline (recommended default)
**Notes:** Patron familiar del proyecto, eficiente en espacio, columnas: Proveedor, Fecha, Estado, Items, Acciones.

---

## Transiciones de Estado

| Option | Description | Selected |
|--------|-------------|----------|
| Boton inline sin confirmacion | Boton en cada fila con la siguiente transicion, toast de confirmacion | :heavy_check_mark: |
| Boton con modal de confirmacion | Modal dialog antes de cada transicion | |
| Menu dropdown de estados | Dropdown que muestra todas las transiciones posibles | |

**User's choice:** [auto] Boton inline sin confirmacion (recommended default)
**Notes:** Consistente con patron handleMarkSent de Phase 7. Transiciones no estrictas: Enviado puede ir a Parcial o Recibido.

---

## Vista de Detalle

| Option | Description | Selected |
|--------|-------------|----------|
| Panel expandible (collapsible row) | Click en fila expande panel con SKUs y audit trail | :heavy_check_mark: |
| Modal/Dialog | Popup con detalle completo | |
| Pagina de detalle separada | Navegar a /reposiciones/pedido/:id | |

**User's choice:** [auto] Panel expandible (recommended default)
**Notes:** Evita navegacion, acceso rapido, muestra SKUs + audit trail + boton re-descarga Excel.

---

## Claude's Discretion

- Estructura interna de componentes del tab de historial
- Diseno exacto de filtros y badges por estado
- Animacion del panel expandible
- Endpoint individual de Excel vs reusar ZIP endpoint
- Paginacion vs scroll

## Deferred Ideas

None — discussion stayed within phase scope
