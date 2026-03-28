# Actualizar Productos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nueva pagina "Actualizar Productos" en Workflow > Ingresos que permite actualizar productos existentes en Shopify masivamente via Excel, con vista previa de cambios antes de aplicar.

**Architecture:** Backend FastAPI con 2 endpoints nuevos (preview + apply) en `routers/ingreso.py`, logica de busqueda extendida y actualizacion en `services/shopify_service.py`. Frontend React con nueva pagina wizard de 4 pasos, reutilizando componentes existentes (FileUploadZone, validation patterns, hooks/api patterns).

**Tech Stack:** Python 3 / FastAPI / requests / pandas, React 18 / TypeScript / Vitest / TanStack Query

**Spec:** `docs/superpowers/specs/2026-03-28-actualizar-productos-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `backend/templates/Actualizacion_productos.xlsx` | Create | Plantilla Excel con columnas de actualizacion |
| `backend/services/shopify_service.py` | Modify | `fetch_products_for_update()`, `_update_single_product()`, `update_products_batch()`, mutations |
| `backend/routers/ingreso.py` | Modify | Endpoints `actualizar/preview` y `actualizar/apply`, template `actualizacion` |
| `src/pages/ingreso/types.ts` | Modify | Tipos de update preview/apply response |
| `src/pages/ingreso/validation.ts` | Modify | `validateUpdateFile()` function |
| `src/test/ingreso/validation.test.ts` | Modify | Tests para `validateUpdateFile()` |
| `src/pages/ingreso/api.ts` | Modify | `previewUpdateProducts()`, `applyUpdateProducts()` |
| `src/pages/ingreso/hooks.ts` | Modify | `usePreviewUpdate()`, `useApplyUpdate()` |
| `src/pages/ActualizarProductos.tsx` | Create | Pagina principal con wizard 4 pasos |
| `src/App.tsx` | Modify | Ruta `/actualizar-productos` |
| `src/hooks/useNavigationPermissions.ts` | Modify | Agregar a `WORKFLOW_SUB_PATHS` |

---

## Task 1: Create Update Template Excel

**Files:**
- Create: `backend/templates/Actualizacion_productos.xlsx`

- [ ] **Step 1: Create the template with Python**

Run from `backend/` directory:

```bash
cd backend && python -c "
import pandas as pd
columns = ['SKU', 'ID', 'Titulo', 'Sipnosis', 'Vendor', 'Precio', 'Precio de comparacion', 'Portada (URL)', 'Autor', 'Editorial', 'Idioma', 'Formato', 'Categoria', 'Subcategoria', 'Peso (kg)']
df = pd.DataFrame(columns=columns)
df.to_excel('templates/Actualizacion_productos.xlsx', index=False, sheet_name='Products')
print('Template created with', len(columns), 'columns')
"
```

Expected: `Template created with 15 columns`

- [ ] **Step 2: Update the template mapping in ingreso.py**

In `backend/routers/ingreso.py`, find the `allowed` dict in `download_template` (around line 261):

```python
    allowed = {
        "creacion": "Creacion_productos.xlsx",
        "actualizacion": "Plantilla_Actualizacion_Productos.xlsx",
    }
```

Replace with:

```python
    allowed = {
        "creacion": "Creacion_productos.xlsx",
        "actualizacion": "Actualizacion_productos.xlsx",
    }
```

- [ ] **Step 3: Verify template downloads**

Run: `cd backend && python -c "import os; print('EXISTS' if os.path.exists('templates/Actualizacion_productos.xlsx') else 'MISSING')"`
Expected: `EXISTS`

- [ ] **Step 4: Commit**

```bash
git add backend/templates/Actualizacion_productos.xlsx backend/routers/ingreso.py
git commit -m "feat(ingreso): create update products template and fix template mapping"
```

---

## Task 2: Frontend Types for Update

**Files:**
- Modify: `src/pages/ingreso/types.ts`

- [ ] **Step 1: Add update types**

At the end of `src/pages/ingreso/types.ts`, add:

```typescript
// ---------------------------------------------------------------------------
// Update Products
// ---------------------------------------------------------------------------

export interface UpdateFieldDiff {
  field: string;
  current: string;
  new: string;
}

export interface UpdateProductPreview {
  sku: string;
  title: string;
  product_id: string;
  variant_id: string;
  fields: UpdateFieldDiff[];
}

export interface UpdatePreviewResponse {
  total: number;
  found: number;
  not_found: number;
  changes: number;
  no_changes: number;
  preview: UpdateProductPreview[];
  not_found_skus: string[];
}

export interface UpdateApplyResult {
  sku: string;
  title: string;
  success: boolean;
  fields_updated?: string[];
  error?: string;
}

export interface UpdateApplyResponse {
  total: number;
  updated: number;
  failed: number;
  results: UpdateApplyResult[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ingreso/types.ts
git commit -m "feat(ingreso): add update products types"
```

---

## Task 3: Frontend Validation for Update Files + Tests

**Files:**
- Modify: `src/pages/ingreso/validation.ts`
- Modify: `src/test/ingreso/validation.test.ts`

- [ ] **Step 1: Write the tests**

Append to `src/test/ingreso/validation.test.ts`:

```typescript
import { validateUpdateFile } from "@/pages/ingreso/validation";

function makeUpdateRow(overrides: Record<string, unknown> = {}) {
  return { SKU: "12345", Precio: 29900, ...overrides };
}

describe("validateUpdateFile", () => {
  it("returns no errors for valid file with SKU", () => {
    const rows = [makeUpdateRow()];
    const columns = ["SKU", "Precio"];
    expect(validateUpdateFile(rows, columns)).toEqual([]);
  });

  it("returns no errors for valid file with ID", () => {
    const rows = [{ ID: "123", Vendor: "Planeta" }];
    const columns = ["ID", "Vendor"];
    expect(validateUpdateFile(rows, columns)).toEqual([]);
  });

  it("detects missing identifier columns", () => {
    const errors = validateUpdateFile([{ Precio: 100 }], ["Precio"]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("SKU");
    expect(errors[0].message).toContain("ID");
  });

  it("detects no data columns present", () => {
    const errors = validateUpdateFile([{ SKU: "123" }], ["SKU"]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("columna de datos");
  });

  it("detects empty SKU in a row when SKU is the identifier", () => {
    const rows = [makeUpdateRow({ SKU: "" })];
    const errors = validateUpdateFile(rows, ["SKU", "Precio"]);
    const err = errors.find((e) => e.field === "SKU");
    expect(err).toBeDefined();
    expect(err!.row).toBe(2);
  });

  it("detects duplicate SKUs", () => {
    const rows = [makeUpdateRow({ SKU: "111" }), makeUpdateRow({ SKU: "111" })];
    const errors = validateUpdateFile(rows, ["SKU", "Precio"]);
    const dupError = errors.find((e) => e.message.includes("duplicado"));
    expect(dupError).toBeDefined();
  });

  it("detects invalid price", () => {
    const rows = [makeUpdateRow({ Precio: "abc" })];
    const errors = validateUpdateFile(rows, ["SKU", "Precio"]);
    const err = errors.find((e) => e.field === "Precio");
    expect(err).toBeDefined();
  });

  it("detects invalid image URL", () => {
    const rows = [makeUpdateRow({ "Portada (URL)": "not-a-url" })];
    const errors = validateUpdateFile(rows, ["SKU", "Portada (URL)"]);
    const err = errors.find((e) => e.field === "Portada (URL)");
    expect(err).toBeDefined();
  });

  it("allows file with only ID column as identifier", () => {
    const rows = [{ ID: "123", Titulo: "Nuevo" }];
    const errors = validateUpdateFile(rows, ["ID", "Titulo"]);
    expect(errors).toEqual([]);
  });

  it("treats SKU with .0 suffix as integer", () => {
    const rows = [makeUpdateRow({ SKU: "12345.0" }), makeUpdateRow({ SKU: "12345" })];
    const errors = validateUpdateFile(rows, ["SKU", "Precio"]);
    const dupError = errors.find((e) => e.message.includes("duplicado"));
    expect(dupError).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/ingreso/validation.test.ts`
Expected: FAIL — `validateUpdateFile` is not exported

- [ ] **Step 3: Implement validateUpdateFile**

In `src/pages/ingreso/validation.ts`, add at the end of the file:

```typescript
const UPDATE_DATA_COLUMNS = [
  "Titulo", "Sipnosis", "Vendor", "Precio", "Precio de comparacion",
  "Portada (URL)", "Autor", "Editorial", "Idioma", "Formato",
  "Categoria", "Subcategoria", "Peso (kg)",
] as const;

export function validateUpdateFile(
  rows: Record<string, unknown>[],
  columns: string[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. At least one identifier column
  const hasSku = columns.includes("SKU");
  const hasId = columns.includes("ID");
  if (!hasSku && !hasId) {
    errors.push({
      field: "Identificador",
      message: 'Se requiere al menos una columna identificadora: "SKU" o "ID"',
    });
    return errors;
  }

  // 2. At least one data column
  const dataColumns = columns.filter((c) =>
    (UPDATE_DATA_COLUMNS as readonly string[]).includes(c),
  );
  if (dataColumns.length === 0) {
    errors.push({
      field: "Datos",
      message: "Se requiere al menos una columna de datos a actualizar",
    });
    return errors;
  }

  // 3. Per-row validation
  const idSeen = new Map<string, number>();

  rows.forEach((row, i) => {
    const rowNum = i + 2;

    // Identifier: prefer SKU, fallback to ID
    if (hasSku) {
      const sku = cleanSku(row["SKU"]);
      if (!sku) {
        errors.push({ row: rowNum, field: "SKU", message: `Fila ${rowNum}: SKU vacío` });
      } else {
        const firstRow = idSeen.get(sku);
        if (firstRow !== undefined) {
          errors.push({
            row: rowNum,
            field: "SKU",
            message: `Fila ${rowNum}: SKU "${sku}" duplicado (ya en fila ${firstRow})`,
          });
        } else {
          idSeen.set(sku, rowNum);
        }
      }
    } else if (hasId) {
      const id = String(row["ID"] ?? "").trim();
      if (!id) {
        errors.push({ row: rowNum, field: "ID", message: `Fila ${rowNum}: ID vacío` });
      }
    }

    // Price validation (if present)
    for (const priceCol of ["Precio", "Precio de comparacion"]) {
      if (priceCol in row && row[priceCol] != null && String(row[priceCol]).trim() !== "") {
        const val = Number(row[priceCol]);
        if (isNaN(val) || val <= 0) {
          errors.push({
            row: rowNum,
            field: priceCol,
            message: `Fila ${rowNum}: ${priceCol} inválido "${row[priceCol]}"`,
          });
        }
      }
    }

    // URL validation (if present)
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
Expected: All tests pass (22 total: 12 existing + 10 new)

- [ ] **Step 5: Commit**

```bash
git add src/pages/ingreso/validation.ts src/test/ingreso/validation.test.ts
git commit -m "feat(ingreso): add validateUpdateFile with tests"
```

---

## Task 4: Backend — Fetch Products for Update (Extended Query)

**Files:**
- Modify: `backend/services/shopify_service.py`

- [ ] **Step 1: Add the extended GraphQL query builder**

In `backend/services/shopify_service.py`, after `_extract_categoria` function (around line 211), add:

```python
def _build_update_query(isbn_list: list[str]) -> str:
    """Construye query GraphQL extendida para update preview (trae todos los campos)."""
    conditions = " OR ".join([f"sku:{isbn} OR barcode:{isbn}" for isbn in isbn_list])
    return """
    {
      productVariants(first: 100, query: "%s") {
        edges {
          node {
            id
            sku
            barcode
            price
            compareAtPrice
            inventoryItem {
              id
              measurement { weight { value unit } }
            }
            product {
              id
              title
              vendor
              descriptionHtml
              images(first: 1) { edges { node { url } } }
              metafields(first: 50) {
                edges {
                  node { namespace key value }
                }
              }
            }
          }
        }
      }
    }
    """ % conditions
```

- [ ] **Step 2: Add fetch_products_for_update function**

After the new query builder, add:

```python
def _extract_metafield(metafields_edges: list, key: str) -> str:
    """Extrae un metafield por key."""
    for meta_edge in metafields_edges:
        meta = meta_edge.get("node", {})
        if meta.get("namespace") == "custom" and meta.get("key") == key:
            valor = meta.get("value", "")
            # Limpiar formato lista JSON
            return (
                valor.replace('["', "").replace('"]', "")
                .replace("[", "").replace("]", "")
                .replace('"', "").strip()
            )
    return ""


def _process_batch_for_update(
    session: requests.Session,
    isbn_batch: list[str],
) -> dict:
    """Procesa un batch de ISBNs para update preview, trayendo todos los campos."""
    graphql_url = settings.get_graphql_url()
    results = {}

    try:
        query = _build_update_query(isbn_batch)
        _throttler.wait_if_needed()
        response = session.post(graphql_url, json={"query": query}, timeout=30)
        _throttler.update_from_response(response)

        if response.status_code == 200:
            data = response.json()
            edges = (
                data.get("data", {})
                .get("productVariants", {})
                .get("edges", [])
            )

            for edge in edges:
                node = edge["node"]
                sku = str(node.get("sku", "")).strip()
                barcode = str(node.get("barcode", "")).strip()

                matched_isbn = None
                for isbn in isbn_batch:
                    if sku == isbn or barcode == isbn:
                        matched_isbn = isbn
                        break

                if matched_isbn and matched_isbn not in results:
                    product = node["product"]
                    metafields = product.get("metafields", {}).get("edges", [])
                    images = product.get("images", {}).get("edges", [])
                    weight_data = (
                        node.get("inventoryItem", {})
                        .get("measurement", {})
                        .get("weight", {})
                    )

                    results[matched_isbn] = {
                        "sku": sku,
                        "product_id": product.get("id", ""),
                        "variant_id": node.get("id", ""),
                        "title": product.get("title", ""),
                        "current": {
                            "Titulo": product.get("title", ""),
                            "Sipnosis": product.get("descriptionHtml", ""),
                            "Vendor": product.get("vendor", ""),
                            "Precio": str(node.get("price", "")),
                            "Precio de comparacion": str(node.get("compareAtPrice", "") or ""),
                            "Portada (URL)": images[0]["node"]["url"] if images else "",
                            "Autor": _extract_metafield(metafields, "autor"),
                            "Editorial": _extract_metafield(metafields, "editorial"),
                            "Idioma": _extract_metafield(metafields, "idioma"),
                            "Formato": _extract_metafield(metafields, "formato"),
                            "Categoria": _extract_metafield(metafields, "categoria"),
                            "Subcategoria": _extract_metafield(metafields, "subcategoria"),
                            "Peso (kg)": str(weight_data.get("value", "")) if weight_data else "",
                        },
                    }
    except Exception as e:
        print(f"[UPDATE PREVIEW] Error: {e}", flush=True)

    return results


def fetch_products_for_update(isbn_list: list[str]) -> dict:
    """
    Busca productos completos en Shopify para preview de actualizacion.
    Retorna dict {isbn: {sku, product_id, variant_id, title, current: {field: value}}}.
    """
    headers = settings.get_shopify_headers()
    batches = list(chunk_list(isbn_list, settings.BATCH_SIZE))
    all_results = {}
    session = requests.Session()
    session.headers.update(headers)

    with ThreadPoolExecutor(max_workers=settings.MAX_WORKERS) as executor:
        futures = {
            executor.submit(_process_batch_for_update, session, batch): i
            for i, batch in enumerate(batches)
        }
        for future in as_completed(futures):
            all_results.update(future.result())

    return all_results
```

- [ ] **Step 3: Verify file parses**

Run: `cd backend && python -c "import ast; ast.parse(open('services/shopify_service.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/services/shopify_service.py
git commit -m "feat(shopify): add fetch_products_for_update with extended GraphQL query"
```

---

## Task 5: Backend — Update Single Product + Batch

**Files:**
- Modify: `backend/services/shopify_service.py`

- [ ] **Step 1: Add mutation constants**

After the existing `_VARIANT_UPDATE_MUTATION` constant (around line 613), add:

```python
_PRODUCT_UPDATE_MUTATION = """
mutation productUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id title }
    userErrors { field message }
  }
}
"""

_PRODUCT_CREATE_MEDIA_MUTATION = """
mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
  productCreateMedia(productId: $productId, media: $media) {
    media { id }
    mediaUserErrors { field message }
  }
}
"""
```

- [ ] **Step 2: Add _update_single_product function**

After `update_products_batch` will go, but first add the single product updater. Place it after the `fetch_products_for_update` function:

```python
_METAFIELD_KEY_MAP = {
    "Autor": ("custom", "autor", "single_line_text_field"),
    "Editorial": ("custom", "editorial", "single_line_text_field"),
    "Idioma": ("custom", "idioma", "list.single_line_text_field"),
    "Formato": ("custom", "formato", "list.single_line_text_field"),
    "Categoria": ("custom", "categoria", "list.single_line_text_field"),
    "Subcategoria": ("custom", "subcategoria", "list.single_line_text_field"),
}

_PRODUCT_FIELDS = {"Titulo", "Sipnosis", "Vendor"}
_VARIANT_FIELDS = {"Precio", "Precio de comparacion", "Peso (kg)"}
_MEDIA_FIELDS = {"Portada (URL)"}
_METAFIELD_FIELDS = set(_METAFIELD_KEY_MAP.keys())


def _update_single_product(
    session: requests.Session,
    product_data: dict,
    changes: dict[str, str],
) -> dict:
    """Actualiza un producto en Shopify. changes = {field_name: new_value}."""
    graphql_url = settings.get_graphql_url()
    sku = product_data["sku"]
    title = product_data["title"]
    product_id = product_data["product_id"]
    variant_id = product_data["variant_id"]
    fields_updated = []

    try:
        # --- Product-level update (title, vendor, description, metafields) ---
        product_input: dict = {"id": product_id}
        has_product_update = False

        if "Titulo" in changes:
            product_input["title"] = changes["Titulo"]
            has_product_update = True

        if "Sipnosis" in changes:
            product_input["descriptionHtml"] = changes["Sipnosis"]
            has_product_update = True

        if "Vendor" in changes:
            product_input["vendor"] = changes["Vendor"]
            has_product_update = True

        # Metafields
        metafields = []
        for field_name, (ns, key, mtype) in _METAFIELD_KEY_MAP.items():
            if field_name in changes:
                val = changes[field_name]
                if mtype.startswith("list.") and not val.startswith("["):
                    val = json.dumps([val])
                metafields.append({
                    "namespace": ns, "key": key, "value": val, "type": mtype,
                })

        if metafields:
            product_input["metafields"] = metafields
            has_product_update = True

        if has_product_update:
            for attempt in range(_MAX_RETRIES):
                _throttler.wait_if_needed()
                resp = session.post(
                    graphql_url,
                    json={"query": _PRODUCT_UPDATE_MUTATION, "variables": {"input": product_input}},
                    timeout=30,
                )
                _throttler.update_from_response(resp)
                if resp.status_code == 429:
                    time.sleep(_throttler.handle_429(resp))
                    continue
                break

            if resp.status_code == 200:
                data = resp.json()
                user_errors = data.get("data", {}).get("productUpdate", {}).get("userErrors", [])
                if user_errors:
                    error_msg = "; ".join(e.get("message", "") for e in user_errors)
                    return {"sku": sku, "title": title, "success": False, "error": error_msg}
                fields_updated.extend(
                    [f for f in changes if f in _PRODUCT_FIELDS or f in _METAFIELD_FIELDS]
                )
            else:
                return {"sku": sku, "title": title, "success": False, "error": f"HTTP {resp.status_code}"}

        # --- Variant-level update (price, compareAtPrice, weight) ---
        variant_changes = {f: changes[f] for f in _VARIANT_FIELDS if f in changes}
        if variant_changes:
            variant_input: dict = {"id": variant_id}

            if "Precio" in variant_changes:
                variant_input["price"] = str(variant_changes["Precio"])
            if "Precio de comparacion" in variant_changes:
                variant_input["compareAtPrice"] = str(variant_changes["Precio de comparacion"])
            if "Peso (kg)" in variant_changes:
                inv_item: dict = {}
                inv_item["measurement"] = {
                    "weight": {"value": float(variant_changes["Peso (kg)"]), "unit": "KILOGRAMS"}
                }
                variant_input["inventoryItem"] = inv_item

            for attempt in range(_MAX_RETRIES):
                _throttler.wait_if_needed()
                resp = session.post(
                    graphql_url,
                    json={
                        "query": _VARIANT_UPDATE_MUTATION,
                        "variables": {"productId": product_id, "variants": [variant_input]},
                    },
                    timeout=30,
                )
                _throttler.update_from_response(resp)
                if resp.status_code == 429:
                    time.sleep(_throttler.handle_429(resp))
                    continue
                break

            if resp.status_code == 200:
                data = resp.json()
                user_errors = (
                    data.get("data", {})
                    .get("productVariantsBulkUpdate", {})
                    .get("userErrors", [])
                )
                if user_errors:
                    error_msg = "; ".join(e.get("message", "") for e in user_errors)
                    return {"sku": sku, "title": title, "success": False, "error": error_msg}
                fields_updated.extend([f for f in variant_changes])
            else:
                return {"sku": sku, "title": title, "success": False, "error": f"HTTP {resp.status_code}"}

        # --- Media update (image) ---
        if "Portada (URL)" in changes:
            img_url = changes["Portada (URL)"]
            if _is_valid_image_url(img_url):
                for attempt in range(_MAX_RETRIES):
                    _throttler.wait_if_needed()
                    resp = session.post(
                        graphql_url,
                        json={
                            "query": _PRODUCT_CREATE_MEDIA_MUTATION,
                            "variables": {
                                "productId": product_id,
                                "media": [{"originalSource": img_url, "alt": f"Libro {title} {sku}", "mediaContentType": "IMAGE"}],
                            },
                        },
                        timeout=30,
                    )
                    _throttler.update_from_response(resp)
                    if resp.status_code == 429:
                        time.sleep(_throttler.handle_429(resp))
                        continue
                    break
                fields_updated.append("Portada (URL)")

        return {
            "sku": sku,
            "title": title,
            "success": True,
            "fields_updated": fields_updated,
        }

    except Exception as e:
        return {"sku": sku, "title": title, "success": False, "error": str(e)}
```

- [ ] **Step 3: Add update_products_batch function**

After `_update_single_product`:

```python
def update_products_batch(
    products_data: list[dict],
    changes_per_product: list[dict],
) -> list[dict]:
    """
    Actualiza productos en Shopify con concurrencia.
    products_data: lista de dicts con {sku, product_id, variant_id, title}
    changes_per_product: lista de dicts con {field: new_value} (mismos indices que products_data)
    """
    headers = settings.get_shopify_headers()
    session = requests.Session()
    session.headers.update(headers)

    results = []
    with ThreadPoolExecutor(max_workers=settings.MAX_WORKERS) as executor:
        futures = {
            executor.submit(_update_single_product, session, prod, chg): i
            for i, (prod, chg) in enumerate(zip(products_data, changes_per_product))
        }
        for future in as_completed(futures):
            results.append(future.result())

    results.sort(key=lambda r: r.get("sku", ""))
    return results
```

- [ ] **Step 4: Verify file parses**

Run: `cd backend && python -c "import ast; ast.parse(open('services/shopify_service.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/services/shopify_service.py
git commit -m "feat(shopify): add update_single_product and update_products_batch"
```

---

## Task 6: Backend — Preview and Apply Endpoints

**Files:**
- Modify: `backend/routers/ingreso.py`

- [ ] **Step 1: Add the preview endpoint**

At the end of `backend/routers/ingreso.py` (before the helpers section, or at the very end), add:

```python
# ---------------------------------------------------------------------------
# Actualizar Productos
# ---------------------------------------------------------------------------

_UPDATE_DATA_COLUMNS = {
    "Titulo", "Sipnosis", "Vendor", "Precio", "Precio de comparacion",
    "Portada (URL)", "Autor", "Editorial", "Idioma", "Formato",
    "Categoria", "Subcategoria", "Peso (kg)",
}


async def _parse_update_excel(file: UploadFile) -> tuple[list[dict], list[str]]:
    """Lee Excel de actualizacion. Retorna (rows, data_columns_present)."""
    content = await file.read()
    try:
        df = pd.read_excel(BytesIO(content), sheet_name="Products")
    except Exception:
        df = pd.read_excel(BytesIO(content))

    df.columns = [str(c).strip() for c in df.columns]

    has_sku = "SKU" in df.columns
    has_id = "ID" in df.columns
    if not has_sku and not has_id:
        raise HTTPException(status_code=400, detail='Se requiere columna "SKU" o "ID"')

    data_cols = [c for c in df.columns if c in _UPDATE_DATA_COLUMNS]
    if not data_cols:
        raise HTTPException(status_code=400, detail="No se encontraron columnas de datos a actualizar")

    rows = []
    for _, row in df.iterrows():
        item = {}
        if has_sku:
            raw = row["SKU"]
            item["SKU"] = str(int(raw)) if isinstance(raw, float) else str(raw).strip()
        if has_id:
            raw = row.get("ID", "")
            item["ID"] = str(int(raw)) if isinstance(raw, float) else str(raw).strip()

        for col in data_cols:
            val = row.get(col)
            if pd.notna(val) and str(val).strip():
                item[col] = str(val).strip()

        rows.append(item)

    return rows, data_cols


@router.post("/productos/actualizar/preview")
async def preview_update_products(file: UploadFile = File(...)):
    """
    Sube Excel con SKU/ID + columnas a actualizar.
    Retorna preview con diff (valor actual vs nuevo) por producto.
    """
    rows, data_cols = await _parse_update_excel(file)

    # Extraer identificadores
    isbn_list = []
    for r in rows:
        identifier = r.get("SKU") or r.get("ID", "")
        if identifier:
            isbn_list.append(identifier)

    if not isbn_list:
        raise HTTPException(status_code=400, detail="No se encontraron identificadores validos")

    import asyncio
    loop = asyncio.get_event_loop()
    products = await loop.run_in_executor(
        None, shopify_service.fetch_products_for_update, isbn_list
    )

    preview = []
    not_found_skus = []
    changes_count = 0
    no_changes_count = 0

    for r in rows:
        identifier = r.get("SKU") or r.get("ID", "")
        product = products.get(identifier)

        if not product:
            not_found_skus.append(identifier)
            continue

        fields = []
        for col in data_cols:
            new_val = r.get(col)
            if new_val is None:
                continue
            current_val = product["current"].get(col, "")
            if str(new_val) != str(current_val):
                fields.append({
                    "field": col,
                    "current": str(current_val),
                    "new": str(new_val),
                })

        if fields:
            changes_count += 1
            preview.append({
                "sku": product["sku"],
                "title": product["title"],
                "product_id": product["product_id"],
                "variant_id": product["variant_id"],
                "fields": fields,
            })
        else:
            no_changes_count += 1

    return {
        "total": len(isbn_list),
        "found": len(isbn_list) - len(not_found_skus),
        "not_found": len(not_found_skus),
        "changes": changes_count,
        "no_changes": no_changes_count,
        "preview": preview,
        "not_found_skus": not_found_skus,
    }


@router.post("/productos/actualizar/apply")
async def apply_update_products(file: UploadFile = File(...)):
    """
    Sube Excel con SKU/ID + columnas a actualizar.
    Aplica los cambios en Shopify y retorna resultados.
    """
    rows, data_cols = await _parse_update_excel(file)

    isbn_list = []
    for r in rows:
        identifier = r.get("SKU") or r.get("ID", "")
        if identifier:
            isbn_list.append(identifier)

    if not isbn_list:
        raise HTTPException(status_code=400, detail="No se encontraron identificadores validos")

    import asyncio
    loop = asyncio.get_event_loop()
    products = await loop.run_in_executor(
        None, shopify_service.fetch_products_for_update, isbn_list
    )

    # Build lists of products and their changes
    products_to_update = []
    changes_to_apply = []

    for r in rows:
        identifier = r.get("SKU") or r.get("ID", "")
        product = products.get(identifier)
        if not product:
            continue

        changes = {}
        for col in data_cols:
            new_val = r.get(col)
            if new_val is None:
                continue
            current_val = product["current"].get(col, "")
            if str(new_val) != str(current_val):
                changes[col] = new_val

        if changes:
            products_to_update.append(product)
            changes_to_apply.append(changes)

    if not products_to_update:
        return {"total": 0, "updated": 0, "failed": 0, "results": []}

    results = await loop.run_in_executor(
        None, shopify_service.update_products_batch, products_to_update, changes_to_apply
    )

    updated = sum(1 for r in results if r["success"])
    failed = sum(1 for r in results if not r["success"])

    return {
        "total": len(results),
        "updated": updated,
        "failed": failed,
        "results": results,
    }
```

- [ ] **Step 2: Verify file parses**

Run: `cd backend && python -c "import ast; ast.parse(open('routers/ingreso.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/routers/ingreso.py
git commit -m "feat(ingreso): add preview and apply endpoints for product updates"
```

---

## Task 7: Frontend API + Hooks

**Files:**
- Modify: `src/pages/ingreso/api.ts`
- Modify: `src/pages/ingreso/hooks.ts`

- [ ] **Step 1: Add API functions**

At the end of `src/pages/ingreso/api.ts`, before the Helpers section, add:

```typescript
// ---------------------------------------------------------------------------
// Actualizar Productos
// ---------------------------------------------------------------------------

export async function previewUpdateProducts(
  file: File,
): Promise<UpdatePreviewResponse> {
  const form = new FormData();
  form.append("file", file);
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/ingreso/productos/actualizar/preview`, {
      method: "POST",
      body: form,
    }),
  );
}

export async function applyUpdateProducts(
  file: File,
): Promise<UpdateApplyResponse> {
  const form = new FormData();
  form.append("file", file);
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/ingreso/productos/actualizar/apply`, {
      method: "POST",
      body: form,
    }),
  );
}
```

Also add the imports at the top of the file, in the type imports from `./types`:

```typescript
import {
  API_BASE,
  type ProductSearchResult,
  type LocationItem,
  type SalesLoadResponse,
  type SalesStatusResponse,
  type ShopifyCreateResponse,
  type UpdatePreviewResponse,
  type UpdateApplyResponse,
} from "./types";
```

- [ ] **Step 2: Add hooks**

At the end of `src/pages/ingreso/hooks.ts`, add:

```typescript
export function usePreviewUpdate() {
  return useMutation({
    mutationFn: (file: File) => previewUpdateProducts(file),
  });
}

export function useApplyUpdate() {
  return useMutation({
    mutationFn: (file: File) => applyUpdateProducts(file),
  });
}
```

Also add to the imports at the top:

```typescript
import {
  healthCheck,
  searchByIsbn,
  searchByExcel,
  getLocations,
  loadSales,
  getSalesStatus,
  inventoryExcel,
  processCreateProducts,
  createProductsInShopify,
  downloadBlob,
  previewUpdateProducts,
  applyUpdateProducts,
} from "./api";
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/pages/ingreso/api.ts src/pages/ingreso/hooks.ts
git commit -m "feat(ingreso): add API functions and hooks for product updates"
```

---

## Task 8: Frontend — ActualizarProductos Page

**Files:**
- Create: `src/pages/ActualizarProductos.tsx`

- [ ] **Step 1: Create the page**

Create `src/pages/ActualizarProductos.tsx`:

```typescript
import { useState } from "react";
import {
  AlertCircle,
  RefreshCw,
  Download,
  Loader2,
  Search,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import FileUploadZone from "./ingreso/FileUploadZone";
import {
  useHealthCheck,
  usePreviewUpdate,
  useApplyUpdate,
} from "./ingreso/hooks";
import { downloadTemplate, downloadBlob } from "./ingreso/api";
import { validateUpdateFile, type ValidationError } from "./ingreso/validation";
import type {
  UpdatePreviewResponse,
  UpdateApplyResponse,
} from "./ingreso/types";
import * as XLSX from "xlsx";

interface PreviewRow {
  [key: string]: unknown;
}

export default function ActualizarProductos() {
  const health = useHealthCheck();
  const previewMutation = usePreviewUpdate();
  const applyMutation = useApplyUpdate();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [previewResult, setPreviewResult] = useState<UpdatePreviewResponse | null>(null);
  const [applyResult, setApplyResult] = useState<UpdateApplyResponse | null>(null);

  const handleFileSelected = (f: File) => {
    setFile(f);
    previewMutation.reset();
    applyMutation.reset();
    setPreviewResult(null);
    setApplyResult(null);
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
        setValidationErrors(validateUpdateFile(json, cols));
      } catch {
        setPreview([]);
        setColumns([]);
        setTotalRows(0);
        setValidationErrors([]);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await downloadTemplate("actualizacion");
      downloadBlob(blob, "Actualizacion_productos.xlsx");
      toast.success("Plantilla descargada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al descargar plantilla");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handlePreview = () => {
    if (!file) return;
    setPreviewResult(null);
    setApplyResult(null);
    applyMutation.reset();
    previewMutation.mutate(file, {
      onSuccess: (data) => {
        setPreviewResult(data);
        if (data.changes > 0) {
          toast.success(`${data.changes} producto${data.changes !== 1 ? "s" : ""} con cambios detectados`);
        } else {
          toast.info("No se detectaron cambios");
        }
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Error al consultar cambios");
      },
    });
  };

  const handleApply = () => {
    if (!file) return;
    setApplyResult(null);
    applyMutation.mutate(file, {
      onSuccess: (data) => {
        setApplyResult(data);
        const parts: string[] = [];
        if (data.updated > 0) parts.push(`${data.updated} actualizado${data.updated !== 1 ? "s" : ""}`);
        if (data.failed > 0) parts.push(`${data.failed} con errores`);
        const msg = parts.join(", ");
        if (data.failed > 0) {
          toast.warning(msg);
        } else if (data.updated === 0) {
          toast.info("No se aplicaron cambios");
        } else {
          toast.success(msg);
        }
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Error al aplicar cambios");
      },
    });
  };

  if (health.isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-5 w-96" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (health.isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Actualizar Productos</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Actualiza productos existentes en Shopify masivamente
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error de conexión</AlertTitle>
          <AlertDescription className="flex items-center gap-3">
            No se pudo conectar con el servidor.
            <Button variant="outline" size="sm" onClick={() => health.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold">Actualizar Productos</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Actualiza productos existentes en Shopify masivamente
        </p>
      </div>

      {/* Paso 1: Descargar Plantilla */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Paso 1 — Descargar Plantilla</CardTitle>
          <CardDescription>
            Descarga la plantilla Excel, llénala solo con las columnas que necesitas
            actualizar (SKU o ID es obligatorio).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleDownloadTemplate} disabled={downloadingTemplate}>
            {downloadingTemplate ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Descargar Plantilla
          </Button>
        </CardContent>
      </Card>

      {/* Paso 2: Subir Archivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Paso 2 — Subir Archivo</CardTitle>
          <CardDescription>
            Sube el archivo Excel con SKU o ID + solo las columnas a actualizar.
            Las columnas no incluidas no se modificarán.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUploadZone
            title="Archivo de Actualización"
            hint="Arrastra o haz clic para seleccionar un archivo .xlsx"
            fileName={file?.name}
            isLoaded={!!file}
            onFileSelected={handleFileSelected}
          />

          {file && totalRows > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">
                  {totalRows} producto{totalRows !== 1 && "s"}
                </Badge>
                <Badge variant="outline">{columns.length} columnas</Badge>
                {validationErrors.length === 0 && (
                  <Badge className="bg-green-600 text-white hover:bg-green-700">
                    Archivo válido
                  </Badge>
                )}
              </div>

              <ScrollArea className="w-full rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((col) => (
                        <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i}>
                        {columns.map((col) => (
                          <TableCell key={col} className="whitespace-nowrap max-w-[200px] truncate">
                            {row[col] != null ? String(row[col]) : ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
              {totalRows > 5 && (
                <p className="text-xs text-muted-foreground">Mostrando 5 de {totalRows} filas</p>
              )}

              {validationErrors.length > 0 && (
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
                      <p className="mt-1 text-xs">...y {validationErrors.length - 20} errores más</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paso 3: Vista Previa de Cambios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Paso 3 — Vista Previa de Cambios</CardTitle>
          <CardDescription>
            Consulta los datos actuales en Shopify y compáralos con los nuevos valores
            antes de aplicar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handlePreview}
            disabled={!file || validationErrors.length > 0 || previewMutation.isPending}
          >
            {previewMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Consultar Cambios
          </Button>

          {previewMutation.isPending && (
            <div className="space-y-2">
              <Progress value={undefined} className="h-2" />
              <p className="text-sm text-muted-foreground">Consultando productos en Shopify...</p>
            </div>
          )}

          {previewMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {previewMutation.error instanceof Error ? previewMutation.error.message : "Error al consultar"}
              </AlertDescription>
            </Alert>
          )}

          {previewResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary">{previewResult.found} encontrado{previewResult.found !== 1 && "s"}</Badge>
                {previewResult.not_found > 0 && (
                  <Badge variant="destructive">{previewResult.not_found} no encontrado{previewResult.not_found !== 1 && "s"}</Badge>
                )}
                <Badge variant={previewResult.changes > 0 ? "default" : "outline"}>
                  {previewResult.changes} con cambios
                </Badge>
                {previewResult.no_changes > 0 && (
                  <Badge variant="outline">{previewResult.no_changes} sin cambios</Badge>
                )}
              </div>

              {previewResult.not_found_skus.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Productos no encontrados</AlertTitle>
                  <AlertDescription>
                    SKUs no encontrados en Shopify: {previewResult.not_found_skus.join(", ")}
                  </AlertDescription>
                </Alert>
              )}

              {previewResult.preview.length > 0 && (
                <ScrollArea className="w-full max-h-[400px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">SKU</TableHead>
                        <TableHead className="whitespace-nowrap">Título</TableHead>
                        <TableHead className="whitespace-nowrap">Campo</TableHead>
                        <TableHead className="whitespace-nowrap">Valor Actual</TableHead>
                        <TableHead className="whitespace-nowrap">
                          <ArrowRight className="inline h-3 w-3 mr-1" />
                          Valor Nuevo
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewResult.preview.flatMap((product) =>
                        product.fields.map((field, fi) => (
                          <TableRow key={`${product.sku}-${fi}`}>
                            {fi === 0 ? (
                              <>
                                <TableCell rowSpan={product.fields.length} className="font-mono text-sm align-top">
                                  {product.sku}
                                </TableCell>
                                <TableCell rowSpan={product.fields.length} className="max-w-[200px] truncate align-top">
                                  {product.title}
                                </TableCell>
                              </>
                            ) : null}
                            <TableCell className="font-medium">{field.field}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground">
                              {field.current || <span className="italic">vacío</span>}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate font-medium text-green-600 dark:text-green-400">
                              {field.new}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paso 4: Aplicar en Shopify */}
      <Card className={!previewResult || previewResult.changes === 0 ? "opacity-50 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="text-lg">Paso 4 — Aplicar en Shopify</CardTitle>
          <CardDescription>
            {previewResult && previewResult.changes > 0
              ? `${previewResult.changes} producto${previewResult.changes !== 1 ? "s" : ""} será${previewResult.changes !== 1 ? "n" : ""} actualizado${previewResult.changes !== 1 ? "s" : ""} en Shopify.`
              : "Primero consulta los cambios en el paso 3."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleApply}
            disabled={!file || !previewResult || previewResult.changes === 0 || applyMutation.isPending}
          >
            {applyMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="mr-2 h-4 w-4" />
            )}
            {applyMutation.isPending ? "Aplicando cambios..." : "Aplicar Cambios"}
          </Button>

          {applyMutation.isPending && (
            <div className="space-y-2">
              <Progress value={undefined} className="h-2" />
              <p className="text-sm text-muted-foreground">Actualizando productos en Shopify...</p>
            </div>
          )}

          {applyMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {applyMutation.error instanceof Error ? applyMutation.error.message : "Error al aplicar cambios"}
              </AlertDescription>
            </Alert>
          )}

          {applyResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={applyResult.failed === 0 ? "default" : "secondary"}>
                  {applyResult.updated} actualizado{applyResult.updated !== 1 && "s"}
                </Badge>
                {applyResult.failed > 0 && (
                  <Badge variant="destructive">{applyResult.failed} con errores</Badge>
                )}
                <Badge variant="outline">{applyResult.total} total</Badge>
              </div>

              <ScrollArea className="w-full max-h-[400px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Estado</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applyResult.results.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {r.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{r.sku}</TableCell>
                        <TableCell className="max-w-[250px] truncate">{r.title}</TableCell>
                        <TableCell className="max-w-[300px] text-sm text-muted-foreground truncate">
                          {r.success
                            ? (r.fields_updated ?? []).join(", ")
                            : r.error}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds (page won't be routed yet but should compile)

- [ ] **Step 3: Commit**

```bash
git add src/pages/ActualizarProductos.tsx
git commit -m "feat(ingreso): add ActualizarProductos page with 4-step wizard"
```

---

## Task 9: Register Route and Permissions

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/hooks/useNavigationPermissions.ts`

- [ ] **Step 1: Add lazy import in App.tsx**

In `src/App.tsx`, after the `CrearProductos` lazy import (around line 27), add:

```typescript
const ActualizarProductos = lazyWithReload(() => import("./pages/ActualizarProductos"));
```

- [ ] **Step 2: Add route in App.tsx**

After the `/crear-productos` route (around line 92), add:

```typescript
                              <Route path="/actualizar-productos" element={<ActualizarProductos />} />
```

- [ ] **Step 3: Add to WORKFLOW_SUB_PATHS**

In `src/hooks/useNavigationPermissions.ts`, find the `WORKFLOW_SUB_PATHS` array (line 15):

```typescript
const WORKFLOW_SUB_PATHS = ["/ingreso", "/crear-productos", "/scrap", "/cortes", "/envio-cortes", "/devoluciones", "/corte-penguin", "/corte-planeta", "/corte-museo"];
```

Add `/actualizar-productos` after `/crear-productos`:

```typescript
const WORKFLOW_SUB_PATHS = ["/ingreso", "/crear-productos", "/actualizar-productos", "/scrap", "/cortes", "/envio-cortes", "/devoluciones", "/corte-penguin", "/corte-planeta", "/corte-museo"];
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/hooks/useNavigationPermissions.ts
git commit -m "feat(ingreso): register ActualizarProductos route and permissions"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (including new validateUpdateFile tests)

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Verify backend syntax**

Run: `cd backend && python -c "import ast; ast.parse(open('services/shopify_service.py').read()); ast.parse(open('routers/ingreso.py').read()); print('ALL OK')"`
Expected: `ALL OK`
