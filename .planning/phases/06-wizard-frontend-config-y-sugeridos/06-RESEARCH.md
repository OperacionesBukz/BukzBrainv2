# Phase 6: Wizard Frontend — Config y Sugeridos - Research

**Researched:** 2026-03-30
**Domain:** React 18 + TypeScript frontend module with Firestore persistence and FastAPI backend integration
**Confidence:** HIGH

## Summary

Phase 6 builds the `/reposiciones` React module where the user configures replenishment parameters, triggers the calculation, views an editable suggested-order table, and sees a per-vendor summary. All backend endpoints (Phase 4–5) are already implemented and tested. The frontend needs to assemble new components following the established project patterns exactly — no new library dependencies are needed.

The key implementation challenges are: (1) the multi-step async calculation flow with optional cache refresh via polling, (2) inline cell editing in the suggestions table with preserved overrides across recalculations, (3) Firestore persistence of user config per UID, and (4) the multi-select vendor filter. All four have established patterns in the codebase to follow directly.

**Primary recommendation:** Model `src/pages/reposiciones/` exactly on the existing `src/pages/reposicion/` module structure — port and adapt `ConfigurationPanel`, `ProductDetailTable`, `VendorSummaryTable`, and `StatCards` rather than building from scratch. The only genuinely new code is: inline edit cell behavior, overrides map management, multi-select vendor picker, Firestore config persistence, and the cache-refresh polling flow.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Wizard Flow / Page Structure**
- D-01: Single-page layout con secciones — configuración arriba, resultados abajo. No stepper ni tabs. Consistente con el patrón de `ConfigurationPanel.tsx` existente.
- D-02: La sección de resultados aparece solo después de un cálculo exitoso. Antes del primer cálculo, solo se muestra la configuración.
- D-03: Ruta nueva `/reposiciones` (plural) — separada del módulo existente `/reposicion` (CSV-based). Ambas coexisten en PAGE_REGISTRY.

**Sales Cache Handling**
- D-04: Flujo automático de cache: al lanzar cálculo, si no hay sales cache o está stale (>24h), el sistema automáticamente lanza refresh, muestra barra de progreso con polling a `/sales/status`, y ejecuta el cálculo al completar.
- D-05: Si hay cache válido (<24h), el cálculo se ejecuta directamente sin refresh. El usuario ve un indicador de "última actualización" del cache.
- D-06: Si hay una Bulk Operation en progreso (409), mostrar mensaje claro al usuario con opción de reintentar después.

**Tabla de Sugeridos**
- D-07: Inline edit directo en celda — click en la celda de `suggested_qty` la convierte en input editable. Enter o blur confirma. Patrón natural para tablas de datos.
- D-08: El usuario puede eliminar filas (SKUs) del sugerido con botón de eliminar por fila.
- D-09: Si el usuario recalcula, los overrides manuales (cantidades editadas) se preservan para SKUs que sigan en el resultado. Mantener map local de overrides por SKU.
- D-10: Búsqueda por SKU/título/proveedor y filtro por urgencia (URGENTE/PRONTO/NORMAL/OK) en la tabla.
- D-11: Columnas de la tabla: SKU, Título, Proveedor, Stock, Ventas/mes, Urgencia (badge color), Sugerido (editable), En Tránsito. Clasificación visible como badge.

**Resumen por Proveedor**
- D-12: Card o tabla resumen debajo de la tabla de sugeridos — muestra por proveedor: total títulos, total unidades a pedir, conteo de urgentes. Ordenado por urgentes desc.

**Configuración UI**
- D-13: Location: dropdown simple poblado por `GET /locations` (useLocations hook).
- D-14: Proveedores: multi-select con "Todos" como default. Poblado por `GET /vendors`.
- D-15: Lead time: input numérico, default 14, rango 1-90.
- D-16: Rango de fechas: input numérico en meses (default 6, rango 1-12). NO date picker — simplificado.
- D-17: Safety factor: input numérico, default 1.5, rango 1.0-3.0.

**Persistencia de Config (CONF-05)**
- D-18: Guardar última configuración en Firestore collection `replenishment_config`, documento por user UID. Campos: location_id, vendors, lead_time_days, safety_factor, date_range_days, updated_at.
- D-19: Al abrir el módulo, pre-cargar la config guardada. Si no existe, usar defaults (location: primera disponible, vendors: todos, lead_time: 14, safety_factor: 1.5, date_range: 6 meses).

### Claude's Discretion
- Estructura interna de componentes (cuántos archivos, cómo dividir)
- Diseño exacto de la tabla (shadcn Table vs custom)
- Animaciones y transiciones entre estados (loading, empty, results)
- Estado local vs React Query cache para overrides de cantidades
- Estilo de los badges de urgencia y clasificación (colores exactos)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONF-01 | Usuario selecciona sede (Location) desde dropdown poblado por Shopify | `GET /api/reposiciones/locations` → `[{name, id}]`; useQuery hook + shadcn Select |
| CONF-02 | Usuario filtra proveedores con multi-select (todos o selección específica) | `GET /api/reposiciones/vendors` → `[{name, product_count}]`; multi-select via shadcn Command+Popover pattern; 150+ vendors confirmed in STATE |
| CONF-03 | Usuario configura lead time en días (default 14, rango 1-90) | shadcn Input type=number; clamp on change handler; already done in ConfigurationPanel.tsx as reference |
| CONF-04 | Usuario configura rango de ventas para análisis (default 6 meses) | Input numérico en meses, convertir a date_range_days = meses × 30; default 6 → 180 |
| CONF-05 | Sistema persiste última configuración usada por usuario | Firestore `replenishment_config/{uid}` setDoc/getDoc; useEffect load on mount, save on Calcular click |
| APPR-01 | Al generar sugerido, se crea un borrador en Firestore con todos los SKUs | Backend already does this in `_persist_draft()` and returns `draft_id` in CalculateResponse |
| APPR-02 | Usuario ve tabla de sugerido con búsqueda y filtro por urgencia | Adapt ProductDetailTable.tsx — add inline-edit column, delete column; existing search/filter logic is already there |
| APPR-03 | Usuario puede editar cantidades sugeridas por línea (inline edit) y eliminar SKUs | `overridesMap: Record<sku, number>` in useState; `deletedSkus: Set<sku>` in useState; inline input on cell click |
| APPR-04 | Usuario ve resumen por proveedor (total títulos, total unidades) antes de aprobar | VendorSummaryTable.tsx pattern already shows this; recalculate totals from effective quantities (overrides applied) |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18 | UI framework | Project standard |
| TypeScript | 5.x | Type safety | Project standard |
| @tanstack/react-query | 5.x | Server state, polling | Project standard — all modules use it |
| firebase/firestore | 10.x | Firestore SDK for config persistence | Project standard — already in use |
| shadcn/ui | latest | UI primitives | Project standard — NEVER modify src/components/ui directly |
| Tailwind CSS | 3.x | Styling | Project standard |
| Lucide React | latest | Icons | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner (toast) | bundled in shadcn | User feedback toasts | On error, on cache refresh start/complete |
| React Router v6 | project standard | Route registration | Add route in App.tsx |

**No new dependencies.** All required libraries are already installed. The project rule explicitly requires confirmation before adding new dependencies.

**Installation:** None needed — all libraries in use.

## Architecture Patterns

### Recommended Project Structure
```
src/pages/reposiciones/
├── index.tsx               # Main page component (lazy loaded from App.tsx)
├── types.ts                # TypeScript interfaces mirroring backend Pydantic models
├── api.ts                  # API functions using resilientFetch + handleResponse<T>
├── hooks.ts                # React Query hooks (useLocations, useVendors, useCalculate, useReplenishmentConfig)
├── components/
│   ├── ConfigPanel.tsx         # Sede dropdown + vendor multi-select + numeric inputs
│   ├── VendorMultiSelect.tsx   # Multi-select popover for 150+ vendors
│   ├── SuggestionsTable.tsx    # Editable table with search/filter/inline-edit/delete
│   ├── VendorSummaryPanel.tsx  # Per-vendor summary (adapts VendorSummaryTable.tsx)
│   └── CacheProgressBar.tsx    # Progress bar shown during sales cache refresh polling
```

### Pattern 1: API Layer (api.ts)
**What:** Functions that call backend endpoints using `resilientFetch` + `handleResponse<T>`
**When to use:** Every backend call goes through this layer — never call fetch directly from hooks or components

```typescript
// Source: src/pages/gift-cards/api.ts (project verified)
import { resilientFetch } from "@/lib/resilient-fetch";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Error del servidor (${response.status})`);
  }
  return response.json();
}

export async function getLocations(): Promise<LocationItem[]> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/locations`);
  return handleResponse(res);
}

export async function getVendors(): Promise<VendorItem[]> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/vendors`);
  return handleResponse(res);
}

export async function getSalesStatus(): Promise<SalesStatusResponse> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/sales/status`);
  return handleResponse(res);
}

export async function refreshSales(dateRangeDays: number): Promise<SalesRefreshResponse> {
  const res = await resilientFetch(
    `${API_BASE}/api/reposiciones/sales/refresh?date_range_days=${dateRangeDays}`,
    { method: "POST" }
  );
  return handleResponse(res);
}

export async function calculateReplenishment(params: CalculateRequest): Promise<CalculateResponse> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleResponse(res);
}
```

### Pattern 2: React Query Hooks (hooks.ts)
**What:** useQuery for GET data, useMutation for POST actions, polling for async jobs
**When to use:** All data fetching — never use useEffect + fetch directly

```typescript
// Source: src/pages/gift-cards/hooks.ts + scrap polling pattern (project verified)
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useLocations() {
  return useQuery({
    queryKey: ["reposiciones", "locations"],
    queryFn: getLocations,
    staleTime: 10 * 60 * 1000, // locations rarely change
    retry: 2,
  });
}

export function useVendors() {
  return useQuery({
    queryKey: ["reposiciones", "vendors"],
    queryFn: getVendors,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

// Polling hook for sales status during cache refresh
export function useSalesStatusPolling(enabled: boolean) {
  return useQuery({
    queryKey: ["reposiciones", "sales-status"],
    queryFn: getSalesStatus,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!enabled) return false;
      if (!data || data.status === "running") return 3000; // poll every 3s
      return false; // stop when completed/failed
    },
    enabled,
  });
}
```

### Pattern 3: Firestore Config Persistence (hooks.ts)
**What:** Read/write user config from `replenishment_config/{uid}` on mount and on calculate
**When to use:** CONF-05 requirement — pre-load config, save on calculate

```typescript
// Source: src/pages/devoluciones/hooks.ts pattern + firebase SDK (project verified)
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useReplenishmentConfig(uid: string | undefined) {
  return useQuery({
    queryKey: ["reposiciones", "config", uid],
    queryFn: async () => {
      if (!uid) return null;
      const docRef = doc(db, "replenishment_config", uid);
      const snap = await getDoc(docRef);
      return snap.exists() ? (snap.data() as ReplenishmentConfig) : null;
    },
    enabled: !!uid,
    staleTime: Infinity, // config only changes when user explicitly saves
  });
}

export async function saveReplenishmentConfig(uid: string, config: ReplenishmentConfig) {
  const docRef = doc(db, "replenishment_config", uid);
  await setDoc(docRef, { ...config, updated_at: serverTimestamp() });
}
```

### Pattern 4: Inline Edit Cell
**What:** Click on `suggested_qty` cell → become `<input>`, Enter/blur → confirm, store in overridesMap
**When to use:** APPR-03 requirement
**Key state:** `overridesMap: Record<string, number>` (sku → qty), `deletedSkus: Set<string>`, `editingCell: string | null`

```typescript
// Derived from D-07, D-08, D-09 decisions
// In SuggestionsTable component state:
const [overridesMap, setOverridesMap] = useState<Record<string, number>>({});
const [deletedSkus, setDeletedSkus] = useState<Set<string>>(new Set());
const [editingCell, setEditingCell] = useState<string | null>(null);
const [editingValue, setEditingValue] = useState<string>("");

// Effective rows (filters deleted, applies overrides)
const effectiveProducts = useMemo(() =>
  products
    .filter(p => !deletedSkus.has(p.sku))
    .map(p => ({
      ...p,
      suggested_qty: overridesMap[p.sku] ?? p.suggested_qty,
    })),
  [products, deletedSkus, overridesMap]
);

// On recalculate: parent passes new products; overridesMap persists by sku key (D-09)
// Parent must call: setProducts(newData) but NOT reset overridesMap
```

### Pattern 5: Vendor Multi-Select
**What:** Popover + Command list (shadcn) for selecting multiple vendors from 150+
**When to use:** D-14 — "Todos" is default (empty array = all vendors)
**Note:** shadcn does NOT have a built-in multi-select component. Use Popover + Command + Checkbox pattern.

```typescript
// Established pattern in the React ecosystem for shadcn multi-select:
// Popover trigger shows "Todos (150)" or "3 proveedores seleccionados"
// Inside: Command with search input + CommandList of checkboxes
// State: selectedVendors: string[] — empty array = "Todos"

interface VendorMultiSelectProps {
  vendors: VendorItem[];
  value: string[];       // empty = all selected
  onChange: (v: string[]) => void;
}
```

### Pattern 6: Cache Refresh Auto-Flow (D-04, D-05, D-06)
**What:** On "Calcular" click, check sales status first; if stale/missing → refresh → poll → calculate
**State machine:**
```
IDLE → [click Calcular] → CHECK_CACHE
  ↓ cache valid         → POST /calculate directly
  ↓ cache stale/missing → POST /sales/refresh → POLLING
    ↓ status=running    → show progress bar (object_count)
    ↓ status=completed  → POST /calculate
    ↓ status=failed     → show error toast
    ↓ 409 response      → show "Operación en curso" message (D-06)
```

### Pattern 7: Page Registration (locked)
**What:** Add to PAGE_REGISTRY in `src/lib/pages.ts` ONLY — per memory feedback_new_page_nav.md
**No other action needed for navigation** (Layout reads PAGE_REGISTRY dynamically)

```typescript
// src/lib/pages.ts — add to PAGE_REGISTRY array:
{
  path: "/reposiciones",
  label: "Reposiciones",
  description: "Reposición automática con datos Shopify",
  icon: PackageSearch,  // already imported in pages.ts
  workspace: "operaciones"
}
```

### Pattern 8: Lazy Route Registration
**What:** Add lazy import + route in App.tsx following the existing pattern

```typescript
// src/App.tsx
const Reposiciones = lazyWithReload(() => import("./pages/reposiciones"));
// In Routes:
<Route path="/reposiciones" element={<Reposiciones />} />
```

### Anti-Patterns to Avoid
- **Don't build a stepper or tab layout:** D-01 explicitly requires single-page layout
- **Don't use a date range picker:** D-16 requires numeric months input, not a calendar
- **Don't reset overridesMap on recalculate:** D-09 requires manual overrides to survive recalculation
- **Don't modify src/components/ui/ files:** CLAUDE.md strict rule — use shadcn CLI for new components
- **Don't add new npm dependencies:** Project rule requires explicit confirmation first
- **Don't use onSnapshot() for config:** Config is write-on-save, not realtime — use getDoc/setDoc (one-time read)
- **Don't compute vendor summary from backend data directly after edit:** Must recompute summary from `effectiveProducts` (with overrides and deletions applied) to reflect user changes

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry logic for fetch | Custom retry loop | `resilientFetch` from `@/lib/resilient-fetch` | Already handles 502/503/504, timeout 15s, exponential backoff |
| Auth headers on requests | Manual token injection | `resilientFetch` | Automatically injects Firebase Bearer token |
| Error parsing from backend | Custom error handler | `handleResponse<T>()` pattern from gift-cards/api.ts | Extracts `body.detail` from FastAPI error format |
| Backend polling | setInterval / manual | React Query `refetchInterval` | Self-cleaning, stops on unmount, integrates with loading state |
| Toast notifications | Custom toast | `toast.success()`, `toast.error()` from Sonner | Already configured in App.tsx |
| Dark/light mode | Manual CSS | Tailwind `dark:` prefix classes | ThemeProvider handles switching |
| Scrollable wide table | Custom scroll | shadcn `ScrollArea` + `ScrollBar` | Already used in ProductDetailTable.tsx |
| Firestore SDK init | Re-initialize | `import { db } from "@/lib/firebase"` | Already initialized |

**Key insight:** This module is 90% assembly of existing patterns — the project already solved every infrastructure concern. The only genuinely new logic is: inline cell editing state machine, overrides map management across recalculations, and the cache-refresh → calculate two-step flow.

## Common Pitfalls

### Pitfall 1: Multi-select sends empty array vs sends all vendor names
**What goes wrong:** When "Todos" is selected and user calls `/calculate`, sending an empty array `[]` to `body.vendors` is correct (backend treats `None`/empty as "all vendors"). But if the code sends `["VendorA", "VendorB", ...]` with all 150 vendor names, the backend still works but the request body becomes huge and may exceed limits.
**Why it happens:** Developer conflates "all selected" with "send all names".
**How to avoid:** Use `vendors: selectedVendors.length > 0 ? selectedVendors : null` when building CalculateRequest.
**Warning signs:** POST /calculate body is very large; vendor filter not working when "Todos" selected.

### Pitfall 2: Vendor summary shows pre-override totals
**What goes wrong:** The `vendor_summary` from the backend response reflects original `suggested_qty` values. After user edits quantities or deletes rows, the summary panel still shows the old numbers.
**Why it happens:** Developer renders `calculateResponse.vendor_summary` directly instead of recomputing from `effectiveProducts`.
**How to avoid:** Derive vendor summary client-side from `effectiveProducts` (filtered + overridden). The backend summary is only authoritative at calculate time.
**Warning signs:** User edits a quantity but vendor total doesn't update.

### Pitfall 3: Override map not keyed consistently
**What goes wrong:** Overrides map uses `product.sku` as key, but after recalculation the new products come back with the same SKU but a different object reference. If the key comparison uses object identity instead of string equality, overrides are lost.
**Why it happens:** Map keyed on object reference instead of `sku` string.
**How to avoid:** Always key `overridesMap` on `p.sku` (string). `useMemo` that applies overrides must use `overridesMap[p.sku]` not `overridesMap[p]`.

### Pitfall 4: Firestore rules block new collection
**What goes wrong:** `replenishment_config` is a new Firestore collection. Existing `firestore.rules` may not include it, causing permission-denied errors in production.
**Why it happens:** Rules are not updated when new collections are created.
**How to avoid:** STATE.md notes this explicitly as a pending todo: "Actualizar firestore.rules para nuevas colecciones antes de deploy". Add read/write rule for `replenishment_config` scoped to `request.auth.uid == userId`.
**Warning signs:** `PERMISSION_DENIED` error in console after deploy; works in dev if rules are permissive there.

### Pitfall 5: Polling doesn't stop when component unmounts
**What goes wrong:** If user navigates away while sales status polling is running, the polling continues and may try to update unmounted state.
**Why it happens:** Manual setInterval without cleanup.
**How to avoid:** Use React Query `refetchInterval` — it automatically stops when the component unmounts or when the hook's `enabled` becomes false. Never use raw `setInterval` for polling.

### Pitfall 6: 409 error from backend swallowed as generic error
**What goes wrong:** When `/sales/refresh` returns 409 (bulk op in progress), `handleResponse` throws a generic error. The user sees "Error del servidor (409)" instead of the user-friendly "Hay una operación en curso" message (D-06).
**Why it happens:** `handleResponse` reads `body.detail` but the 409 from the backend has `detail` as an object `{"error": "OPERATION_IN_PROGRESS", "message": "..."}`, not a string.
**How to avoid:** In `api.ts`, for `refreshSales`, handle 409 specially — check `body.error === "OPERATION_IN_PROGRESS"` and throw with `body.message`.
**Warning signs:** User sees cryptic error for 409 responses.

### Pitfall 7: Safety factor input allows values outside 1.0-3.0 range
**What goes wrong:** Number inputs don't enforce min/max unless explicitly clamped in the onChange handler.
**Why it happens:** HTML `min`/`max` attributes prevent form submission but not programmatic state update on type.
**How to avoid:** In onChange: `const clamped = Math.min(3.0, Math.max(1.0, parseFloat(v) || 1.5))`.

## Code Examples

Verified patterns from official sources and project codebase:

### TypeScript types mirroring backend Pydantic models
```typescript
// Source: backend/routers/reposiciones.py — CalculateResponse, ProductAnalysis, VendorSummary
// src/pages/reposiciones/types.ts

export type UrgencyLevel = "URGENTE" | "PRONTO" | "NORMAL" | "OK";
export type Classification = "Bestseller" | "Regular" | "Slow" | "Long Tail";

export interface LocationItem {
  name: string;
  id: string;  // Shopify GID e.g. "gid://shopify/Location/12345"
}

export interface VendorItem {
  name: string;
  product_count: number;
}

export interface ProductResult {
  sku: string;
  title: string;
  vendor: string;
  classification: Classification;
  classification_label: string;
  sales_per_month: number;
  sales_per_week: number;
  sales_per_day: number;
  total_sold: number;
  stock: number;
  days_of_inventory: number | null;
  urgency: UrgencyLevel;
  urgency_label: string;
  reorder_point: number;
  needs_reorder: boolean;
  suggested_qty: number;
  in_transit_real: number;
}

export interface VendorSummaryResult {
  vendor: string;
  total_skus: number;
  total_units_to_order: number;
  urgent_count: number;
}

export interface ReplenishmentStatsResult {
  total_products: number;
  needs_replenishment: number;
  urgent: number;
  out_of_stock: number;
  vendors_with_orders: number;
}

export interface CalculateResponse {
  products: ProductResult[];
  vendor_summary: VendorSummaryResult[];
  stats: ReplenishmentStatsResult;
  draft_id: string;
}

export interface CalculateRequest {
  location_id: string;
  vendors: string[] | null;
  lead_time_days: number;
  safety_factor: float;
  date_range_days: number;
}

export interface ReplenishmentConfig {
  location_id: string;
  vendors: string[];
  lead_time_days: number;
  safety_factor: number;
  date_range_days: number;
  updated_at?: unknown; // serverTimestamp()
}

export interface SalesStatusResponse {
  status: "idle" | "running" | "completed" | "failed";
  object_count?: number;
  last_refreshed?: string;
  sku_count?: number;
  error?: string;
}
```

### Urgency badge colors (D-11, Claude's Discretion for exact colors)
```typescript
// Source: existing ProductDetailTable.tsx adapted with explicit color classes
const urgencyBadgeClass: Record<UrgencyLevel, string> = {
  URGENTE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  PRONTO:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  NORMAL:  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  OK:      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
};
// Use <Badge className={urgencyBadgeClass[p.urgency]}>{p.urgency_label}</Badge>
```

### Vendor summary re-derived from effective products (Pitfall 2 prevention)
```typescript
// In SuggestionsTable or parent component — recompute after overrides/deletions
const effectiveVendorSummary = useMemo(() => {
  const map: Record<string, { total_skus: number; total_units_to_order: number; urgent_count: number }> = {};
  for (const p of effectiveProducts) {
    if (p.suggested_qty <= 0) continue;
    if (!map[p.vendor]) map[p.vendor] = { total_skus: 0, total_units_to_order: 0, urgent_count: 0 };
    map[p.vendor].total_skus += 1;
    map[p.vendor].total_units_to_order += p.suggested_qty;
    if (p.urgency === "URGENTE") map[p.vendor].urgent_count += 1;
  }
  return Object.entries(map)
    .map(([vendor, v]) => ({ vendor, ...v }))
    .sort((a, b) => b.urgent_count - a.urgent_count || b.total_units_to_order - a.total_units_to_order);
}, [effectiveProducts]);
```

### Cache status check before calculate
```typescript
// In the main page component or a useCalculateFlow hook
async function handleCalcular() {
  const status = await getSalesStatus();

  if (status.status === "running") {
    // Already polling — inform user
    toast.info("Actualización de datos en progreso, espera...");
    setIsPolling(true);
    return;
  }

  if (status.status !== "completed") {
    // Cache stale/absent — trigger refresh
    try {
      await refreshSales(config.date_range_days);
      setIsPolling(true); // start polling via useSalesStatusPolling
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      // Check for 409 in_progress
      if (msg.includes("OPERATION_IN_PROGRESS")) {
        toast.error("Hay una operación Bulk en curso en Shopify. Intenta en unos minutos.");
        return;
      }
      toast.error(msg);
      return;
    }
  } else {
    // Cache valid — calculate directly
    await runCalculation();
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSV-based calculation (client-side) | Backend API + Shopify data | Phase 4-5 | More accurate, real-time data |
| Old `/reposicion` module | New `/reposiciones` module | This phase | Both coexist — old one is NOT deleted |
| Manual cache management | Automatic stale check + auto-refresh | This phase | User doesn't need to think about data freshness |

## Environment Availability

> Step 2.6: The phase is entirely frontend code + Firestore reads/writes. The backend APIs are already implemented (Phase 4-5). No new external tools are required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Backend FastAPI (EasyPanel) | All API calls | ✓ (Phase 4-5 complete) | Running | — |
| Firestore | Config persistence | ✓ | SDK 10.x in project | — |
| Vitest | Tests | ✓ | Configured in vitest.config.ts | — |
| shadcn/ui components: Select, Input, Table, Badge, Button, Card, Progress, ScrollArea | UI | ✓ | Already in src/components/ui/ | — |
| Popover + Command (for multi-select) | Vendor multi-select | ✓ | Already in shadcn | — |

**Missing dependencies with no fallback:** None.

**Note on Firestore rules:** `replenishment_config` collection requires a firestore.rules update before production deploy. This is a known pending item in STATE.md. The plan must include a task to update firestore.rules.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 1.x + React Testing Library |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/test/` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONF-01 | Locations dropdown renders with API data | unit/component | `npx vitest run src/test/reposiciones/` | ❌ Wave 0 |
| CONF-02 | Vendor multi-select "Todos" default; selection serializes to string[] | unit | `npx vitest run src/test/reposiciones/config.test.tsx` | ❌ Wave 0 |
| CONF-03 | Lead time input clamped 1-90 | unit | same file | ❌ Wave 0 |
| CONF-04 | Date range months × 30 = date_range_days | unit | same file | ❌ Wave 0 |
| CONF-05 | Config saved/loaded from Firestore by UID | manual-only | — | N/A — Firestore mock complex |
| APPR-01 | draft_id returned from /calculate is non-empty | integration (manual) | — | N/A — requires backend |
| APPR-02 | Table search filters by sku/title/vendor | unit | `npx vitest run src/test/reposiciones/table.test.tsx` | ❌ Wave 0 |
| APPR-03 | Inline edit updates override; deleted SKU filtered; overrides persist on recalculate | unit | same file | ❌ Wave 0 |
| APPR-04 | Vendor summary recomputed from effective products (after overrides/deletes) | unit | same file | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/test/reposiciones/`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/test/reposiciones/config.test.tsx` — covers CONF-01, CONF-02, CONF-03, CONF-04
- [ ] `src/test/reposiciones/table.test.tsx` — covers APPR-02, APPR-03, APPR-04
- [ ] `src/test/reposiciones/` directory — needs creation

*(CONF-05, APPR-01 are manual-only — Firestore and backend integration)*

## Open Questions

1. **Safety factor step for the numeric input**
   - What we know: D-17 sets default 1.5, range 1.0-3.0
   - What's unclear: step increment (0.1? 0.5?) — affects how usable the spinner is
   - Recommendation: Use `step={0.1}` for precision; the input type=number spinner is fine for this range

2. **Progress indication during cache refresh**
   - What we know: `/sales/status` returns `object_count` when running
   - What's unclear: Is `object_count` a good progress proxy? There's no `total_objects` field.
   - Recommendation: Use indeterminate progress bar (shadcn Progress with unknown max), display `{object_count} registros procesados` as text beneath it

3. **Pagination for 500+ row table**
   - What we know: `ProductDetailTable.tsx` already implements pagination at PAGE_SIZE=25 with prev/next buttons
   - What's unclear: Is 25/page optimal, or should it be configurable?
   - Recommendation: Keep PAGE_SIZE=25 matching the existing module; add note that virtualization (e.g., TanStack Virtual) can be added later if performance is a problem — not needed for MVP

4. **Firestore rules for `replenishment_config`**
   - What we know: Must be added before deploy; STATE.md flags this as a pending todo
   - What's unclear: Current state of firestore.rules — must be read before implementing
   - Recommendation: Plan includes an explicit task to read and update firestore.rules with: `match /replenishment_config/{userId} { allow read, write: if request.auth != null && request.auth.uid == userId; }`

## Sources

### Primary (HIGH confidence)
- `src/pages/reposicion/` — Complete reference implementation for all UI patterns (verified by reading files)
- `src/pages/gift-cards/api.ts`, `hooks.ts` — API + React Query pattern (verified)
- `src/pages/devoluciones/hooks.ts` — Firestore + React Query mix pattern (verified)
- `src/lib/resilient-fetch.ts` — resilientFetch implementation (verified)
- `src/lib/pages.ts` — PAGE_REGISTRY structure (verified)
- `src/App.tsx` — lazy route pattern (verified)
- `backend/routers/reposiciones.py` — All endpoint contracts, request/response shapes (verified)
- `vitest.config.ts` — Test framework configuration (verified)
- `.planning/phases/06-wizard-frontend-config-y-sugeridos/06-CONTEXT.md` — All locked decisions (verified)

### Secondary (MEDIUM confidence)
- `PROJECT_MEMORY: project_frontend_patterns.md` — Frontend patterns, API_BASE, polling pattern (4 days old, verified against current code)
- `PROJECT_MEMORY: project_integration_contracts.md` — Integration contracts, CORS, env vars (4 days old, consistent with code)

### Tertiary (LOW confidence)
- None — all findings based on direct code inspection

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 6 |
|-----------|-------------------|
| UI en Español — todo texto visible | All labels, placeholders, toasts, button text must be in Spanish |
| NUNCA modificar `src/components/ui/` directamente | Use shadcn CLI to add Popover/Command if not present; verify they exist first |
| NO agregar dependencias nuevas sin confirmar primero | No new npm packages — all needed libraries are present |
| NO modificar `firestore.rules` sin confirmación explícita | Plan must flag the Firestore rules update as requiring user confirmation before deploy |
| Al crear páginas nuevas: solo agregar a PAGE_REGISTRY en pages.ts | Add `/reposiciones` entry to PAGE_REGISTRY only — memory feedback_new_page_nav.md |
| Mantener soporte para dark/light mode en todo componente nuevo | All Tailwind classes need `dark:` variants |
| Funcionales con hooks, nunca clases | All components must be function components |
| Props tipadas con `interface` al inicio del archivo | Define interfaces before the component in each file |
| Importar UI de `@/components/ui/...` | Never import shadcn from node_modules directly |
| Usar `cn()` de `@/lib/utils` para clases condicionales | Use `cn()` for conditional class names |
| Orden de imports: React → componentes → hooks → utils/firebase → contexts | Follow import order in every new file |
| Testing: Vitest + React Testing Library | Write tests in `src/test/reposiciones/` |
| Commit + push antes de deploy | Not applicable to planning — noted for execution |

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified directly from package.json and existing modules
- Architecture patterns: HIGH — all patterns copied from verified codebase with file references
- API contracts: HIGH — read from backend/routers/reposiciones.py source of truth
- Pitfalls: HIGH — derived from code analysis + explicit decisions in CONTEXT.md
- Test approach: HIGH — vitest.config.ts verified, existing tests inspected

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable stack, 30-day window)
