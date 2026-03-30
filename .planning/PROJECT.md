# BukzBrain

## What This Is

Sistema operativo interno de Bukz — una SPA en React+TypeScript con backend FastAPI, Firebase como base de datos, e integración con Shopify. Gestiona tareas, solicitudes, inventario, productos, devoluciones, cortes a proveedores, gift cards, enriquecimiento ISBN y un asistente IA. Desplegado en GitHub Pages (frontend) + EasyPanel (backend).

## Core Value

Centralizar y automatizar las operaciones diarias de Bukz para que el equipo pueda gestionar inventario, proveedores y comunicaciones desde una sola herramienta.

## Requirements

### Validated

- ✓ AUTH — Login email/password con Firebase Auth, roles admin/usuario, permisos por página
- ✓ TASKS — Tareas personales y departamentales con Kanban, drag-drop, prioridades
- ✓ REQUESTS — Solicitudes de permisos/vacaciones con aprobación admin
- ✓ BOOKSTORE — Pedidos de librerías con catálogo de productos
- ✓ INVENTORY — Ingreso mercancía, búsqueda productos, inventario multi-bodega
- ✓ PRODUCTS — Creación y actualización masiva de productos en Shopify
- ✓ SCRAP — Enriquecimiento ISBN con 9 scrapers paralelos
- ✓ CORTES — Procesamiento 3x2, descuentos, envío de cortes a proveedores
- ✓ DEVOLUCIONES — Gestión de devoluciones a sedes y proveedores
- ✓ GIFTCARDS — Creación y listado de gift cards Shopify
- ✓ CELESA — Tracking de pedidos Celesa
- ✓ DIRECTORY — Directorio de empleados, temporales y proveedores
- ✓ ASSISTANT — Asistente IA multi-proveedor con herramientas
- ✓ ADMIN — Gestión de usuarios, permisos y configuración

### Active

- [ ] Módulo Reposiciones con integración Shopify API (inventario, ventas, productos por proveedor)
- [ ] Motor de cálculo de reposición con detección inteligente de inventario en tránsito
- [ ] Flujo de aprobación de sugeridos (borrador → aprobación → pedidos)
- [ ] Historial de pedidos con tracking de estados
- [ ] Cache de ventas históricas en Firestore via Bulk Operations

### Out of Scope

- Push notifications nativas — Complejidad de service workers, no justificada para uso interno
- Email notifications automáticas para cada evento — Sobrecarga de correos, solo eventos críticos
- Integración con sistemas ERP externos — Fuera del alcance actual

## Context

- Frontend: React 18 + TypeScript + Vite, shadcn/ui, Tailwind CSS
- Backend: FastAPI en EasyPanel, integración Shopify GraphQL/REST
- Base de datos: Firebase Firestore con tiempo real (onSnapshot)
- 150+ proveedores hardcodeados en backend/services/devoluciones.py
- El directorio frontend ya tiene tab de proveedores pero no conecta con backend
- Auth deshabilitado temporalmente en backend (placeholder)
- 3 scrapers son stubs (Panamericana, Lerner, TornameSa)

## Constraints

- **Stack**: No agregar dependencias sin confirmar — proyecto ya tiene muchas
- **UI**: Todo en español, soporte dark/light mode obligatorio
- **Firebase**: No modificar firestore.rules sin confirmación explícita
- **Deploy**: Frontend en GitHub Pages, backend en EasyPanel
- **Permisos**: Nuevas páginas deben registrarse en PAGE_REGISTRY y navigation_permissions

## Current Milestone: v2.0 Reposiciones Automatizadas

**Goal:** Nuevo módulo "Reposiciones" con integración Shopify API, motor de cálculo inteligente con detección de inventario en tránsito basado en ventas reales, flujo de aprobación y tracking de pedidos.

**Target features:**
- Conexión directa a Shopify API para inventario por Location/Sede y productos por proveedor
- Ventas históricas (6 meses) via Bulk Operations API + cache en Firestore
- Configuración: sede, filtro de proveedores, lead time, rango de ventas
- Motor de cálculo inteligente con detección de inventario en tránsito — usa ventas reales de Shopify desde la fecha del pedido pendiente para determinar cuánto se vendió vs cuánto está realmente en camino
- Flujo de aprobación: borrador → revisión/edición cantidades → aprobación
- Selección de proveedores para generar pedidos individuales
- Descarga ZIP con Excel por proveedor
- Historial de pedidos con estados (Borrador → Aprobado → Enviado → Parcial → Recibido)
- Persistencia en Firestore de sugeridos, pedidos y cache de ventas

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Firestore para notificaciones | Ya se usa onSnapshot en todo el proyecto, consistencia | — Pending |
| Proveedores en Firestore (no PostgreSQL) | Mantener un solo backend de datos, ya hay directorio | — Pending |
| No push notifications | Uso interno, overkill para equipo pequeño | — Pending |
| Shopify Bulk Operations para ventas 6 meses | Maneja cualquier volumen, async, JSONL output | — Pending |
| Cache ventas en Firestore | Primera vez 1-3 min, recurrentes instantáneo | — Pending |
| Motor cálculo en Python (no JS) | Datos vienen de Shopify via backend, no CSV upload | — Pending |
| Inventario en tránsito basado en ventas reales | Más preciso que comparar stock — usa ventas de Shopify desde fecha del pedido | — Pending |
| Módulo nuevo "Reposiciones" separado del existente | Seguridad: no romper lo existente hasta validar | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-30 after Phase 6 completion — wizard frontend config y sugeridos*
