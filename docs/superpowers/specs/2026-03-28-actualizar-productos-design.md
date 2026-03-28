# Flujo de Actualizar Productos — Design Spec

**Fecha:** 2026-03-28
**Alcance:** Nueva pagina "Actualizar Productos" dentro de Workflow > Ingresos para actualizar productos existentes en Shopify masivamente via Excel.

## Contexto

Actualmente solo existe el flujo de **crear** productos. Para actualizar campos (precios, vendor, categoria, metafields, etc.) se usa Matrixify de forma externa. Esta feature trae esa capacidad dentro de BukzBrain.

Existe una plantilla `Plantilla_Actualizacion_Productos.xlsx` que se descarga desde la tab Plantillas, pero no tiene backend ni UI que la procese.

## Decisiones de diseno

- **Identificacion:** Por Variant SKU o Product ID (el que este disponible en el Excel)
- **Campos vacios:** No tocar. Solo se actualizan columnas presentes en el Excel con valor no vacio
- **Columnas flexibles:** El usuario sube SKU/ID + solo las columnas que quiere actualizar. No necesita las 15 columnas
- **Ubicacion UI:** Pagina independiente `/actualizar-productos` dentro de Workflow > Ingresos
- **Vista previa de cambios:** Antes de aplicar, el sistema muestra un diff (actual vs nuevo) para que el usuario confirme

## Flujo de usuario (4 pasos)

### Paso 1 — Descargar Plantilla
Descarga la plantilla de actualizacion existente (`Plantilla_Actualizacion_Productos.xlsx`). Ya existe el endpoint `/api/ingreso/templates/actualizacion`.

### Paso 2 — Subir Archivo
- El usuario arrastra/selecciona un Excel con SKU o ID + columnas a modificar
- Validacion inmediata al subir (reutiliza patron de `validateProductFile`):
  - Al menos una columna identificadora: `SKU` o `ID`
  - Al menos una columna de datos a actualizar (cualquiera de las 13 soportadas)
  - Valores de precio numericos positivos (si columna presente)
  - URLs validas en Portada (si columna presente)
  - SKUs/IDs no vacios y sin duplicados internos
- Preview de las primeras 5 filas
- Badge verde "Archivo valido" o Alert rojo con errores

### Paso 3 — Vista Previa de Cambios
- El usuario hace clic en "Consultar Cambios"
- El backend recibe el Excel, busca cada producto por SKU/ID en Shopify via GraphQL
- Compara los valores actuales con los nuevos del Excel
- Retorna un diff JSON:
  ```json
  {
    "total": 50,
    "found": 48,
    "not_found": 2,
    "changes": 45,
    "no_changes": 3,
    "preview": [
      {
        "sku": "12345",
        "title": "Mi Libro",
        "product_id": "gid://shopify/Product/123",
        "variant_id": "gid://shopify/ProductVariant/456",
        "fields": [
          {"field": "Precio", "current": "29900", "new": "25900"},
          {"field": "Vendor", "current": "Planeta", "new": "Penguin"}
        ]
      }
    ],
    "not_found_skus": ["99999", "88888"]
  }
  ```
- El frontend muestra:
  - Badges: "48 encontrados", "2 no encontrados", "45 con cambios"
  - Tabla con columnas: SKU, Titulo, Campo, Valor Actual, Valor Nuevo
  - Filas donde actual == nuevo se filtran (no se muestran)
  - SKUs no encontrados se muestran en alerta separada
  - Boton "Aplicar Cambios" habilitado solo si hay cambios

### Paso 4 — Aplicar en Shopify
- El usuario hace clic en "Aplicar Cambios"
- El backend aplica las actualizaciones en Shopify con el throttler existente
- Progreso: barra indeterminada (consistente con Crear Productos)
- Resultado: tabla con SKU, Titulo, Estado (OK / Error), Detalle
- Badges: "N actualizados", "N con errores"

## Columnas soportadas

| Columna en Excel | Campo Shopify | Mutation | Tipo |
|---|---|---|---|
| SKU | (identificador) | busqueda via `productVariants(query: "sku:X")` | Identificador |
| ID | (identificador) | `gid://shopify/Product/{ID}` | Identificador |
| Precio | variant.price | `productVariantsBulkUpdate` | Variante |
| Precio de comparacion | variant.compareAtPrice | `productVariantsBulkUpdate` | Variante |
| Peso (kg) | variant.inventoryItem.measurement.weight | `productVariantsBulkUpdate` | Variante |
| Titulo | product.title | `productUpdate` | Producto |
| Sipnosis | product.descriptionHtml | `productUpdate` | Producto |
| Vendor | product.vendor | `productUpdate` | Producto |
| Portada (URL) | media | `productCreateMedia` | Media |
| Autor | metafield custom.autor | `productUpdate` (metafields) | Metafield |
| Editorial | metafield custom.editorial | `productUpdate` (metafields) | Metafield |
| Idioma | metafield custom.idioma | `productUpdate` (metafields) | Metafield |
| Formato | metafield custom.formato | `productUpdate` (metafields) | Metafield |
| Categoria | metafield custom.categoria | `productUpdate` (metafields) | Metafield |
| Subcategoria | metafield custom.subcategoria | `productUpdate` (metafields) | Metafield |

## Backend — Endpoints nuevos

### POST `/api/ingreso/productos/actualizar/preview`
- Input: Excel file (multipart)
- Proceso:
  1. Parsea Excel, extrae SKUs/IDs y columnas presentes
  2. Busca cada producto en Shopify via GraphQL (reutiliza patron de `process_batch_info` con ThreadPoolExecutor)
  3. Para cada producto encontrado, compara valor actual vs nuevo para cada columna presente
  4. Retorna diff JSON (schema arriba)
- Errores: 400 si no tiene SKU/ID, 400 si no tiene columnas de datos

### POST `/api/ingreso/productos/actualizar/apply`
- Input: Excel file (multipart)
- Proceso:
  1. Misma logica de parseo y busqueda que preview
  2. Para cada producto con cambios, construye las mutations necesarias:
     - Campos de producto (titulo, sinopsis, vendor) + metafields → `productUpdate` mutation
     - Campos de variante (precio, compareAtPrice, peso) → `productVariantsBulkUpdate` mutation
     - Imagen → `productCreateMedia` mutation (reemplaza la existente)
  3. Ejecuta con ThreadPoolExecutor + ShopifyThrottler (mismo patron que `create_products_batch`)
  4. Retorna resultados por producto
- Response:
  ```json
  {
    "total": 45,
    "updated": 43,
    "failed": 2,
    "results": [
      {"sku": "12345", "title": "Mi Libro", "success": true, "fields_updated": ["Precio", "Vendor"]},
      {"sku": "67890", "title": "Otro", "success": false, "error": "HTTP 429 after retries"}
    ]
  }
  ```

## Backend — Mutations GraphQL

### productUpdate (campos de producto + metafields)

```graphql
mutation productUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product { id title }
    userErrors { field message }
  }
}
```

Nota: `productUpdate` en API 2025-01 aun usa `ProductInput` (no deprecated para update, solo para create). Los campos se pasan como:

```json
{
  "input": {
    "id": "gid://shopify/Product/123",
    "title": "Nuevo Titulo",
    "vendor": "Nuevo Vendor",
    "descriptionHtml": "<p>Nueva sinopsis</p>",
    "metafields": [
      {"namespace": "custom", "key": "autor", "value": "Autor", "type": "single_line_text_field"}
    ]
  }
}
```

### productVariantsBulkUpdate (campos de variante)

Ya existe la mutation en `shopify_service.py` como `_VARIANT_UPDATE_MUTATION`. Se reutiliza.

### productCreateMedia (imagen)

```graphql
mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
  productCreateMedia(productId: $productId, media: $media) {
    media { id }
    mediaUserErrors { field message }
  }
}
```

## Backend — Busqueda extendida para preview

La funcion de busqueda necesita traer mas datos que la busqueda actual (`process_batch_info`). Necesita traer:

- Todos los metafields del producto (ya lo hace: `metafields(first: 50)`)
- Precio y compareAtPrice de la variante (ya lo tiene: `price`)
- Peso de la variante (agregar: `inventoryItem { measurement { weight { value unit } } }`)
- descriptionHtml del producto (agregar al query)
- Imagen actual (agregar: `images(first: 1) { edges { node { url } } }`)

Se crea una nueva funcion `fetch_products_for_update` que retorna datos completos, separada de `process_batch_info` para no contaminar la busqueda simple.

## Frontend — Archivos

| Archivo | Accion | Responsabilidad |
|---|---|---|
| `src/pages/ActualizarProductos.tsx` | Crear | Pagina principal con wizard de 4 pasos |
| `src/pages/ingreso/validation.ts` | Modificar | Agregar `validateUpdateFile()` |
| `src/pages/ingreso/types.ts` | Modificar | Agregar tipos de update response |
| `src/pages/ingreso/api.ts` | Modificar | Agregar `previewUpdateProducts()` y `applyUpdateProducts()` |
| `src/pages/ingreso/hooks.ts` | Modificar | Agregar `usePreviewUpdate()` y `useApplyUpdate()` |
| `src/App.tsx` | Modificar | Agregar ruta `/actualizar-productos` |
| `src/hooks/useNavigationPermissions.ts` | Modificar | Agregar a `WORKFLOW_SUB_PATHS` |

## Frontend — Tipos nuevos

```typescript
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

## Backend — Archivos

| Archivo | Accion | Responsabilidad |
|---|---|---|
| `backend/services/shopify_service.py` | Modificar | `fetch_products_for_update()`, `update_single_product()`, `update_products_batch()` |
| `backend/routers/ingreso.py` | Modificar | Endpoints `/productos/actualizar/preview` y `/productos/actualizar/apply` |

## Fuera de alcance

- Actualizar inventario/stock (eso ya lo maneja la tab de Inventario Multi-Bodega)
- Actualizar tags
- Eliminar productos
- Actualizar variantes multiples (solo Default Title)
- Historial de cambios en Firestore (mejora #8, prioridad baja)
