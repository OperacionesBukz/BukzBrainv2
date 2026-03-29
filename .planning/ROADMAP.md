# Roadmap: BukzBrain v1.0

## Overview

Milestone v1.0 delivers two independent capabilities: a real-time notification system so users stay informed of task assignments and request approvals, and a centralized supplier management system that migrates 150+ hardcoded suppliers to Firestore with full CRUD and dynamic backend queries. Phase 1 builds notifications (no dependencies on existing data migration), Phase 2 builds supplier management (independent of notifications).

## Phases

**Phase Numbering:**
- Integer phases (1, 2): Planned milestone work
- Decimal phases (1.1, 1.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Sistema de Notificaciones** - Notificaciones en tiempo real con Firestore, badge en navbar, panel desplegable, y navegacion a recursos
- [ ] **Phase 2: Gestion de Proveedores Centralizada** - Migrar proveedores hardcodeados a Firestore, CRUD frontend, consultas dinamicas backend, import/export Excel

## Phase Details

### Phase 1: Sistema de Notificaciones
**Goal**: Usuarios reciben y gestionan notificaciones en tiempo real sobre eventos relevantes del sistema
**Depends on**: Nothing (first phase)
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07, NOTIF-08
**Success Criteria** (what must be TRUE):
  1. Cuando a un usuario se le asigna una tarea, aparece una notificacion sin recargar la pagina
  2. El navbar muestra un badge con el conteo exacto de notificaciones no leidas, y el badge desaparece cuando todas estan leidas
  3. Al hacer click en el icono de notificaciones se abre un panel con la lista de notificaciones ordenadas por fecha
  4. El usuario puede marcar notificaciones como leidas (individual y masivamente) y al hacer click en una notificacion navega directamente al recurso relacionado
  5. Admin recibe notificacion cuando se crea una solicitud de permiso; usuario recibe notificacion cuando su solicitud es aprobada o rechazada
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Gestion de Proveedores Centralizada
**Goal**: Admins gestionan proveedores desde el frontend y el backend consulta proveedores dinamicamente desde Firestore en vez de datos hardcodeados
**Depends on**: Nothing (independent of Phase 1)
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, PROV-07, PROV-08, PROV-09
**Success Criteria** (what must be TRUE):
  1. Admin ve la lista completa de proveedores en el frontend con busqueda por nombre, correo o ciudad
  2. Admin puede crear, editar y eliminar proveedores desde el frontend con todos los campos requeridos (empresa, correo, ciudad, NIT, margen)
  3. Los 150+ proveedores hardcodeados en el backend aparecen en Firestore despues de la migracion, y el backend de devoluciones y cortes consulta proveedores desde Firestore en vez de datos hardcodeados
  4. Admin puede exportar la lista de proveedores a Excel y puede importar proveedores desde un archivo Excel
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Sistema de Notificaciones | 0/? | Not started | - |
| 2. Gestion de Proveedores Centralizada | 0/? | Not started | - |
