# Phase 7: Aprobación, Pedidos y Exportación - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-03-30
**Phase:** 07-aprobaci-n-pedidos-y-exportaci-n
**Areas discussed:** Approval Flow, Vendor Selection, Excel/ZIP Export, Mark as Sent
**Mode:** --auto (all decisions auto-selected)

---

## Approval Flow UI
| Option | Selected |
|--------|----------|
| Botón entre tabla y resumen, visible solo con draft en Borrador | Yes (auto) |
| Botón al final de la página | |
| Modal de confirmación antes de aprobar | |

## Vendor Selection
| Option | Selected |
|--------|----------|
| Checkboxes en VendorSummaryPanel existente, todos selected por default | Yes (auto) |
| Paso separado con lista de proveedores | |
| Dialog con selección | |

## Excel/ZIP Export
| Option | Selected |
|--------|----------|
| Backend genera ZIP base64 (patrón envio-cortes existente) | Yes (auto) |
| Frontend genera Excel con ExcelJS | |
| Backend devuelve URL temporal de descarga | |

## Mark as Sent
| Option | Selected |
|--------|----------|
| Botón por proveedor en VendorSummaryPanel con badge de estado | Yes (auto) |
| Botón global "Marcar Todos Enviados" | |
| Panel separado de gestión de pedidos | |
