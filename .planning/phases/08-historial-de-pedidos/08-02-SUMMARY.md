---
phase: 08-historial-de-pedidos
plan: 02
subsystem: frontend
tags: [react, typescript, firebase, tabs, collapsible, sort, order-history]
dependency_graph:
  requires: [08-01]
  provides: [order-history-ui, tab-layout, expandable-rows]
  affects: [src/pages/reposiciones]
tech_stack:
  added: []
  patterns: [shadcn-tabs, shadcn-collapsible, client-side-sort-usememo, onSnapshot-realtime]
key_files:
  created:
    - src/pages/reposiciones/components/OrderHistoryTab.tsx
    - src/pages/reposiciones/components/ExpandableOrderRow.tsx
  modified:
    - src/pages/reposiciones/index.tsx
decisions:
  - Two-tab layout in index.tsx wraps all existing Nuevo Sugerido content in TabsContent preserving full functionality
  - ExpandableOrderRow uses Collapsible asChild pattern to render as TableRow/TableCell — avoids invalid DOM nesting
  - Sort applied via useMemo on top of hook-filtered orders to avoid listener teardown on sort change
  - useOrderDetail fetches only when isOpen=true to avoid N+1 Firestore reads on table load
metrics:
  duration: 3m27s
  completed: "2026-03-31"
  tasks_completed: 3
  files_created: 2
  files_modified: 1
requirements: [HIST-01, HIST-02, HIST-03, HIST-04, HIST-05]
---

# Phase 8 Plan 2: Order History UI Summary

**One-liner:** Two-tab Reposiciones page with filterable/sortable history table, collapsible detail rows showing SKU table and audit trail, inline status transitions, and individual Excel re-download.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | OrderHistoryTab and ExpandableOrderRow components | 8ded574 | OrderHistoryTab.tsx, ExpandableOrderRow.tsx |
| 2 | Wire tabs into index.tsx with post-generate link | f2b6938 | index.tsx |
| 3 | Visual verification (auto-approved) | — | — |

## What Was Built

### OrderHistoryTab (`src/pages/reposiciones/components/OrderHistoryTab.tsx`)

- Filter bar: vendor dropdown (from useVendors), status dropdown, date range inputs, clear button
- Sortable table headers for Proveedor, Fecha Creacion, Estado with ArrowUpDown/ArrowUp/ArrowDown icons
- `toggleSort()` function resets direction to `desc` for created_at, `asc` for other fields on first click
- Client-side sort via `useMemo` applied on top of the hook's filtered result — avoids Firestore listener teardown
- STATUS_BADGES map with dark mode variants for all four statuses (aprobado, enviado, parcial, recibido)
- TRANSITIONS map defines permitted state machine: aprobado→enviado, enviado→{parcial|recibido}, parcial→recibido, recibido→[]
- Inline toast confirmation via `useStatusTransition` — no modal per D-07
- Loading and empty states handled in table body
- ScrollArea with min-w-[700px] inner div for table overflow control

### ExpandableOrderRow (`src/pages/reposiciones/components/ExpandableOrderRow.tsx`)

- `Collapsible asChild` pattern renders as native TableRow elements (avoids invalid DOM nesting)
- `useOrderDetail(isOpen ? order.order_id : null)` — lazy fetch only when row is expanded
- Expanded panel: SKU detail table (SKU, Titulo, Cantidad, Stock), audit trail (created/approved/status_history entries), Descargar Excel button
- `status_history ?? []` fallback prevents crash on orders without history
- `toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })` for Spanish date formatting
- `e.stopPropagation()` on action buttons prevents accidental row collapse/expand when clicking transitions

### index.tsx Tabs Refactor

- Added `useState<"sugerido" | "historial">` for tab control
- Imports: `Tabs, TabsContent, TabsList, TabsTrigger` from `@/components/ui/tabs`; `OrderHistoryTab`
- Header (h1 + timestamp) stays outside Tabs — visible on both tabs
- All existing Nuevo Sugerido content preserved inside `<TabsContent value="sugerido">`
- "Ver pedidos generados →" link button appears after `generatedOrders` is non-empty, switches to historial tab (D-02)
- `<TabsContent value="historial">` renders `<OrderHistoryTab />`
- Zero changes to existing logic, state, handlers, or component tree

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired to real Firestore via useOrderHistory (onSnapshot) and useOrderDetail (React Query + backend API).

## Self-Check: PASSED

Files exist:
- src/pages/reposiciones/components/OrderHistoryTab.tsx: FOUND
- src/pages/reposiciones/components/ExpandableOrderRow.tsx: FOUND
- src/pages/reposiciones/index.tsx: FOUND (modified)

Commits exist:
- 8ded574: feat(08-02): add OrderHistoryTab and ExpandableOrderRow components — FOUND
- f2b6938: feat(08-02): wire tabs into reposiciones index with post-generate link — FOUND

TypeScript: zero errors (`npx tsc --noEmit` clean)
Build: success (`npm run build` completes in 15s)
