# Mejoras Alta Prioridad — Ingresos Workflow

**Fecha:** 2026-03-28
**Alcance:** 3 mejoras de prioridad alta para la sección de Ingreso Mercancía / Crear Productos

## Contexto

La sección de Ingresos en Workflow tiene dos páginas principales:
- **Ingreso Mercancía** (`IngresoMercancia.tsx`): consulta de productos, inventario multi-bodega, plantillas
- **Crear Productos** (`CrearProductos.tsx`): flujo de 4 pasos para crear productos en Shopify desde Excel

El backend FastAPI (`routers/ingreso.py`) se comunica con Shopify vía GraphQL y REST (`services/shopify_service.py`). La creación masiva usa `ThreadPoolExecutor` con concurrencia sin control de rate limits, sin detección de duplicados, y sin validación previa en frontend.

## Mejora 1 — Auto-saltar duplicados

### Decisión de diseño
Cuando un SKU ya existe en Shopify, se salta automáticamente y se reporta como "skipped". No se bloquea el lote ni se pregunta al usuario.

### Flujo
1. El usuario llega al Paso 4 ("Crear en Shopify") y hace clic
2. El backend recibe el archivo, procesa las filas
3. **Antes de crear**, ejecuta búsqueda batch de todos los SKUs contra Shopify GraphQL
4. SKUs existentes se marcan como `skipped` con motivo "SKU ya existe en Shopify"
5. Solo se crean los productos nuevos
6. La respuesta incluye 3 contadores: `created`, `skipped`, `failed`
7. El frontend muestra tabla con 3 iconos: check verde (creado), flecha amarilla (saltado), X roja (error)

### Cambios backend — `shopify_service.py`

Nueva función:

```python
def check_existing_skus(skus: list[str]) -> set[str]:
    """Busca SKUs en Shopify y retorna el set de los que ya existen."""
```

- Usa query GraphQL batch: `productVariants(first: 100, query: "sku:X OR sku:Y...")`
- Procesa en chunks del mismo `BATCH_SIZE` existente
- Usa `ThreadPoolExecutor` para paralelizar chunks
- Retorna `set[str]` con SKUs encontrados

Modificación en `create_products_batch()`:

```python
def create_products_batch(rows: list[dict]) -> list[dict]:
    # 1. Extraer todos los SKUs
    all_skus = [str(r.get("Variant SKU", "")) for r in rows]

    # 2. Buscar cuáles ya existen
    existing = check_existing_skus(all_skus)

    # 3. Separar filas nuevas vs existentes
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

    # 4. Crear solo los nuevos (lógica existente)
    # ... ThreadPoolExecutor con new_rows ...

    # 5. Combinar resultados
    return results  # skipped + created + failed
```

### Cambios backend — `ingreso.py`

En el endpoint `/productos/shopify`, agregar `skipped` al response:

```python
skipped = sum(1 for r in results if r.get("skipped"))
return {
    "total": len(results),
    "created": created,
    "skipped": skipped,
    "failed": failed,
    "results": results,
}
```

### Cambios frontend — `types.ts`

```typescript
export interface ShopifyCreateResult {
  sku: string;
  title: string;
  success: boolean;
  skipped?: boolean;  // nuevo
  error?: string;
  shopify_id?: string;
}

export interface ShopifyCreateResponse {
  total: number;
  created: number;
  skipped: number;  // nuevo
  failed: number;
  results: ShopifyCreateResult[];
}
```

### Cambios frontend — `CrearProductos.tsx`

- Badge amarillo para `skipped` junto a los de created/failed
- En la tabla de resultados, icono `SkipForward` (lucide) amarillo para items con `skipped: true`
- Mensaje toast ajustado: `"5 creados, 3 saltados (ya existían), 1 con errores"`

---

## Mejora 2 — Validacion inmediata al subir

### Decisión de diseño
La validación se ejecuta en el frontend inmediatamente al seleccionar el archivo, sin llamada al backend. Si hay errores, el botón "Procesar" se deshabilita.

### Validaciones

| Validación | Tipo | Mensaje de error |
|---|---|---|
| Columna `Titulo` presente | Columna obligatoria | `Columna "Titulo" no encontrada` |
| Columna `SKU` presente | Columna obligatoria | `Columna "SKU" no encontrada` |
| Columna `Vendor` presente | Columna obligatoria | `Columna "Vendor" no encontrada` |
| SKU no vacío por fila | Campo obligatorio | `Fila {n}: SKU vacío` |
| Titulo no vacío por fila | Campo obligatorio | `Fila {n}: Titulo vacío` |
| Vendor no vacío por fila | Campo obligatorio | `Fila {n}: Vendor vacío` |
| SKUs sin duplicados internos | Integridad | `Fila {n}: SKU "{sku}" duplicado (ya aparece en fila {m})` |
| Precio numérico > 0 (si existe) | Formato | `Fila {n}: Precio inválido "{val}"` |
| URL de portada válida (si existe) | Formato | `Fila {n}: URL de portada inválida` |

### Nuevo archivo: `src/pages/ingreso/validation.ts`

```typescript
export interface ValidationError {
  row?: number;      // número de fila (1-based, undefined si es error de columna)
  field: string;     // nombre del campo
  message: string;   // mensaje legible
}

export function validateProductFile(
  rows: Record<string, unknown>[],
  columns: string[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Columnas obligatorias
  for (const col of ["Titulo", "SKU", "Vendor"]) {
    if (!columns.includes(col)) {
      errors.push({ field: col, message: `Columna "${col}" no encontrada` });
    }
  }
  if (errors.length > 0) return errors; // sin columnas, no validar filas

  // 2. Campos obligatorios por fila
  const skuSeen = new Map<string, number>(); // sku -> primera fila

  rows.forEach((row, i) => {
    const rowNum = i + 2; // +2 porque fila 1 es header

    const titulo = String(row["Titulo"] ?? "").trim();
    if (!titulo) errors.push({ row: rowNum, field: "Titulo", message: `Fila ${rowNum}: Titulo vacío` });

    const sku = String(row["SKU"] ?? "").trim().replace(".0", "");
    if (!sku) {
      errors.push({ row: rowNum, field: "SKU", message: `Fila ${rowNum}: SKU vacío` });
    } else {
      const firstRow = skuSeen.get(sku);
      if (firstRow !== undefined) {
        errors.push({ row: rowNum, field: "SKU", message: `Fila ${rowNum}: SKU "${sku}" duplicado (ya en fila ${firstRow})` });
      } else {
        skuSeen.set(sku, rowNum);
      }
    }

    const vendor = String(row["Vendor"] ?? "").trim();
    if (!vendor) errors.push({ row: rowNum, field: "Vendor", message: `Fila ${rowNum}: Vendor vacío` });

    // Precio (opcional)
    if ("Precio" in row && row["Precio"] != null && String(row["Precio"]).trim() !== "") {
      const precio = Number(row["Precio"]);
      if (isNaN(precio) || precio <= 0) {
        errors.push({ row: rowNum, field: "Precio", message: `Fila ${rowNum}: Precio inválido "${row["Precio"]}"` });
      }
    }

    // URL portada (opcional)
    if ("Portada (URL)" in row && row["Portada (URL)"] != null) {
      const url = String(row["Portada (URL)"]).trim();
      if (url && !/^https?:\/\/.+/i.test(url)) {
        errors.push({ row: rowNum, field: "Portada (URL)", message: `Fila ${rowNum}: URL de portada inválida` });
      }
    }
  });

  return errors;
}
```

### Cambios en `CrearProductos.tsx`

- Nuevo estado: `const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])`
- En `handleFileSelected`, después del parse XLSX, llamar `validateProductFile(json, columns)` y guardar resultado
- Si `validationErrors.length > 0`:
  - Mostrar `Alert` destructive debajo del preview con resumen: `"{n} errores encontrados"`
  - Lista de errores (máximo 20 visibles, con "y {n} más..." si hay más)
  - Botón "Procesar" deshabilitado con tooltip
- Si `validationErrors.length === 0`:
  - Mostrar badge verde `"Archivo válido"` junto a los badges de conteo
  - Botón "Procesar" habilitado

---

## Mejora 3 — Throttling con backoff reactivo

### Decisión de diseño
Mantener concurrencia actual con `ThreadPoolExecutor` pero introducir un `ShopifyThrottler` thread-safe que regule la velocidad basándose en los headers de rate limit de Shopify.

### Nueva clase: `ShopifyThrottler`

Ubicación: `shopify_service.py` (dentro del mismo archivo, ya que es la única consumidora).

```python
import threading
import time

class ShopifyThrottler:
    """Rate limiter reactivo para la API de Shopify."""

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
            used, total = limit_header.split("/")
            with self._lock:
                self._available_ratio = 1.0 - (int(used) / int(total))
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
        """Bloquea si la cuota está baja. Llamar ANTES de cada request."""
        with self._lock:
            ratio = self._available_ratio

        if ratio < self._critical_threshold:
            time.sleep(1.0)
        elif ratio < self._low_threshold:
            time.sleep(0.5)

    def handle_429(self, response: requests.Response) -> float:
        """Retorna segundos a esperar ante un 429. Leer Retry-After si existe."""
        retry_after = response.headers.get("Retry-After")
        if retry_after:
            try:
                return float(retry_after)
            except ValueError:
                pass
        return 2.0
```

### Integración en `_create_single_product`

```python
# Instancia global del throttler (una por proceso)
_throttler = ShopifyThrottler()
MAX_RETRIES = 3

def _create_single_product(session, row):
    sku = str(row.get("Variant SKU", "???"))
    title = str(row.get("Title", "???"))

    for attempt in range(MAX_RETRIES):
        _throttler.wait_if_needed()

        response = session.post(graphql_url, json={...}, timeout=30)
        _throttler.update_from_response(response)

        if response.status_code == 429:
            wait = _throttler.handle_429(response)
            print(f"[THROTTLE] 429 for SKU {sku}, waiting {wait}s (attempt {attempt+1})")
            time.sleep(wait)
            continue

        if response.status_code == 200:
            # ... procesar respuesta normal (lógica existente) ...
            break

        return {"sku": sku, "title": title, "success": False, "error": f"HTTP {response.status_code}"}

    # ... lógica existente para paso 2 (variant update) con mismo patrón ...
```

### Integración en queries batch existentes

El mismo `_throttler` global se usa en `process_batch_info` y `process_batch_inventory` para proteger también las consultas de búsqueda e inventario:

```python
_throttler.wait_if_needed()
response = session.post(graphql_url, json={"query": query}, timeout=30)
_throttler.update_from_response(response)
```

### Sin cambios en frontend ni API
Esta mejora es completamente transparente. Ni la API ni el frontend cambian.

---

## Archivos afectados (resumen)

| Archivo | Cambio |
|---|---|
| `backend/services/shopify_service.py` | `ShopifyThrottler` class, `check_existing_skus()`, throttle en `_create_single_product`, throttle en batch queries |
| `backend/routers/ingreso.py` | Campo `skipped` en response de `/productos/shopify` |
| `src/pages/ingreso/validation.ts` | **Nuevo** — función `validateProductFile` |
| `src/pages/ingreso/types.ts` | `skipped` en `ShopifyCreateResult`, `skipped` en `ShopifyCreateResponse` |
| `src/pages/CrearProductos.tsx` | Estado `validationErrors`, UI de errores, badge/icono de skipped |

## Fuera de alcance
- Flujo de actualización de productos (mejora #4, prioridad media)
- Progreso en tiempo real con SSE (mejora #5, prioridad media)
- Asignación de inventario inicial (mejora #6, prioridad media)
- Cualquier cambio en Ingreso Mercancía (ConsultaProductosTab, InventarioMultiBodegaTab)
