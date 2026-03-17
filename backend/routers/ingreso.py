"""
Router de IngresoMercancia — endpoints para consulta de productos, inventario y ventas.
"""
import os
from io import BytesIO

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services import shopify_service

router = APIRouter(prefix="/api/ingreso", tags=["Ingreso Mercancía"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SearchRequest(BaseModel):
    isbn_list: list[str]
    quantities: dict[str, int] = {}


class InventoryRequest(BaseModel):
    isbn_list: list[str]
    quantities: dict[str, int] = {}
    locations: list[str]
    include_sales: bool = False


# ---------------------------------------------------------------------------
# Estado en memoria para ventas (se carga una vez y se reutiliza)
# ---------------------------------------------------------------------------

_sales_cache: dict = {"data": None, "loaded_at": None, "skus_count": 0}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/health")
def health_check():
    """Verifica conexión con Shopify."""
    result = shopify_service.verify_shopify_connection()
    if not result.get("connected"):
        raise HTTPException(status_code=503, detail=result.get("error", "No conectado"))
    return result


@router.get("/locations")
def list_locations():
    """Lista todas las bodegas/ubicaciones de Shopify."""
    import traceback
    try:
        locations = shopify_service.get_locations()
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[LOCATIONS ERROR] {e}\n{tb}", flush=True)
        raise HTTPException(status_code=502, detail=f"Error al obtener bodegas: {e}")
    if not locations:
        raise HTTPException(status_code=404, detail="No se encontraron bodegas")
    return {"locations": [{"name": k, "id": v} for k, v in locations.items()]}


# ---------------------------------------------------------------------------
# Búsqueda de productos
# ---------------------------------------------------------------------------

@router.get("/search/{isbn}")
def search_single(isbn: str):
    """Busca un producto individual por ISBN/SKU."""
    isbn_clean = isbn.strip()
    if isbn_clean.replace(".", "").replace(",", "").isdigit():
        isbn_clean = str(int(float(isbn_clean)))

    results = shopify_service.search_products([isbn_clean], {isbn_clean: 1})
    if not results:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {"product": results[0]}


@router.post("/search")
def search_bulk_json(request: SearchRequest):
    """Busca múltiples productos por lista de ISBNs (JSON)."""
    if not request.isbn_list:
        raise HTTPException(status_code=400, detail="isbn_list vacía")

    results = shopify_service.search_products(request.isbn_list, request.quantities)
    return {"products": results, "total": len(results)}


@router.post("/search/excel")
async def search_bulk_excel(file: UploadFile = File(...)):
    """
    Sube un Excel con columna 'ISBN' (y opcionalmente 'Cantidad').
    Retorna Excel con los resultados.
    """
    isbn_list, isbn_to_qty = await _parse_excel_upload(file)

    results = shopify_service.search_products(isbn_list, isbn_to_qty)

    df = pd.DataFrame(results)
    if not df.empty:
        cols = ["ISBN", "ID", "Variant ID", "Titulo", "Vendor", "Precio", "Categoria", "Cantidad"]
        df = df[[c for c in cols if c in df.columns]]

    return _dataframe_to_excel_response(df, "Productos_Shopify.xlsx")


# ---------------------------------------------------------------------------
# Inventario multi-bodega
# ---------------------------------------------------------------------------

@router.post("/inventory")
def inventory_json(request: InventoryRequest):
    """Consulta inventario multi-bodega (JSON)."""
    if not request.isbn_list:
        raise HTTPException(status_code=400, detail="isbn_list vacía")
    if not request.locations:
        raise HTTPException(status_code=400, detail="locations vacía")

    sales_data = _sales_cache["data"] if request.include_sales else None

    results = shopify_service.search_inventory(
        request.isbn_list,
        request.quantities,
        request.locations,
        sales_data,
    )
    return {"inventory": results, "total": len(results)}


@router.post("/inventory/excel")
async def inventory_excel(
    file: UploadFile = File(...),
    locations: str = "",
    include_sales: bool = False,
):
    """
    Sube Excel con 'ISBN' y 'Cantidad', retorna inventario por bodega en Excel.
    locations: nombres de bodegas separados por coma.
    """
    if not locations:
        raise HTTPException(status_code=400, detail="Parámetro 'locations' requerido")

    location_names = [loc.strip() for loc in locations.split(",") if loc.strip()]
    isbn_list, isbn_to_qty = await _parse_excel_upload(file)

    sales_data = _sales_cache["data"] if include_sales else None

    results = shopify_service.search_inventory(
        isbn_list, isbn_to_qty, location_names, sales_data
    )

    df = pd.DataFrame(results)

    # Reordenar columnas
    if not df.empty and "Ventas 12M" in df.columns:
        base_cols = ["ISBN", "Title", "Vendor", "Solicitado", "Ventas 12M"]
        bodega_cols = [c for c in df.columns if c not in base_cols]
        df = df[base_cols + bodega_cols]

    return _dataframe_to_excel_response(df, "Inventario_Bodegas.xlsx")


# ---------------------------------------------------------------------------
# Ventas (Bulk Operations)
# ---------------------------------------------------------------------------

@router.post("/sales/load")
def load_sales():
    """
    Inicia la carga de ventas de los últimos 12 meses vía Bulk Operation.
    NOTA: Esta operación puede tardar varios minutos.
    """
    sales_data, error = shopify_service.load_sales_sync()
    if error:
        raise HTTPException(status_code=500, detail=error)

    from datetime import datetime

    _sales_cache["data"] = sales_data
    _sales_cache["skus_count"] = len(sales_data) if sales_data else 0
    _sales_cache["loaded_at"] = datetime.now().isoformat()

    return {
        "success": True,
        "skus_count": _sales_cache["skus_count"],
        "loaded_at": _sales_cache["loaded_at"],
    }


@router.get("/sales/status")
def sales_status():
    """Retorna el estado actual de la caché de ventas y de la Bulk Operation."""
    bulk_status = shopify_service.check_bulk_operation_status()
    return {
        "cache": {
            "loaded": _sales_cache["data"] is not None,
            "skus_count": _sales_cache["skus_count"],
            "loaded_at": _sales_cache["loaded_at"],
        },
        "bulk_operation": bulk_status,
    }


# ---------------------------------------------------------------------------
# Plantillas
# ---------------------------------------------------------------------------

@router.get("/templates/{template_name}")
def download_template(template_name: str):
    """Descarga una plantilla Excel."""
    templates_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")

    allowed = {
        "creacion": "Creacion_productos.xlsx",
        "actualizacion": "Plantilla_Actualizacion_Productos.xlsx",
    }

    filename = allowed.get(template_name.lower())
    if not filename:
        raise HTTPException(
            status_code=404,
            detail=f"Plantilla '{template_name}' no existe. Opciones: {list(allowed.keys())}",
        )

    filepath = os.path.join(templates_dir, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Archivo de plantilla no encontrado en el servidor")

    with open(filepath, "rb") as f:
        content = f.read()

    return StreamingResponse(
        BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

async def _parse_excel_upload(file: UploadFile) -> tuple[list[str], dict]:
    """Lee un Excel subido y extrae ISBNs y cantidades."""
    content = await file.read()
    df = pd.read_excel(BytesIO(content))
    df.columns = [str(c).strip() for c in df.columns]

    col_isbn = next((c for c in df.columns if c.lower() == "isbn"), None)
    col_cant = next((c for c in df.columns if c.lower() == "cantidad"), None)

    if not col_isbn:
        raise HTTPException(status_code=400, detail="El archivo debe tener una columna 'ISBN'")

    isbn_list = []
    isbn_to_qty = {}
    seen = set()

    for _, row in df.iterrows():
        raw = row[col_isbn]
        isbn_val = str(int(raw)) if isinstance(raw, float) else str(raw).strip()
        isbn_list.append(isbn_val)
        if isbn_val not in seen:
            seen.add(isbn_val)
        isbn_to_qty[isbn_val] = int(row[col_cant]) if col_cant and pd.notna(row[col_cant]) else 0

    return isbn_list, isbn_to_qty


def _dataframe_to_excel_response(df: pd.DataFrame, filename: str) -> StreamingResponse:
    """Convierte DataFrame a respuesta Excel descargable."""
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name="Datos")
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
