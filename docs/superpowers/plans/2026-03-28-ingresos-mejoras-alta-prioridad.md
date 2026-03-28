# Ingresos: Mejoras Alta Prioridad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar 3 mejoras de prioridad alta en la sección Ingresos: auto-saltar duplicados al crear en Shopify, validación inmediata de archivos en frontend, y throttling reactivo de rate limits de Shopify.

**Architecture:** Backend FastAPI (`backend/services/shopify_service.py`, `backend/routers/ingreso.py`) + Frontend React/TypeScript (`src/pages/ingreso/`, `src/pages/CrearProductos.tsx`). Los cambios de throttling y duplicados son puramente backend. La validación es puramente frontend. No hay dependencias cruzadas entre las 3 mejoras.

**Tech Stack:** Python 3 / FastAPI / requests / threading, React 18 / TypeScript / Vitest

**Spec:** `docs/superpowers/specs/2026-03-28-ingresos-mejoras-alta-prioridad-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `backend/services/shopify_service.py` | Modify | `ShopifyThrottler` class, `check_existing_skus()`, throttle integration |
| `backend/routers/ingreso.py` | Modify | `skipped` field in `/productos/shopify` response |
| `src/pages/ingreso/validation.ts` | Create | `validateProductFile()` function |
| `src/pages/ingreso/types.ts` | Modify | `skipped` field in types |
| `src/pages/CrearProductos.tsx` | Modify | Validation UI, skipped badges/icons |
| `src/test/ingreso/validation.test.ts` | Create | Tests for `validateProductFile()` |

---

## Task 1: ShopifyThrottler — Rate Limit Class

**Files:**
- Modify: `backend/services/shopify_service.py:1-18` (imports + new class after helpers)

- [ ] **Step 1: Add ShopifyThrottler class after imports**

In `backend/services/shopify_service.py`, add after the existing imports (line 5, after `from config import settings`):

```python
import threading


class ShopifyThrottler:
    """Rate limiter reactivo para la API de Shopify.

    Lee headers de rate limit de cada respuesta y frena requests
    cuando la cuota disponible baja de umbrales configurados.
    """

    def __init__(self, low_threshold: float = 0.2, critical_threshold: float = 0.1):
        self._lock = threading.Lock()
        self._available_ratio = 1.0
        self._low_threshold = low_threshold
        self._critical_threshold = critical_threshold

    def update_from_response(self, response: requests.Response):
        """Lee headers de rate limit y actualiza estado interno."""
        # REST API: "X-Shopify-Shop-Api-Call-Limit: 32/40"
        limit_header = response.headers.get("X-Shopify-Shop-Api-Call-Limit")
        if limit_header and "/" in limit_header:
            try:
                used, total = limit_header.split("/")
                with self._lock:
                    self._available_ratio = 1.0 - (int(used) / int(total))
            except (ValueError, ZeroDivisionError):
                pass
            return

        # GraphQL: extensions.cost en el body JSON
        try:
            body = response.json()
            cost = body.get("extensions", {}).get("cost", {})
            available = cost.get("throttleStatus", {}).get("currentlyAvailable", 0)
            maximum = cost.get("throttleStatus", {}).get("maximumAvailable", 1000)
            if maximum > 0:
                with self._lock:
                    self._available_ratio = available / maximum
        except Exception:
            pass

    def wait_if_needed(self):
        """Bloquea si la cuota esta baja. Llamar ANTES de cada request."""
        with self._lock:
            ratio = self._available_ratio

        if ratio < self._critical_threshold:
            time.sleep(1.0)
        elif ratio < self._low_threshold:
            time.sleep(0.5)

    def handle_429(self, response: requests.Response) -> float:
        """Retorna segundos a esperar ante un 429."""
        retry_after = response.headers.get("Retry-After")
        if retry_after:
            try:
                return float(retry_after)
            except ValueError:
                pass
        return 2.0


_throttler = ShopifyThrottler()
```

- [ ] **Step 2: Verify file still parses**

Run: `cd backend && python -c "import services.shopify_service; print('OK')"`
Expected: `OK` (no syntax errors)

- [ ] **Step 3: Commit**

```bash
git add backend/services/shopify_service.py
git commit -m "feat(shopify): add ShopifyThrottler class for rate limit management"
```

---

## Task 2: Integrate Throttler into Product Creation

**Files:**
- Modify: `backend/services/shopify_service.py` — `_create_single_product` function (lines 629-716)

- [ ] **Step 1: Add MAX_RETRIES constant and refactor _create_single_product**

Replace the `_create_single_product` function with retry + throttle logic:

```python
_MAX_RETRIES = 3


def _create_single_product(session: requests.Session, row: dict) -> dict:
    """Crea un unico producto en Shopify (2 pasos: producto + variante). Retorna resultado."""
    graphql_url = settings.get_graphql_url()
    sku = str(row.get("Variant SKU", "???"))
    title = str(row.get("Title", "???"))

    try:
        # Paso 1: Crear producto
        product_input, media = _build_product_input(row)
        variables: dict = {"product": product_input}
        if media:
            variables["media"] = media

        response = None
        for attempt in range(_MAX_RETRIES):
            _throttler.wait_if_needed()
            response = session.post(
                graphql_url,
                json={"query": _PRODUCT_CREATE_MUTATION, "variables": variables},
                timeout=30,
            )
            _throttler.update_from_response(response)

            if response.status_code == 429:
                wait = _throttler.handle_429(response)
                print(f"[THROTTLE] 429 for SKU {sku}, waiting {wait}s (attempt {attempt + 1})", flush=True)
                time.sleep(wait)
                continue
            break  # No fue 429, salir del retry loop

        if response is None or response.status_code == 429:
            return {"sku": sku, "title": title, "success": False, "error": "Rate limited after retries"}

        if response.status_code != 200:
            return {"sku": sku, "title": title, "success": False, "error": f"HTTP {response.status_code}"}

        data = response.json()

        if "errors" in data:
            error_msg = "; ".join(e.get("message", "") for e in data["errors"])
            return {"sku": sku, "title": title, "success": False, "error": error_msg}

        result = data.get("data", {}).get("productCreate", {})
        user_errors = result.get("userErrors", [])
        if user_errors:
            error_msg = "; ".join(e.get("message", "") for e in user_errors)
            return {"sku": sku, "title": title, "success": False, "error": error_msg}

        product = result.get("product", {})
        product_id = product.get("id", "")

        # Obtener ID de la variante default creada automaticamente
        variant_nodes = product.get("variants", {}).get("nodes", [])
        variant_id = variant_nodes[0]["id"] if variant_nodes else None

        # Paso 2: Actualizar variante con SKU, precio, barcode, peso
        if variant_id:
            variant_input: dict = {
                "id": variant_id,
                "barcode": str(row.get("Variant Barcode", "")),
                "taxable": False,
                "inventoryPolicy": "DENY",
            }

            inv_item: dict = {"sku": sku, "requiresShipping": True, "tracked": True}
            weight = row.get("Variant Weight")
            if weight is not None and str(weight).lower() != "nan":
                inv_item["measurement"] = {
                    "weight": {"value": float(weight), "unit": "KILOGRAMS"}
                }
            variant_input["inventoryItem"] = inv_item

            price = row.get("Variant Price")
            if price is not None and str(price).lower() != "nan":
                variant_input["price"] = str(price)

            compare_price = row.get("Variant Compare At Price")
            if compare_price is not None and str(compare_price).lower() != "nan":
                variant_input["compareAtPrice"] = str(compare_price)

            _throttler.wait_if_needed()
            variant_response = session.post(
                graphql_url,
                json={
                    "query": _VARIANT_UPDATE_MUTATION,
                    "variables": {
                        "productId": product_id,
                        "variants": [variant_input],
                    },
                },
                timeout=30,
            )
            _throttler.update_from_response(variant_response)

        return {
            "sku": sku,
            "title": title,
            "success": True,
            "shopify_id": product_id,
        }

    except Exception as e:
        return {"sku": sku, "title": title, "success": False, "error": str(e)}
```

- [ ] **Step 2: Verify file still parses**

Run: `cd backend && python -c "import services.shopify_service; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/services/shopify_service.py
git commit -m "feat(shopify): integrate throttler into product creation with retry on 429"
```

---

## Task 3: Integrate Throttler into Batch Queries

**Files:**
- Modify: `backend/services/shopify_service.py` — `process_batch_info` (line ~157) and `process_batch_inventory` (line ~249)

- [ ] **Step 1: Add throttle calls to process_batch_info**

In `process_batch_info`, find the line:

```python
        response = session.post(graphql_url, json={"query": query}, timeout=30)
```

Replace with:

```python
        _throttler.wait_if_needed()
        response = session.post(graphql_url, json={"query": query}, timeout=30)
        _throttler.update_from_response(response)
```

- [ ] **Step 2: Add throttle calls to process_batch_inventory**

In `process_batch_inventory`, find the same pattern:

```python
        response = session.post(graphql_url, json={"query": query}, timeout=30)
```

Replace with:

```python
        _throttler.wait_if_needed()
        response = session.post(graphql_url, json={"query": query}, timeout=30)
        _throttler.update_from_response(response)
```

Also find the inventory REST calls inside the `for b_name, b_id in selected_locations:` loop:

```python
                        inv_response = session.get(
```

Add throttle before that line:

```python
                        _throttler.wait_if_needed()
                        inv_response = session.get(
```

And after the response check `if inv_response.status_code == 200:`, add at the start of the `try` block (after getting `inv_response`):

```python
                        _throttler.update_from_response(inv_response)
```

- [ ] **Step 3: Verify file still parses**

Run: `cd backend && python -c "import services.shopify_service; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/services/shopify_service.py
git commit -m "feat(shopify): integrate throttler into batch search and inventory queries"
```

---

## Task 4: check_existing_skus Function

**Files:**
- Modify: `backend/services/shopify_service.py` — add new function before `create_products_batch`

- [ ] **Step 1: Add check_existing_skus function**

Add this function before `create_products_batch` (around line 719):

```python
def check_existing_skus(skus: list[str]) -> set[str]:
    """Busca SKUs en Shopify y retorna el set de los que ya existen."""
    if not skus:
        return set()

    headers = settings.get_shopify_headers()
    graphql_url = settings.get_graphql_url()
    session = requests.Session()
    session.headers.update(headers)
    existing = set()

    batches = list(chunk_list(skus, settings.BATCH_SIZE))

    def _check_batch(batch: list[str]) -> set[str]:
        found = set()
        conditions = " OR ".join([f"sku:{sku}" for sku in batch])
        query = """
        {
          productVariants(first: 250, query: "%s") {
            edges {
              node { sku }
            }
          }
        }
        """ % conditions
        try:
            _throttler.wait_if_needed()
            response = session.post(graphql_url, json={"query": query}, timeout=30)
            _throttler.update_from_response(response)
            if response.status_code == 200:
                data = response.json()
                edges = data.get("data", {}).get("productVariants", {}).get("edges", [])
                for edge in edges:
                    sku = str(edge["node"].get("sku", "")).strip()
                    if sku in batch:
                        found.add(sku)
        except Exception:
            pass
        return found

    with ThreadPoolExecutor(max_workers=settings.MAX_WORKERS) as executor:
        futures = [executor.submit(_check_batch, batch) for batch in batches]
        for future in as_completed(futures):
            existing.update(future.result())

    return existing
```

- [ ] **Step 2: Verify file still parses**

Run: `cd backend && python -c "import services.shopify_service; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/services/shopify_service.py
git commit -m "feat(shopify): add check_existing_skus for duplicate detection"
```

---

## Task 5: Integrate Duplicate Detection into create_products_batch

**Files:**
- Modify: `backend/services/shopify_service.py` — `create_products_batch` function (lines ~719-740)
- Modify: `backend/routers/ingreso.py` — `/productos/shopify` endpoint (lines ~473-518)

- [ ] **Step 1: Modify create_products_batch to skip existing SKUs**

Replace the entire `create_products_batch` function:

```python
def create_products_batch(rows: list[dict]) -> list[dict]:
    """
    Crea productos en Shopify con concurrencia.
    SKUs que ya existen se saltan automaticamente.
    rows: lista de dicts (filas del DataFrame procesado).
    Retorna lista de resultados por producto.
    """
    # 1. Extraer SKUs y buscar cuales ya existen
    all_skus = [str(r.get("Variant SKU", "")) for r in rows]
    existing = check_existing_skus(all_skus)

    # 2. Separar filas nuevas vs existentes
    new_rows = []
    results = []
    for row in rows:
        sku = str(row.get("Variant SKU", ""))
        if sku in existing:
            results.append({
                "sku": sku,
                "title": str(row.get("Title", "")),
                "success": False,
                "skipped": True,
                "error": "SKU ya existe en Shopify",
            })
        else:
            new_rows.append(row)

    # 3. Crear solo los nuevos
    if new_rows:
        headers = settings.get_shopify_headers()
        session = requests.Session()
        session.headers.update(headers)

        with ThreadPoolExecutor(max_workers=settings.MAX_WORKERS) as executor:
            futures = {
                executor.submit(_create_single_product, session, row): i
                for i, row in enumerate(new_rows)
            }
            for future in as_completed(futures):
                results.append(future.result())

    # Ordenar por SKU para consistencia
    results.sort(key=lambda r: r.get("sku", ""))
    return results
```

- [ ] **Step 2: Update the /productos/shopify endpoint response**

In `backend/routers/ingreso.py`, find the return block in `crear_productos_shopify` (around line 510):

```python
    created = sum(1 for r in results if r["success"])
    failed = sum(1 for r in results if not r["success"])

    return {
        "total": len(results),
        "created": created,
        "failed": failed,
        "results": results,
    }
```

Replace with:

```python
    created = sum(1 for r in results if r["success"])
    skipped = sum(1 for r in results if r.get("skipped"))
    failed = sum(1 for r in results if not r["success"] and not r.get("skipped"))

    return {
        "total": len(results),
        "created": created,
        "skipped": skipped,
        "failed": failed,
        "results": results,
    }
```

- [ ] **Step 3: Verify both files parse**

Run: `cd backend && python -c "import routers.ingreso; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/services/shopify_service.py backend/routers/ingreso.py
git commit -m "feat(shopify): auto-skip duplicate SKUs in product creation"
```

---

## Task 6: Frontend Validation Function + Tests

**Files:**
- Create: `src/pages/ingreso/validation.ts`
- Create: `src/test/ingreso/validation.test.ts`

- [ ] **Step 1: Write the tests**

Create `src/test/ingreso/validation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateProductFile, type ValidationError } from "@/pages/ingreso/validation";

function makeRow(overrides: Record<string, unknown> = {}) {
  return { Titulo: "Mi Libro", SKU: "12345", Vendor: "Editorial X", ...overrides };
}

describe("validateProductFile", () => {
  it("returns no errors for a valid file", () => {
    const rows = [makeRow(), makeRow({ SKU: "67890" })];
    const columns = ["Titulo", "SKU", "Vendor"];
    expect(validateProductFile(rows, columns)).toEqual([]);
  });

  it("detects missing required columns", () => {
    const errors = validateProductFile([makeRow()], ["Titulo", "Vendor"]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("SKU");
    expect(errors[0].row).toBeUndefined();
  });

  it("detects empty SKU in a row", () => {
    const rows = [makeRow({ SKU: "" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor"]);
    const skuError = errors.find((e) => e.field === "SKU");
    expect(skuError).toBeDefined();
    expect(skuError!.row).toBe(2);
  });

  it("detects empty Titulo in a row", () => {
    const rows = [makeRow({ Titulo: "" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor"]);
    const err = errors.find((e) => e.field === "Titulo");
    expect(err).toBeDefined();
    expect(err!.row).toBe(2);
  });

  it("detects empty Vendor in a row", () => {
    const rows = [makeRow({ Vendor: "" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor"]);
    const err = errors.find((e) => e.field === "Vendor");
    expect(err).toBeDefined();
  });

  it("detects duplicate SKUs within the file", () => {
    const rows = [makeRow({ SKU: "111" }), makeRow({ SKU: "111" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor"]);
    const dupError = errors.find((e) => e.message.includes("duplicado"));
    expect(dupError).toBeDefined();
    expect(dupError!.row).toBe(3);
  });

  it("detects invalid price", () => {
    const rows = [makeRow({ Precio: "abc" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor", "Precio"]);
    const err = errors.find((e) => e.field === "Precio");
    expect(err).toBeDefined();
  });

  it("allows valid numeric price", () => {
    const rows = [makeRow({ Precio: 29900 })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor", "Precio"]);
    expect(errors).toEqual([]);
  });

  it("detects invalid image URL", () => {
    const rows = [makeRow({ "Portada (URL)": "not-a-url" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor", "Portada (URL)"]);
    const err = errors.find((e) => e.field === "Portada (URL)");
    expect(err).toBeDefined();
  });

  it("allows valid image URL", () => {
    const rows = [makeRow({ "Portada (URL)": "https://example.com/img.jpg" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor", "Portada (URL)"]);
    expect(errors).toEqual([]);
  });

  it("treats SKU with .0 suffix as integer", () => {
    const rows = [makeRow({ SKU: "12345.0" }), makeRow({ SKU: "12345" })];
    const errors = validateProductFile(rows, ["Titulo", "SKU", "Vendor"]);
    const dupError = errors.find((e) => e.message.includes("duplicado"));
    expect(dupError).toBeDefined();
  });

  it("returns early if required columns missing (no row errors)", () => {
    const errors = validateProductFile([{ Foo: "bar" }], ["Foo"]);
    expect(errors.length).toBe(3); // Titulo, SKU, Vendor missing
    expect(errors.every((e) => e.row === undefined)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/ingreso/validation.test.ts`
Expected: FAIL — module `@/pages/ingreso/validation` does not exist yet

- [ ] **Step 3: Write the validation function**

Create `src/pages/ingreso/validation.ts`:

```typescript
export interface ValidationError {
  row?: number;
  field: string;
  message: string;
}

const REQUIRED_COLUMNS = ["Titulo", "SKU", "Vendor"] as const;

function cleanSku(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return s.replace(/\.0$/, "");
}

export function validateProductFile(
  rows: Record<string, unknown>[],
  columns: string[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Required columns
  for (const col of REQUIRED_COLUMNS) {
    if (!columns.includes(col)) {
      errors.push({ field: col, message: `Columna "${col}" no encontrada` });
    }
  }
  if (errors.length > 0) return errors;

  // 2. Per-row validation
  const skuSeen = new Map<string, number>();

  rows.forEach((row, i) => {
    const rowNum = i + 2; // row 1 = header

    const titulo = String(row["Titulo"] ?? "").trim();
    if (!titulo) {
      errors.push({ row: rowNum, field: "Titulo", message: `Fila ${rowNum}: Titulo vacío` });
    }

    const sku = cleanSku(row["SKU"]);
    if (!sku) {
      errors.push({ row: rowNum, field: "SKU", message: `Fila ${rowNum}: SKU vacío` });
    } else {
      const firstRow = skuSeen.get(sku);
      if (firstRow !== undefined) {
        errors.push({
          row: rowNum,
          field: "SKU",
          message: `Fila ${rowNum}: SKU "${sku}" duplicado (ya en fila ${firstRow})`,
        });
      } else {
        skuSeen.set(sku, rowNum);
      }
    }

    const vendor = String(row["Vendor"] ?? "").trim();
    if (!vendor) {
      errors.push({ row: rowNum, field: "Vendor", message: `Fila ${rowNum}: Vendor vacío` });
    }

    // Price (optional)
    if ("Precio" in row && row["Precio"] != null && String(row["Precio"]).trim() !== "") {
      const precio = Number(row["Precio"]);
      if (isNaN(precio) || precio <= 0) {
        errors.push({
          row: rowNum,
          field: "Precio",
          message: `Fila ${rowNum}: Precio inválido "${row["Precio"]}"`,
        });
      }
    }

    // Image URL (optional)
    if ("Portada (URL)" in row && row["Portada (URL)"] != null) {
      const url = String(row["Portada (URL)"]).trim();
      if (url && !/^https?:\/\/.+/i.test(url)) {
        errors.push({
          row: rowNum,
          field: "Portada (URL)",
          message: `Fila ${rowNum}: URL de portada inválida`,
        });
      }
    }
  });

  return errors;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/ingreso/validation.test.ts`
Expected: All 12 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/ingreso/validation.ts src/test/ingreso/validation.test.ts
git commit -m "feat(ingreso): add frontend file validation with tests"
```

---

## Task 7: Update Frontend Types for Skipped Products

**Files:**
- Modify: `src/pages/ingreso/types.ts`

- [ ] **Step 1: Add skipped fields to types**

In `src/pages/ingreso/types.ts`, find `ShopifyCreateResult` (line 39):

```typescript
export interface ShopifyCreateResult {
  sku: string;
  title: string;
  success: boolean;
  error?: string;
  shopify_id?: string;
}
```

Replace with:

```typescript
export interface ShopifyCreateResult {
  sku: string;
  title: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
  shopify_id?: string;
}
```

Find `ShopifyCreateResponse` (line 47):

```typescript
export interface ShopifyCreateResponse {
  total: number;
  created: number;
  failed: number;
  results: ShopifyCreateResult[];
}
```

Replace with:

```typescript
export interface ShopifyCreateResponse {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  results: ShopifyCreateResult[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ingreso/types.ts
git commit -m "feat(ingreso): add skipped field to Shopify response types"
```

---

## Task 8: Integrate Validation + Skipped UI into CrearProductos

**Files:**
- Modify: `src/pages/CrearProductos.tsx`

- [ ] **Step 1: Add validation imports and state**

At the top of `CrearProductos.tsx`, add to the imports from lucide (line 5):

```typescript
import {
  AlertCircle,
  RefreshCw,
  Download,
  Loader2,
  Rocket,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  SkipForward,
} from "lucide-react";
```

Add import for the validation function (after the existing ingreso imports, around line 41):

```typescript
import { validateProductFile, type ValidationError } from "./ingreso/validation";
```

In the component body, after `const [shopifyResult, setShopifyResult]` (line 60), add:

```typescript
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
```

- [ ] **Step 2: Integrate validation into handleFileSelected**

Replace the `handleFileSelected` function (lines 62-86):

```typescript
  const handleFileSelected = (f: File) => {
    setFile(f);
    processMutation.reset();
    shopifyMutation.reset();
    setProcessedBlob(null);
    setShopifyResult(null);
    setValidationErrors([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<PreviewRow>(ws);
        const cols = json.length > 0 ? Object.keys(json[0]) : [];
        setTotalRows(json.length);
        setColumns(cols);
        setPreview(json.slice(0, 5));
        setValidationErrors(validateProductFile(json, cols));
      } catch {
        setPreview([]);
        setColumns([]);
        setTotalRows(0);
        setValidationErrors([]);
      }
    };
    reader.readAsArrayBuffer(f);
  };
```

- [ ] **Step 3: Add validation errors UI in Paso 2 card**

Find the closing of the preview section (after `{totalRows > 5 && ...}`, around line 283). Add after it, still inside the `{file && totalRows > 0 && (` block:

```typescript
              {validationErrors.length > 0 ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {validationErrors.length} error{validationErrors.length !== 1 && "es"} encontrado{validationErrors.length !== 1 && "s"}
                  </AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                      {validationErrors.slice(0, 20).map((err, i) => (
                        <li key={i}>{err.message}</li>
                      ))}
                    </ul>
                    {validationErrors.length > 20 && (
                      <p className="mt-1 text-xs">
                        ...y {validationErrors.length - 20} errores más
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <Badge className="bg-green-600 text-white hover:bg-green-700">
                  Archivo válido
                </Badge>
              )}
```

Also need to import `AlertTitle` — it's already imported from `@/components/ui/alert` on line 22.

- [ ] **Step 4: Disable Procesar button when validation errors exist**

Find the Procesar button (around line 302):

```typescript
            disabled={!file || processMutation.isPending}
```

Replace with:

```typescript
            disabled={!file || validationErrors.length > 0 || processMutation.isPending}
```

- [ ] **Step 5: Update Shopify results to show skipped badge**

Find the badges section in the Shopify results (around line 405):

```typescript
              <div className="flex items-center gap-3">
                <Badge
                  variant={shopifyResult.failed === 0 ? "default" : "secondary"}
                >
                  {shopifyResult.created} creado
                  {shopifyResult.created !== 1 && "s"}
                </Badge>
                {shopifyResult.failed > 0 && (
                  <Badge variant="destructive">
                    {shopifyResult.failed} con errores
                  </Badge>
                )}
                <Badge variant="outline">{shopifyResult.total} total</Badge>
              </div>
```

Replace with:

```typescript
              <div className="flex items-center gap-3 flex-wrap">
                <Badge
                  variant={shopifyResult.failed === 0 ? "default" : "secondary"}
                >
                  {shopifyResult.created} creado
                  {shopifyResult.created !== 1 && "s"}
                </Badge>
                {shopifyResult.skipped > 0 && (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400">
                    {shopifyResult.skipped} saltado{shopifyResult.skipped !== 1 && "s"}
                  </Badge>
                )}
                {shopifyResult.failed > 0 && (
                  <Badge variant="destructive">
                    {shopifyResult.failed} con errores
                  </Badge>
                )}
                <Badge variant="outline">{shopifyResult.total} total</Badge>
              </div>
```

- [ ] **Step 6: Update results table to show skipped icon**

Find the status cell in the results table (around line 432):

```typescript
                        <TableCell>
                          {r.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
```

Replace with:

```typescript
                        <TableCell>
                          {r.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : r.skipped ? (
                            <SkipForward className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
```

- [ ] **Step 7: Update toast message for skipped products**

Find the `handleCreateInShopify` success callback (around line 123):

```typescript
      onSuccess: (data) => {
        setShopifyResult(data);
        if (data.failed === 0) {
          toast.success(`${data.created} producto${data.created !== 1 ? "s" : ""} creado${data.created !== 1 ? "s" : ""} en Shopify`);
        } else {
          toast.warning(
            `${data.created} creados, ${data.failed} con errores`,
          );
        }
      },
```

Replace with:

```typescript
      onSuccess: (data) => {
        setShopifyResult(data);
        const parts: string[] = [];
        if (data.created > 0) parts.push(`${data.created} creado${data.created !== 1 ? "s" : ""}`);
        if (data.skipped > 0) parts.push(`${data.skipped} saltado${data.skipped !== 1 ? "s" : ""}`);
        if (data.failed > 0) parts.push(`${data.failed} con errores`);
        const msg = parts.join(", ");
        if (data.failed === 0) {
          toast.success(msg);
        } else {
          toast.warning(msg);
        }
      },
```

- [ ] **Step 8: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 9: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (including the new validation tests)

- [ ] **Step 10: Commit**

```bash
git add src/pages/CrearProductos.tsx
git commit -m "feat(ingreso): add validation UI, skipped badges, and throttle-aware product creation"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Verify backend parses**

Run: `cd backend && python -c "from routers.ingreso import router; from services.shopify_service import ShopifyThrottler, check_existing_skus; print('ALL OK')"`
Expected: `ALL OK`
