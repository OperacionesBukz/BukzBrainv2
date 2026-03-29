# Requirements: BukzBrain v1.0

**Defined:** 2026-03-29
**Core Value:** Centralizar y automatizar las operaciones diarias de Bukz

## v1 Requirements

Requirements for milestone v1.0. Each maps to roadmap phases.

### Notificaciones

- [ ] **NOTIF-01**: Usuario recibe notificación en tiempo real cuando le asignan una tarea
- [ ] **NOTIF-02**: Usuario recibe notificación cuando su solicitud de permiso es aprobada o rechazada
- [ ] **NOTIF-03**: Admin recibe notificación cuando se crea una nueva solicitud de permiso
- [ ] **NOTIF-04**: Usuario ve badge con contador de notificaciones no leídas en el navbar
- [ ] **NOTIF-05**: Usuario puede abrir panel desplegable con lista de notificaciones
- [ ] **NOTIF-06**: Usuario puede marcar notificaciones como leídas (individual y todas)
- [ ] **NOTIF-07**: Al hacer click en una notificación, el usuario navega al recurso relacionado
- [ ] **NOTIF-08**: Las notificaciones se almacenan en Firestore con onSnapshot para tiempo real

### Proveedores

- [ ] **PROV-01**: Admin puede ver lista completa de proveedores desde el frontend
- [ ] **PROV-02**: Admin puede crear nuevo proveedor con campos: empresa, correo, ciudad, NIT, margen
- [ ] **PROV-03**: Admin puede editar datos de un proveedor existente
- [ ] **PROV-04**: Admin puede eliminar un proveedor
- [ ] **PROV-05**: Usuario puede buscar proveedores por nombre, correo o ciudad
- [ ] **PROV-06**: Los 150+ proveedores hardcodeados se migran a colección Firestore
- [ ] **PROV-07**: Backend de devoluciones consulta proveedores dinámicamente desde Firestore
- [ ] **PROV-08**: Backend de envío de cortes consulta proveedores dinámicamente desde Firestore
- [ ] **PROV-09**: Admin puede importar/exportar proveedores desde Excel

## v2 Requirements

### Notificaciones Avanzadas

- **NOTIF-A01**: Notificación cuando un pedido Celesa se atrasa más de X días
- **NOTIF-A02**: Resumen diario de notificaciones por email
- **NOTIF-A03**: Preferencias de notificación configurables por usuario

### Proveedores Avanzados

- **PROV-A01**: Historial de cambios por proveedor (auditoría)
- **PROV-A02**: Métricas de proveedor (devoluciones, cortes, cumplimiento)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Push notifications nativas (Service Workers) | Complejidad excesiva para equipo interno pequeño |
| Notificaciones por email automáticas | Sobrecarga de correos, solo en v2 como resumen diario |
| Integración con ERP externo para proveedores | No aplica al contexto actual |
| App móvil de notificaciones | Web-first, acceso via navegador |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NOTIF-01 | Phase 1 | Pending |
| NOTIF-02 | Phase 1 | Pending |
| NOTIF-03 | Phase 1 | Pending |
| NOTIF-04 | Phase 1 | Pending |
| NOTIF-05 | Phase 1 | Pending |
| NOTIF-06 | Phase 1 | Pending |
| NOTIF-07 | Phase 1 | Pending |
| NOTIF-08 | Phase 1 | Pending |
| PROV-01 | Phase 2 | Pending |
| PROV-02 | Phase 2 | Pending |
| PROV-03 | Phase 2 | Pending |
| PROV-04 | Phase 2 | Pending |
| PROV-05 | Phase 2 | Pending |
| PROV-06 | Phase 2 | Pending |
| PROV-07 | Phase 2 | Pending |
| PROV-08 | Phase 2 | Pending |
| PROV-09 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 after initial definition*
