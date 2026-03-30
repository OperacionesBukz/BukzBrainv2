# Requirements: BukzBrain v2.0 — Reposiciones Automatizadas

**Defined:** 2026-03-30
**Core Value:** Automatizar la reposición de inventario con datos reales de Shopify, flujo de aprobación y tracking de pedidos

## v1 Requirements

### Shopify Data Pipeline

- [ ] **SHOP-01**: Backend obtiene lista de Locations (sedes) de Shopify y las expone como endpoint
- [ ] **SHOP-02**: Backend obtiene niveles de inventario por Location para productos filtrados por proveedor
- [ ] **SHOP-03**: Backend obtiene lista de proveedores únicos desde productos de Shopify
- [ ] **SHOP-04**: Backend ejecuta Bulk Operation para extraer ventas históricas (6 meses configurable) con `currentQuantity`
- [ ] **SHOP-05**: Backend persiste ventas agregadas por SKU/mes en Firestore como cache (invalidación >24h)
- [ ] **SHOP-06**: Backend reutiliza cache de ventas en ejecuciones posteriores (solo jala delta desde última actualización)
- [ ] **SHOP-07**: Backend implementa guard para evitar conflicto de bulk operations simultáneas con módulo ingreso

### Motor de Cálculo

- [ ] **CALC-01**: Motor calcula cantidad sugerida por SKU: `(velocidad_ventas * lead_time * safety_factor) - stock_actual - en_transito_real`
- [ ] **CALC-02**: Motor clasifica productos por velocidad de ventas (Bestseller ≥10/mes, Regular ≥3, Slow ≥1, Long Tail <1)
- [ ] **CALC-03**: Motor asigna nivel de urgencia basado en días de inventario (Urgente ≤7, Pronto ≤14, Normal ≤30, OK >30)
- [ ] **CALC-04**: Motor detecta inventario en tránsito inteligentemente — para cada pedido pendiente (Aprobado/Enviado), consulta ventas reales de Shopify desde la fecha del pedido; si ventas ≥ cantidad pedida, entiende que la demanda absorbió esas unidades y NO descuenta; solo descuenta como en tránsito las unidades no absorbidas por ventas
- [ ] **CALC-05**: Motor soporta múltiples pedidos pendientes por SKU (lista, no escalar) y calcula en tránsito neto correctamente
- [ ] **CALC-06**: Motor agrega resultados por proveedor (total SKUs, total unidades, conteo urgentes)

### Configuración

- [ ] **CONF-01**: Usuario selecciona sede (Location) desde dropdown poblado por Shopify
- [ ] **CONF-02**: Usuario filtra proveedores con multi-select (todos o selección específica)
- [ ] **CONF-03**: Usuario configura lead time en días (default 14, rango 1-90)
- [ ] **CONF-04**: Usuario configura rango de ventas para análisis (default 6 meses)
- [ ] **CONF-05**: Sistema persiste última configuración usada por usuario

### Sugerido y Aprobación

- [ ] **APPR-01**: Al generar sugerido, se crea un borrador en Firestore con todos los SKUs, cantidades sugeridas y métricas
- [ ] **APPR-02**: Usuario ve tabla de sugerido con búsqueda por SKU/título/proveedor y filtro por urgencia
- [ ] **APPR-03**: Usuario puede editar cantidades sugeridas por línea (inline edit) y eliminar SKUs del sugerido
- [ ] **APPR-04**: Usuario ve resumen por proveedor (total títulos, total unidades) antes de aprobar
- [ ] **APPR-05**: Usuario aprueba el sugerido (Borrador → Aprobado) con registro de quién aprobó y cuándo
- [ ] **APPR-06**: Usuario selecciona a qué proveedores generar pedidos del sugerido aprobado

### Pedidos y Exportación

- [ ] **ORD-01**: Sistema genera pedido individual por proveedor seleccionado en Firestore con estado Aprobado
- [ ] **ORD-02**: Sistema genera archivo Excel (.xlsx) por proveedor con SKU, título, cantidad, stock actual
- [ ] **ORD-03**: Sistema genera ZIP con todos los Excel de proveedores seleccionados para descarga
- [ ] **ORD-04**: Usuario puede marcar pedido como "Enviado" después de descargar/enviar al proveedor
- [ ] **ORD-05**: KPIs visibles: total productos analizados, necesitan reposición, urgentes, agotados, proveedores con pedidos

### Historial de Pedidos

- [ ] **HIST-01**: Usuario ve lista de todos los pedidos generados con filtros por proveedor, fecha y estado
- [ ] **HIST-02**: Cada pedido muestra estado actual con transiciones explícitas (Aprobado → Enviado → Parcial → Recibido)
- [ ] **HIST-03**: Usuario puede ver detalle de un pedido con todos sus SKUs y cantidades
- [ ] **HIST-04**: Usuario puede re-descargar el Excel de un pedido desde el historial
- [ ] **HIST-05**: Audit trail: quién creó, quién aprobó, timestamps de cada transición de estado

## v2 Requirements (Deferred)

### Análisis Avanzado

- **ADV-01**: Tendencia de velocidad de ventas por SKU (acelerando vs declinando)
- **ADV-02**: Link de pedido a Shopify draft order para trazabilidad
- **ADV-03**: Recalcular sugerido sin perder overrides manuales del usuario

### Optimización UX

- **UX-01**: Persistir configuración de lead time diferenciada por proveedor
- **UX-02**: Dashboard de métricas de reposición (frecuencia, cumplimiento, tiempos de entrega)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Envío automático de pedidos a proveedores | Proveedores reciben Excel por email manual — auto-send elimina check humano necesario |
| Cadenas de aprobación multi-nivel | Equipo pequeño, un aprobador es suficiente |
| Actualizar inventario Shopify desde este módulo | El módulo Ingreso Mercancía maneja entrada de stock |
| Notificaciones email por transición de estado | Sobrecarga de correos para equipo interno pequeño |
| Forecasting con ML/AI | Volumen de Bukz no justifica la complejidad — media móvil es suficiente |
| Portal de proveedores con login | Scope de producto diferente |
| Escaneo de código de barras para recepción | Demasiado complejo para MVP |
| Alertas de stock en tiempo real / push | Service workers no justificados para uso interno |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHOP-01 | TBD | Pending |
| SHOP-02 | TBD | Pending |
| SHOP-03 | TBD | Pending |
| SHOP-04 | TBD | Pending |
| SHOP-05 | TBD | Pending |
| SHOP-06 | TBD | Pending |
| SHOP-07 | TBD | Pending |
| CALC-01 | TBD | Pending |
| CALC-02 | TBD | Pending |
| CALC-03 | TBD | Pending |
| CALC-04 | TBD | Pending |
| CALC-05 | TBD | Pending |
| CALC-06 | TBD | Pending |
| CONF-01 | TBD | Pending |
| CONF-02 | TBD | Pending |
| CONF-03 | TBD | Pending |
| CONF-04 | TBD | Pending |
| CONF-05 | TBD | Pending |
| APPR-01 | TBD | Pending |
| APPR-02 | TBD | Pending |
| APPR-03 | TBD | Pending |
| APPR-04 | TBD | Pending |
| APPR-05 | TBD | Pending |
| APPR-06 | TBD | Pending |
| ORD-01 | TBD | Pending |
| ORD-02 | TBD | Pending |
| ORD-03 | TBD | Pending |
| ORD-04 | TBD | Pending |
| ORD-05 | TBD | Pending |
| HIST-01 | TBD | Pending |
| HIST-02 | TBD | Pending |
| HIST-03 | TBD | Pending |
| HIST-04 | TBD | Pending |
| HIST-05 | TBD | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 34

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 after initial definition*
