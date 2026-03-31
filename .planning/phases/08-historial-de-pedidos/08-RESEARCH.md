# Phase 8: Historial de Pedidos - Research

**Researched:** 2026-03-30
**Domain:** React tab navigation, Firestore onSnapshot, FastAPI new endpoints, status transition audit trail
**Confidence:** HIGH

## Summary

Phase 8 adds an order history tab to the existing `/reposiciones` page. The current page (`index.tsx`) renders a single workflow (config → calculate → approve → generate). This phase wraps that content in a "Nuevo Sugerido" tab and adds a "Historial de Pedidos" tab alongside it using the shadcn/ui `Tabs` component that is already installed.

The history tab consumes the `replenishment_orders` Firestore collection (already exists and is populated by Phase 7), adds three new backend endpoints (list, detail, status-transition), extends the `ReplenishmentOrder` TypeScript type with two new statuses (`"parcial" | "recibido"`) and a `status_history` array, and introduces a collapsible-row detail panel using the existing `Collapsible` shadcn/ui component.

Key integration risk: existing Phase 7 documents in Firestore do NOT have `status_history`. Code must treat an absent `status_history` field as an empty array (`[]`). The `PATCH /orders/{id}/send` endpoint from Phase 7 writes only `status/sent_at/sent_by` flat fields — it does NOT write `status_history`. New status transition endpoint must write `status_history` entries AND also bridge Phase 7's flat fields on the first append.

**Primary recommendation:** Build three discrete backend endpoints (list, detail, status-PATCH), extend the TypeScript type, and implement the history tab as a single `OrderHistoryTab.tsx` component aided by an `ExpandableOrderRow.tsx` sub-component. Use `onSnapshot` for the list (real-time requirement HIST-01) and `useQuery` for the detail (loaded on expand).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Historial como tab dentro de `/reposiciones`. Tabs: "Nuevo Sugerido" + "Historial de Pedidos". No ruta nueva.
- **D-02:** Después de generar pedidos, ofrecer link/botón "Ver pedidos generados" que cambia al tab historial.
- **D-03:** Tabla con columnas: Proveedor, Fecha Creación, Estado (badge), Items (conteo), Acciones. Filtros inline: dropdown proveedor, dropdown estado, date range.
- **D-04:** `onSnapshot` para tiempo real — cambios de estado se reflejan sin recargar.
- **D-05:** Ordenamiento por defecto: fecha de creación descendente. Click en cabeceras para cambiar orden.
- **D-06:** Botón con siguiente transición permitida: Aprobado → "Marcar Enviado", Enviado → "Marcar Parcial" | "Marcar Recibido", Parcial → "Marcar Recibido". Desde Enviado se puede ir a Parcial O directamente a Recibido.
- **D-07:** Sin modal de confirmación — botón inline + toast. Consistente con `handleMarkSent`.
- **D-08:** Cada transición se registra con timestamp y UID en `status_history: [{status, changed_by, changed_at}]`.
- **D-09:** Estado "Recibido" es terminal — botón desaparece.
- **D-10:** Panel expandible (collapsible row) al hacer click en fila — muestra tabla de SKUs.
- **D-11:** Panel expandido muestra: audit trail (quién creó, quién aprobó, timestamps) + botón re-descarga Excel.
- **D-12:** Botón "Descargar Excel" reutiliza endpoint `POST /orders/export` pasando un solo `order_id`.
- **D-13:** Alternativa: nuevo endpoint `GET /orders/{order_id}/export` con Excel individual en base64. Claude's Discretion.
- **D-14:** `GET /api/reposiciones/orders` — Lista pedidos (no borradores), filtros opcionales.
- **D-15:** `GET /api/reposiciones/orders/{order_id}` — Detalle completo con items y status_history.
- **D-16:** `PATCH /api/reposiciones/orders/{order_id}/status` — Transición genérica. Body: `{status, changed_by}`. Valida transiciones. Agrega a status_history.
- **D-17:** `PATCH /orders/{order_id}/send` de Phase 7 se puede deprecar o mantener como alias.

### Claude's Discretion

- Estructura interna de componentes del tab historial (cuántos archivos, organización)
- Diseño exacto de filtros (inline en tabla vs barra separada)
- Colores de badges por estado (Aprobado=azul, Enviado=verde, Parcial=amber, Recibido=gray)
- Animación del panel expandible
- Si usar endpoint ZIP existente o crear uno nuevo para descarga individual de Excel
- Paginación vs scroll infinito para la tabla

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HIST-01 | Lista de todos los pedidos generados con filtros (proveedor, fecha, estado), actualización en tiempo real | `onSnapshot` de Firestore en `useOrderHistory` hook; D-03, D-04 |
| HIST-02 | Estado actual de cada pedido con transiciones explícitas (Aprobado → Enviado → Parcial → Recibido) | Nuevo `PATCH /orders/{id}/status`; D-06, D-07, D-08, D-09 |
| HIST-03 | Detalle de pedido: todos los SKUs con cantidades pedidas | `GET /orders/{id}` retorna `items[]`; D-10, D-15 |
| HIST-04 | Re-descarga Excel de cualquier pedido histórico | Reúso `POST /orders/export` con un solo order_id O nuevo endpoint individual; D-12/D-13 |
| HIST-05 | Audit trail: quién creó, quién aprobó, timestamps de cada transición | `status_history` array en Firestore; D-08, D-11 |
</phase_requirements>

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | 5.x | Data fetching + caching for list/detail | Already used in hooks.ts |
| `firebase/firestore` | 10.x | `onSnapshot` for real-time list | Already used in hooks.ts; HIST-01 requires real-time |
| `sonner` | latest | Toast feedback on transitions | Already used for all mutations in this module |
| `shadcn/ui Tabs` | installed | Tab navigation Nuevo Sugerido / Historial | `tabs.tsx` already exists in ui/ |
| `shadcn/ui Collapsible` | installed | Expandable row for order detail | `collapsible.tsx` already exists in ui/ |
| `shadcn/ui Select` | installed | Dropdown filters (proveedor, estado) | `select.tsx` already exists in ui/ |
| `shadcn/ui Badge` | installed | Status badges | Already used in index.tsx |
| `shadcn/ui Table` | installed | History table and SKU detail table | Already used in VendorSummaryPanel.tsx |
| `shadcn/ui ScrollArea` | installed | Horizontal overflow control (table pattern) | Already used in VendorSummaryPanel.tsx |
| `openpyxl` | already in requirements.txt | Excel generation for individual re-download | Already used in `/orders/export` |
| `google-cloud-firestore` | already in requirements.txt | Firestore transactions in backend | Already used in approve_draft() |

### Installation

No new dependencies required. All libraries are already installed.

---

## Architecture Patterns

### Tab Navigation Pattern (index.tsx refactor)

Wrap current content in `<Tabs>` with two tabs. Manage active tab via `useState`. Pass a `setActiveTab` callback into the "Nuevo Sugerido" section so the post-generate "Ver pedidos generados" button (D-02) can switch tabs.

```typescript
// Source: shadcn/ui Tabs — already in src/components/ui/tabs.tsx
const [activeTab, setActiveTab] = useState<"sugerido" | "historial">("sugerido");

<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "sugerido" | "historial")}>
  <TabsList>
    <TabsTrigger value="sugerido">Nuevo Sugerido</TabsTrigger>
    <TabsTrigger value="historial">Historial de Pedidos</TabsTrigger>
  </TabsList>
  <TabsContent value="sugerido">
    {/* existing content */}
    {Object.keys(generatedOrders).length > 0 && (
      <Button variant="link" onClick={() => setActiveTab("historial")}>
        Ver pedidos generados →
      </Button>
    )}
  </TabsContent>
  <TabsContent value="historial">
    <OrderHistoryTab />
  </TabsContent>
</Tabs>
```

### Recommended Component Structure

```
src/pages/reposiciones/
├── index.tsx                          → Add Tabs wrapper; pass setActiveTab down
├── types.ts                           → Extend ReplenishmentOrder; add StatusHistoryEntry
├── api.ts                             → Add getOrderList, getOrderDetail, transitionOrderStatus, exportSingleOrder
├── hooks.ts                           → Add useOrderHistory (onSnapshot), useOrderDetail, useStatusTransition
└── components/
    ├── OrderHistoryTab.tsx            → Main history tab: filter bar + table
    ├── ExpandableOrderRow.tsx         → Single collapsible row: SKU table + audit trail + download
    ├── ConfigPanel.tsx                (unchanged)
    ├── SuggestionsTable.tsx           (unchanged)
    └── VendorSummaryPanel.tsx         (unchanged)
```

### onSnapshot Hook Pattern (HIST-01 real-time requirement)

D-04 requires real-time updates. The `useOrderHistory` hook must use `onSnapshot` not `useQuery`, because `useQuery` does not maintain a live Firestore listener. Pattern from existing `hooks.ts` (uses `getDoc`/`setDoc` but real-time precedent exists in other modules like tasks):

```typescript
// Source: Firestore onSnapshot pattern — used in tasks module
export function useOrderHistory(filters: OrderHistoryFilters) {
  const [orders, setOrders] = useState<ReplenishmentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let q = collection(db, "replenishment_orders") as Query;
    // Filter: exclude borradores
    q = query(q, where("status", "in", ["aprobado", "enviado", "parcial", "recibido"]));
    if (filters.vendor) q = query(q, where("vendor", "==", filters.vendor));
    if (filters.status) q = query(q, where("status", "==", filters.status));
    // Note: Firestore cannot combine where() inequality with orderBy on different fields
    // Date range filtering must be done client-side OR use a single orderBy on created_at
    q = query(q, orderBy("created_at", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ order_id: d.id, ...d.to_dict() } as ReplenishmentOrder));
      setOrders(docs);
      setIsLoading(false);
    }, (err) => {
      setError(err.message);
      setIsLoading(false);
    });

    return () => unsub();
  }, [filters.vendor, filters.status]);

  return { orders, isLoading, error };
}
```

**Firestore query limitation:** Combining `where("vendor", "==", ...)` + `where("status", "in", [...])` + `orderBy("created_at", "desc")` requires a composite index. The date range filter (`date_from`/`date_to`) cannot be combined with `where("status", "in", [...])` on a different field without a composite index or client-side filtering. **Recommended approach:** apply vendor and status filters in Firestore, apply date range filter client-side (data volumes are small — hundreds of orders max, not millions).

### Status Transition Pattern (D-06, D-08, D-09)

```typescript
// Allowed next statuses per current status
const TRANSITIONS: Record<string, string[]> = {
  aprobado: ["enviado"],
  enviado: ["parcial", "recibido"],
  parcial: ["recibido"],
  recibido: [],  // terminal
};
```

Backend validates this map and rejects invalid transitions with 409. Frontend uses this map to render the correct button(s) per row.

### Collapsible Row Pattern (D-10, D-11)

shadcn/ui `Collapsible` wraps a `TableRow` to create expandable detail panels. Standard pattern in the ecosystem:

```typescript
// Source: shadcn/ui Collapsible — src/components/ui/collapsible.tsx
<Collapsible open={isOpen} onOpenChange={setIsOpen}>
  <TableRow onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
    {/* main row cells */}
    <TableCell><CollapsibleTrigger asChild><Button variant="ghost" size="sm">▼</Button></CollapsibleTrigger></TableCell>
  </TableRow>
  <CollapsibleContent asChild>
    <TableRow>
      <TableCell colSpan={5}>
        {/* SKU table + audit trail + download button */}
      </TableCell>
    </TableRow>
  </CollapsibleContent>
</Collapsible>
```

### Backend Endpoint Pattern (D-14, D-15, D-16)

Follow the existing pattern in `reposiciones.py` — Pydantic models first, then decorated route functions:

```python
# GET /api/reposiciones/orders
@router.get("/orders")
def list_orders(
    vendor: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    db = _get_firestore()
    q = db.collection(_REPLENISHMENT_ORDERS_COLLECTION)
    q = q.where("status", "in", ["aprobado", "enviado", "parcial", "recibido"])
    if vendor:
        q = q.where("vendor", "==", vendor)
    if status:
        q = q.where("status", "==", status)
    docs = q.order_by("created_at", direction=firestore.Query.DESCENDING).stream()
    # ... build response list (lightweight — no items[])
```

```python
# PATCH /api/reposiciones/orders/{order_id}/status
class StatusTransitionRequest(BaseModel):
    status: str
    changed_by: str

@router.patch("/orders/{order_id}/status")
def transition_order_status(order_id: str, body: StatusTransitionRequest):
    ALLOWED_TRANSITIONS = {
        "aprobado": ["enviado"],
        "enviado": ["parcial", "recibido"],
        "parcial": ["recibido"],
        "recibido": [],
    }
    db = _get_firestore()
    doc_ref = db.collection(_REPLENISHMENT_ORDERS_COLLECTION).document(order_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    current_status = snap.to_dict().get("status")
    if body.status not in ALLOWED_TRANSITIONS.get(current_status, []):
        raise HTTPException(status_code=409,
            detail=f"Transicion invalida: {current_status} -> {body.status}")
    now_str = datetime.now(timezone.utc).isoformat()
    history_entry = {"status": body.status, "changed_by": body.changed_by, "changed_at": now_str}
    doc_ref.update({
        "status": body.status,
        f"{body.status}_at": now_str,
        f"{body.status}_by": body.changed_by,
        "status_history": firestore.ArrayUnion([history_entry]),
    })
```

### Individual Excel Export Decision (D-13, Claude's Discretion)

**Recommendation:** Create new `GET /api/reposiciones/orders/{order_id}/export` endpoint that returns `{"excel_base64": str, "filename": str}`. Reason: the existing `POST /orders/export` wraps the Excel in a ZIP file — downloading a ZIP for a single Excel is poor UX. A GET endpoint returning raw base64 Excel is cleaner and consistent with how the frontend already handles `downloadZipFromBase64()` — just rename the function or add a sibling `downloadExcelFromBase64()`.

```typescript
// New api.ts function
export async function exportSingleOrder(orderId: string): Promise<{excel_base64: string; filename: string}> {
  const res = await resilientFetch(`${API_BASE}/api/reposiciones/orders/${orderId}/export`);
  return handleResponse(res);
}

// New download helper (sibling to downloadZipFromBase64)
export function downloadExcelFromBase64(base64: string, filename: string): void {
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArray[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Badge Color Convention (Claude's Discretion)

Consistent with Phase 7's existing "Aprobado" badge in `index.tsx` (blue):

| Status | Color tokens |
|--------|-------------|
| aprobado | `bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300` |
| enviado | `bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400` |
| parcial | `bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400` |
| recibido | `bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400` |

### Anti-Patterns to Avoid

- **Storing orders in React state from initial onSnapshot and re-fetching for every filter change:** Set up the Firestore query once with stable vendor/status filters; apply date range + sort client-side to avoid recreating the listener on every keystroke.
- **Using `useQuery` for the real-time list:** `useQuery` polls or fetches once — it does not maintain a persistent Firestore listener. Only `onSnapshot` satisfies HIST-01.
- **Calling `status_history` as a top-level field on existing documents:** Phase 7 documents may not have this field. Always use `order.status_history ?? []` in frontend code.
- **Combining `where("status", "in", [...])` with `where("created_at", ">=", ...)` without a composite index:** Firestore requires a composite index for this combination. Avoid it by filtering dates client-side.
- **Making the collapsible panel fetch on mount:** Only fetch order detail (`GET /orders/{id}`) when the row is first expanded, not on initial load.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible row | Custom expand/collapse div logic | `shadcn/ui Collapsible` | Already installed, accessible, animates with Tailwind |
| Tab navigation | Manual show/hide conditionals | `shadcn/ui Tabs` | Already installed, keyboard-navigable |
| Dropdown filter selects | Custom `<select>` | `shadcn/ui Select` | Already installed, consistent dark/light mode |
| Firestore ArrayUnion for history | Manual array fetch + push + update | `firestore.ArrayUnion([entry])` | Atomic append, prevents race conditions between concurrent transitions |
| Date formatting | Custom formatter | `Intl.DateTimeFormat` / `new Date().toLocaleString("es-CO", {...})` | Pattern already in index.tsx (`toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })`) |

**Key insight:** All required UI primitives are already installed. This phase is about composition, not new libraries.

---

## Common Pitfalls

### Pitfall 1: Firestore Composite Index Missing
**What goes wrong:** The query `where("status", "in", [...]) + orderBy("created_at", "desc")` fails with a Firestore index error in production (works in emulator but fails against real Firestore).
**Why it happens:** Firestore requires a composite index for any query that combines a `where` with an `orderBy` on a different field, or uses `in`/`array-contains-any` with `orderBy`.
**How to avoid:** Either (a) create the composite index in Firebase Console before deploy — index on `replenishment_orders`: `status ASC + created_at DESC`, or (b) fetch all non-borrador documents without `orderBy` in Firestore and sort client-side. Given the small data volume (hundreds of orders), client-side sort is simpler and avoids the index management overhead.
**Warning signs:** Firebase console shows "FAILED_PRECONDITION: The query requires an index" in error logs.

### Pitfall 2: Missing status_history on Phase 7 Documents
**What goes wrong:** Phase 7's `generate_orders` endpoint and `mark_order_sent` endpoint do NOT write `status_history`. Existing orders in Firestore have no `status_history` field. Frontend or backend code that does `order.status_history[0]` will throw.
**Why it happens:** Field was not defined in Phase 7's schema.
**How to avoid:** Always default: `const history = order.status_history ?? []`. On the backend, `firestore.ArrayUnion([entry])` on a missing field creates the array automatically — no migration needed for the `PATCH /status` endpoint.
**Warning signs:** "Cannot read properties of undefined (reading '0')" or "TypeError: undefined is not iterable".

### Pitfall 3: onSnapshot + Filter Dependency Array Causing Listener Thrash
**What goes wrong:** Putting filter state (e.g., vendor string from an input) directly in the `useEffect` dependency array causes the Firestore listener to be torn down and recreated on every keystroke.
**Why it happens:** `useEffect` re-runs when dependencies change; each run closes the old `unsub()` and opens a new one.
**How to avoid:** Only include Firestore-level filter values (vendor, status) as effect dependencies — NOT free-text inputs. Apply date range filtering on the already-received `orders` array via `useMemo`, not by recreating the Firestore query.

### Pitfall 4: Table Overflow (Project Memory Rule)
**What goes wrong:** History table with many columns extends beyond viewport width, causing horizontal page scroll.
**Why it happens:** Tables without `overflow-x` containers overflow their parent.
**How to avoid:** Wrap all tables in `<ScrollArea><div className="min-w-[600px]">...<ScrollBar orientation="horizontal" /></ScrollArea>` — this is the exact pattern in `VendorSummaryPanel.tsx`.

### Pitfall 5: Status Transition Race Condition
**What goes wrong:** Two users click "Marcar Enviado" simultaneously; both read `status=aprobado`, both update to `enviado`, both succeed — `status_history` ends up with two "enviado" entries and duplicate flat fields.
**Why it happens:** Firestore document reads are not serialized by default.
**How to avoid:** Use a Firestore transaction in `PATCH /orders/{id}/status` to read-then-validate-then-write atomically. The `approve_draft` endpoint in Phase 7 already demonstrates this pattern (see `reposiciones.py` lines 757–793).

### Pitfall 6: Phase 7 `/send` Endpoint Conflict
**What goes wrong:** After Phase 8 introduces the generic status endpoint, having two endpoints that both transition `aprobado → enviado` means the Phase 7 `/send` endpoint never writes `status_history`, creating inconsistent audit trails.
**Why it happens:** D-17 leaves it as "deprecate or alias".
**How to avoid:** Update the Phase 7 `/send` endpoint body to call the same internal logic as the new generic transition endpoint — or replace its implementation to write `status_history` as well. The Phase 7 frontend (`markOrderSent` in `api.ts`) is only called from `VendorSummaryPanel.tsx` in the "Nuevo Sugerido" tab. It can be redirected to call `PATCH /orders/{id}/status` with `{status: "enviado", changed_by: uid}` without changing the frontend handler signature.

---

## Code Examples

### Type Extensions (types.ts)

```typescript
// Extend existing ReplenishmentOrder
export interface StatusHistoryEntry {
  status: string;
  changed_by: string;
  changed_at: string;  // ISO 8601
}

export interface ReplenishmentOrder {
  order_id: string;
  vendor: string;
  status: "aprobado" | "enviado" | "parcial" | "recibido";
  items: OrderItem[];
  created_by: string;
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  enviado_at?: string;
  enviado_by?: string;
  parcial_at?: string;
  parcial_by?: string;
  recibido_at?: string;
  recibido_by?: string;
  status_history?: StatusHistoryEntry[];  // optional — absent on Phase 7 documents
}

// Lightweight list item (no items[] for performance)
export interface OrderListItem {
  order_id: string;
  vendor: string;
  status: "aprobado" | "enviado" | "parcial" | "recibido";
  item_count: number;
  created_by: string;
  created_at: string;
  status_history?: StatusHistoryEntry[];
}

export interface StatusTransitionRequest {
  status: string;
  changed_by: string;
}

export interface StatusTransitionResponse {
  status: string;
  changed_at: string;
}

export interface OrderHistoryFilters {
  vendor: string;
  status: string;
  date_from: string;
  date_to: string;
}
```

### Filter + Sort in useMemo (client-side date range)

```typescript
const filteredOrders = useMemo(() => {
  let result = orders;
  if (filters.date_from) {
    result = result.filter(o => o.created_at >= filters.date_from);
  }
  if (filters.date_to) {
    // Add one day to make date_to inclusive
    const toDate = new Date(filters.date_to);
    toDate.setDate(toDate.getDate() + 1);
    result = result.filter(o => o.created_at < toDate.toISOString());
  }
  return result;
}, [orders, filters.date_from, filters.date_to]);
```

### Status Transition Handler (mirrors handleMarkSent in index.tsx)

```typescript
// In OrderHistoryTab.tsx — consistent with D-07 (no modal, inline toast)
function handleTransition(orderId: string, newStatus: string) {
  if (!user?.uid) return;
  transitionMutation.mutate(
    { orderId, status: newStatus, changedBy: user.uid },
    {
      onSuccess: () => {
        toast.success(`Pedido marcado como ${newStatus}`);
        // onSnapshot will update the list automatically — no manual invalidation needed
      },
    }
  );
}
```

---

## Runtime State Inventory

> Included because this phase modifies how existing Firestore documents are structured (adding status_history).

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `replenishment_orders` collection — existing documents have no `status_history` field, no `parcial_at`/`recibido_at` flat fields | Code edit only — frontend defaults to `status_history ?? []`; backend `ArrayUnion` on absent field creates array automatically. No data migration script needed. |
| Live service config | n8n: not applicable. Phase 7 `PATCH /orders/{id}/send` endpoint creates audit trail gap if left unchanged | Update `/send` endpoint implementation to also write `status_history` entry (or redirect to new generic endpoint) |
| OS-registered state | None — no OS-level registrations involve order IDs or statuses | None |
| Secrets/env vars | None — no env vars reference order statuses | None |
| Build artifacts | None | None |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build | Yes | 24.13.0 | — |
| Python | Backend | Yes | 3.13.7 | — |
| Vitest | Frontend tests | Yes | 3.2.4 | — |
| `openpyxl` | Excel export | Already in requirements.txt | — | — |
| `google-cloud-firestore` | Firestore `ArrayUnion` | Already in requirements.txt | — | — |
| Firebase `replenishment_orders` collection | History list | Exists (created in Phase 7) | — | — |
| Firestore composite index (`status` + `created_at`) | onSnapshot query with orderBy | Not verified | — | Client-side sort (recommended) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** Firestore composite index — use client-side sort/filter for date range as fallback (recommended anyway given small data volume).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 + React Testing Library |
| Config file | `vite.config.ts` (vitest inline config) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HIST-01 | Filter logic (vendor/status/date) applied to order array | unit | `npx vitest run src/test/reposiciones/history.test.ts` | No — Wave 0 |
| HIST-02 | `TRANSITIONS` map — correct next statuses per current status | unit | `npx vitest run src/test/reposiciones/history.test.ts` | No — Wave 0 |
| HIST-03 | Order detail renders SKU list from items array | unit | `npx vitest run src/test/reposiciones/history.test.ts` | No — Wave 0 |
| HIST-04 | `downloadExcelFromBase64` triggers download | unit | `npx vitest run src/test/reposiciones/history.test.ts` | No — Wave 0 |
| HIST-05 | `status_history ?? []` default handles missing field | unit | `npx vitest run src/test/reposiciones/history.test.ts` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/test/reposiciones/history.test.ts` — covers HIST-01 filter logic, HIST-02 transitions map, HIST-03 item rendering, HIST-04 download helper, HIST-05 missing status_history default

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual status string updates in Firestore | `firestore.ArrayUnion` for atomic array append | Available since Firebase Admin SDK v1 | Prevents duplicate entries under concurrent writes |
| Flat `sent_at`/`sent_by` fields (Phase 7 pattern) | `status_history` array + flat fields coexist | Phase 8 | Backward compat: existing docs keep flat fields; new transitions write both |
| Single `PATCH /send` endpoint (Phase 7) | Generic `PATCH /status` endpoint | Phase 8 | One endpoint handles all transitions; `/send` becomes legacy alias |

---

## Open Questions

1. **Firestore composite index for history query**
   - What we know: `where("status", "in", [...]) + orderBy("created_at", "desc")` requires a composite index in Firestore
   - What's unclear: Whether this index already exists (it may have been created when Phase 7 deployed, or it may not)
   - Recommendation: Plan around client-side sort as the default path; note in plan to check Firebase Console for existing index. If index exists, it can be used; if not, client-side sort is the safe fallback.

2. **Firestore `in` query with 4-value array and vendor filter**
   - What we know: Firestore's `in` operator supports up to 10 values; combining `in` on `status` with `==` on `vendor` requires a composite index
   - What's unclear: Whether the vendor+status combination will be used frequently enough to justify the index
   - Recommendation: Apply vendor filter client-side (same `useMemo` as date range), keeping the Firestore query to just `where("status", "in", ["aprobado", "enviado", "parcial", "recibido"])` — simplest query, avoids all index issues.

---

## Sources

### Primary (HIGH confidence)

- Codebase — `src/pages/reposiciones/` (all files) — direct read of existing patterns
- Codebase — `backend/routers/reposiciones.py` — direct read of backend patterns
- Codebase — `src/components/ui/` listing — verified installed shadcn/ui components
- Codebase — `firestore.rules` — verified `replenishment_orders` collection rules
- `.planning/phases/08-historial-de-pedidos/08-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)

- Firestore documentation (training data) — `onSnapshot`, `ArrayUnion`, composite index requirements — well-established stable APIs
- shadcn/ui Tabs + Collapsible patterns — verified components are installed in `src/components/ui/`

### Tertiary (LOW confidence)

- None — all critical claims are grounded in direct codebase reads

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified as installed in codebase
- Architecture: HIGH — all patterns are extensions of existing code in the same module
- Pitfalls: HIGH — all pitfalls derived from direct codebase analysis (Firestore query limits, Phase 7 schema gaps, table overflow project rule)

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable stack, no fast-moving dependencies)
