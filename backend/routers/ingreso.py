"""
Router de IngresoMercancia — endpoints para consulta de productos, inventario y ventas.
"""
import json
import os
import unicodedata
from io import BytesIO

import numpy as np
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


class InlineUpdateItem(BaseModel):
    sku: str
    changes: dict[str, str]


class InlineUpdateRequest(BaseModel):
    items: list[InlineUpdateItem]


# ---------------------------------------------------------------------------
# Estado en memoria para ventas (se carga una vez y se reutiliza)
# ---------------------------------------------------------------------------

_sales_cache: dict = {"data": None, "loaded_at": None, "skus_count": 0}
_sales_job: dict = {"running": False, "error": None}


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


@router.get("/locations/debug")
def debug_locations():
    """Diagnóstico: intenta obtener locations via REST y GraphQL."""
    import requests as req
    from config import settings as cfg
    results = {}

    # REST
    try:
        headers = cfg.get_shopify_headers()
        rest_url = cfg.get_rest_url()
        url = f"{rest_url}/locations.json"
        resp = req.get(url, headers=headers, timeout=10)
        results["rest"] = {"status": resp.status_code, "body": resp.text[:500]}
    except Exception as e:
        results["rest"] = {"error": f"{type(e).__name__}: {e}"}

    # GraphQL
    try:
        headers = cfg.get_shopify_headers()
        graphql_url = cfg.get_graphql_url()
        query = '{ locations(first: 50) { edges { node { id name } } } }'
        resp = req.post(graphql_url, json={"query": query}, headers=headers, timeout=10)
        results["graphql"] = {"status": resp.status_code, "body": resp.text[:1000]}
    except Exception as e:
        results["graphql"] = {"error": f"{type(e).__name__}: {e}"}

    return results


@router.get("/locations")
async def list_locations():
    """Lista todas las bodegas/ubicaciones de Shopify."""
    import asyncio
    import traceback
    loop = asyncio.get_event_loop()
    try:
        locations = await asyncio.wait_for(
            loop.run_in_executor(None, shopify_service.get_locations),
            timeout=20,
        )
    except asyncio.TimeoutError:
        print("[LOCATIONS ERROR] Timeout after 20s", flush=True)
        raise HTTPException(status_code=504, detail="Timeout al obtener bodegas de Shopify")
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

def _sales_worker():
    """Background worker que carga ventas sin bloquear el endpoint."""
    from datetime import datetime

    try:
        sales_data, error = shopify_service.load_sales_sync()
        if error:
            _sales_job["error"] = error
            print(f"[SALES] Job failed: {error}", flush=True)
        else:
            _sales_cache["data"] = sales_data
            _sales_cache["skus_count"] = len(sales_data) if sales_data else 0
            _sales_cache["loaded_at"] = datetime.now().isoformat()
            _sales_job["error"] = None
            print(f"[SALES] Job done: {_sales_cache['skus_count']} SKUs", flush=True)
    except Exception as e:
        _sales_job["error"] = str(e)
        print(f"[SALES] Job exception: {e}", flush=True)
    finally:
        _sales_job["running"] = False


@router.post("/sales/load")
def load_sales():
    """
    Inicia la carga de ventas de los últimos 12 meses vía Bulk Operation.
    Retorna inmediatamente — el trabajo corre en background.
    Consultar /sales/status para ver el progreso.
    """
    import threading

    if _sales_job["running"]:
        return {"success": True, "message": "Ya hay una carga en progreso"}

    _sales_job["running"] = True
    _sales_job["error"] = None
    thread = threading.Thread(target=_sales_worker, daemon=True)
    thread.start()

    return {"success": True, "message": "Carga de ventas iniciada en background"}


@router.get("/sales/status")
def sales_status():
    """Retorna el estado actual de la caché de ventas y del job de carga."""
    bulk_status = shopify_service.check_bulk_operation_status()
    return {
        "cache": {
            "loaded": _sales_cache["data"] is not None,
            "skus_count": _sales_cache["skus_count"],
            "loaded_at": _sales_cache["loaded_at"],
        },
        "job": {
            "running": _sales_job["running"],
            "error": _sales_job["error"],
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
        "actualizacion": "Actualizacion_productos.xlsx",
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


# ---------------------------------------------------------------------------
# Crear Productos — transformación a formato Shopify
# ---------------------------------------------------------------------------

def _unidecode(text: str) -> str:
    """Elimina acentos y caracteres especiales, convierte a ASCII."""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


_IDIOMA_MAP = {
    "Español": '["Español"]', "Ingles": '["Ingles"]', "Frances": '["Frances"]',
    "Italiano": '["Italiano"]', "Portugues": '["Portugues"]', "Aleman": '["Aleman"]',
    "Bilingue (Español-Ingles)": '["Bilingue (Español-Ingles)"]',
    "Bilingue (Español-Portugues)": '["Bilingue (Español-Portugues)"]',
    "Vasco": '["Vasco"]', "Gallego": '["Gallego"]', "Latin": '["Latin"]',
    "Ruso": '["Ruso"]', "Arabe": '["Arabe"]', "Chino": '["Chino"]',
    "Japones": '["Japones"]', "Catalan": '["Catalan"]', "Rumano": '["Rumano"]',
    "Holandes": '["Holandes"]', "Bulgaro": '["Bulgaro"]', "Griego": '["Griego"]',
    "Polaco": '["Polaco"]', "Checo": '["Checo"]', "Sueco": '["Sueco"]',
}

_FORMATO_MAP = {
    "Tapa Dura": '["Tapa Dura"]', "Tapa Blanda": '["Tapa Blanda"]',
    "Bolsillo": '["Bolsillo"]', "Libro de lujo": '["Libro de lujo"]',
    "Espiral": '["Espiral"]', "Tela": '["Tela"]', "Grapado": '["Grapado"]',
    "Fasciculo Encuadernable": '["Fasciculo Encuadernable"]',
    "Troquelado": '["Troquelado"]', "Anillas": '["Anillas"]', "Otros": '["Otros"]',
}


def _procesar_creacion_productos(src: pd.DataFrame) -> pd.DataFrame:
    """Transforma un DataFrame con la plantilla de 18 columnas al formato Shopify."""
    df = pd.DataFrame()

    df["Title"] = src["Titulo"].str.title()
    df["Command"] = "NEW"
    df["Body HTML"] = src.get("Sipnosis", pd.Series(dtype=str)).fillna("")

    variant_sku = src["SKU"].apply(lambda x: str(x).replace(".0", ""))

    df["Handle"] = (
        df["Title"]
        .str.lower()
        .apply(lambda x: _unidecode(x) if isinstance(x, str) else x)
        .str.replace(r"[^\w\s]+", "", regex=True)
        .str.replace(" ", "-")
        + "-"
        + variant_sku
    )

    df["Vendor"] = src["Vendor"]
    df["Type"] = "Libro"
    df["Tags"] = pd.Series(dtype=str, index=src.index)
    df["Status"] = "Active"
    df["Published"] = "TRUE"
    df["Published Scope"] = "global"
    df["Gift Card"] = "FALSE"
    df["Row #"] = 1
    df["Top Row"] = "TRUE"
    df["Option1 Name"] = "Title"
    df["Option1 Value"] = "Default Title"
    df["Option2 Name"] = pd.Series(dtype=str, index=src.index)
    df["Option2 Value"] = pd.Series(dtype=str, index=src.index)
    df["Option3 Name"] = pd.Series(dtype=str, index=src.index)
    df["Option3 Value"] = pd.Series(dtype=str, index=src.index)
    df["Variant Position"] = pd.Series(dtype=str, index=src.index)
    df["Variant SKU"] = variant_sku
    df["Variant Barcode"] = variant_sku
    df["Image Src"] = src.get("Portada (URL)", pd.Series(dtype=str))
    df["Variant Price"] = src.get("Precio")
    df["Variant Compare At Price"] = src.get("Precio de comparacion")
    df["Variant Taxable"] = "FALSE"
    df["Variant Tax Code"] = pd.Series(dtype=str, index=src.index)
    df["Variant Inventory Tracker"] = "shopify"
    df["Variant Inventory Policy"] = "deny"
    df["Variant Fulfillment Service"] = "manual"
    df["Variant Requires Shipping"] = "TRUE"
    df["Variant Weight"] = src.get("peso (kg)")
    df["Variant Weight Unit"] = df["Variant Weight"].apply(
        lambda x: "kg" if pd.notnull(x) else np.nan
    )

    # Metafields
    df["Metafield: custom.autor [single_line_text_field]"] = (
        src.get("Autor", pd.Series(dtype=str)).fillna("").str.title()
    )
    df["Metafield: custom.idioma [list.single_line_text_field]"] = (
        src.get("Idioma", pd.Series(dtype=str)).apply(lambda x: _IDIOMA_MAP.get(x, x))
    )
    df["Metafield: custom.formato [list.single_line_text_field]"] = (
        src.get("Formato", pd.Series(dtype=str)).apply(lambda x: _FORMATO_MAP.get(x, x))
    )
    df["Metafield: custom.alto [dimension]"] = src.get("Alto", pd.Series(dtype=float)).apply(
        lambda x: np.nan if pd.isna(x) else json.dumps({"value": x, "unit": "cm"})
    )
    df["Metafield: custom.ancho [dimension]"] = src.get("Ancho", pd.Series(dtype=float)).apply(
        lambda x: np.nan if pd.isna(x) else json.dumps({"value": x, "unit": "cm"})
    )
    df["Metafield: custom.editorial [single_line_text_field]"] = (
        src.get("Editorial", pd.Series(dtype=str)).fillna("").str.title()
    )
    df["Metafield: custom.numero_de_paginas [number_integer]"] = src.get("Numero de paginas")
    df["Metafield: custom.ilustrador [single_line_text_field]"] = src.get("Ilustrador")
    df["Metafield: custom.categoria [single_line_text_field]"] = src.get("Categoria")
    df["Metafield: custom.subcategoria [single_line_text_field]"] = src.get("Subcategoria")

    df["Image Alt Text"] = "Libro " + df["Title"] + " " + df["Variant SKU"]

    return df


@router.post("/productos/crear")
async def crear_productos(file: UploadFile = File(...)):
    """
    Sube un Excel con la plantilla de creación de productos (18 columnas).
    Retorna Excel transformado al formato de importación Shopify.
    """
    content = await file.read()
    try:
        df = pd.read_excel(BytesIO(content), sheet_name="Products")
    except Exception:
        df = pd.read_excel(BytesIO(content))

    df.columns = [str(c).strip() for c in df.columns]

    required = ["Titulo", "SKU", "Vendor"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Columnas requeridas faltantes: {', '.join(missing)}",
        )

    try:
        result = _procesar_creacion_productos(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar: {e}")

    return _dataframe_to_excel_response(result, "resultado_crear_productos.xlsx")


@router.post("/productos/shopify")
async def crear_productos_shopify(file: UploadFile = File(...)):
    """
    Sube un Excel con la plantilla de creación de productos (18 columnas).
    Transforma y crea los productos directamente en Shopify.
    Retorna JSON con resultados por producto.
    """
    content = await file.read()
    try:
        df = pd.read_excel(BytesIO(content), sheet_name="Products")
    except Exception:
        df = pd.read_excel(BytesIO(content))

    df.columns = [str(c).strip() for c in df.columns]

    required = ["Titulo", "SKU", "Vendor"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Columnas requeridas faltantes: {', '.join(missing)}",
        )

    try:
        processed = _procesar_creacion_productos(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar: {e}")

    # Convertir DataFrame a lista de dicts para el servicio
    rows = processed.to_dict(orient="records")

    import asyncio
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(
        None, shopify_service.create_products_batch, rows
    )

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


# ---------------------------------------------------------------------------
# Actualizar Productos
# ---------------------------------------------------------------------------

_UPDATE_DATA_COLUMNS = {
    "Titulo", "Sipnosis", "Vendor", "Precio", "Precio de comparacion",
    "Portada (URL)", "Autor", "Editorial", "Idioma", "Formato",
    "Categoria", "Subcategoria", "Peso (kg)",
}


async def _parse_update_excel(file: UploadFile) -> tuple:
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


@router.post("/productos/actualizar/inline")
async def inline_update_products(body: InlineUpdateRequest):
    """
    Recibe JSON con SKUs y cambios para actualizar directamente en Shopify.
    Usado por la edición inline en la tabla de consulta de productos.
    """
    if not body.items:
        raise HTTPException(status_code=400, detail="No se enviaron productos para actualizar")

    isbn_list = [item.sku for item in body.items if item.sku.strip()]
    if not isbn_list:
        raise HTTPException(status_code=400, detail="No se encontraron SKUs válidos")

    import asyncio
    loop = asyncio.get_event_loop()
    products = await loop.run_in_executor(
        None, shopify_service.fetch_products_for_update, isbn_list
    )

    products_to_update = []
    changes_to_apply = []

    for item in body.items:
        product = products.get(item.sku.strip())
        if not product:
            continue

        changes = {}
        for field, new_val in item.changes.items():
            current_val = product["current"].get(field, "")
            if str(new_val).strip() != str(current_val).strip():
                changes[field] = new_val.strip()

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


