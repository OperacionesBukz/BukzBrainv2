# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-30)

**Core value:** Centralizar y automatizar las operaciones diarias de Bukz
**Current focus:** Milestone v2.0 - Reposiciones Automatizadas

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-30 — Milestone v2.0 started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

## Accumulated Context

### Decisions

- Shopify Bulk Operations API para ventas históricas (6 meses, async, cualquier volumen)
- Cache de ventas agregadas en Firestore (primera vez 1-3 min, recurrentes instantáneo)
- Motor de cálculo en Python backend (datos de Shopify, no CSV)
- Inventario en tránsito basado en ventas reales de Shopify desde fecha del pedido
- Módulo nuevo "Reposiciones" separado del existente "Reposición" hasta validar

### Context from initialization

- Proyecto brownfield con 14+ módulos validados
- Backend FastAPI ya tiene integración Shopify GraphQL
- Módulo actual "Reposición" es 100% client-side (CSV upload → cálculo → ZIP download)
- El motor de cálculo existente (replenishment-engine.ts) tiene lógica válida para reusar en Python
- Shopify tiene Locations (sedes), Products con vendor, Orders para ventas
- Se preserva descarga ZIP con Excel por proveedor como feature

### Pending Todos

None yet.

### Blockers/Concerns

- Auth deshabilitado temporalmente en backend (placeholder)
- Bulk Operations API requiere webhook o polling para saber cuándo termina

## Session Continuity

Last session: 2026-03-30
Stopped at: Milestone v2.0 initialized, defining requirements
Resume file: None
