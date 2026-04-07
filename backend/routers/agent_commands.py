"""
Router de Slash Commands — endpoints livianos para consultas rapidas desde el chat.
Usa caches de Firestore para respuestas inmediatas (sin llamadas directas a Shopify API).
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger("bukz.commands")

router = APIRouter(prefix="/api/commands", tags=["Slash Commands"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_firestore():
    from services.firebase_service import get_firestore_db
    return get_firestore_db()


def _sanitize_gid(gid: str) -> str:
    return gid.replace("://", "__").replace("/", "__")


def _read_sales_cache() -> dict:
    """Lee ventas de PostgreSQL. Returns {sku: {month: qty}}."""
    from services.database import pg_read_sales
    return pg_read_sales()


def _read_inventory_cache(location_gid: str) -> list[dict] | None:
    """Lee inventario de una sede desde PostgreSQL."""
    from services.database import pg_read_inventory
    doc_id = _sanitize_gid(location_gid)
    return pg_read_inventory(doc_id)


def _read_product_catalog() -> list[dict] | None:
    """Lee catalogo de productos desde PostgreSQL."""
    from services.database import pg_read_product_catalog
    return pg_read_product_catalog()


def _get_all_locations() -> dict[str, str]:
    """Lista todas las sedes desde PostgreSQL. Returns {name: gid}."""
    from services.database import pg_read_all_locations
    return pg_read_all_locations()


def _normalize(text: str) -> str:
    """Normaliza texto para comparacion: lowercase, strip."""
    return text.strip().lower()


def _match_location(query: str, locations: dict[str, str]) -> tuple[str, str] | None:
    """Busca una ubicacion por nombre parcial. Returns (name, gid) o None."""
    q = _normalize(query)
    for name, gid in locations.items():
        if q in _normalize(name):
            return name, gid
    return None


# ---------------------------------------------------------------------------
# /stock/{isbn} — Producto + inventario + ventas
# ---------------------------------------------------------------------------

@router.get("/stock/{isbn}")
def get_stock(isbn: str):
    """
    Consulta rapida de stock por ISBN/SKU.
    Busca en product_catalog (info), inventory_cache (stock por sede)
    y sales_cache (ventas recientes).
    """
    isbn_clean = isbn.strip()
    if isbn_clean.replace(".", "").replace(",", "").isdigit():
        isbn_clean = str(int(float(isbn_clean)))

    # 1. Buscar en catalogo
    catalog = _read_product_catalog()
    product_info = None
    if catalog:
        for item in catalog:
            if str(item.get("sku", "")).strip() == isbn_clean:
                product_info = item
                break

    # 2. Buscar stock en todas las ubicaciones
    locations = _get_all_locations()
    stock_by_location = {}
    total_stock = 0

    for loc_name, loc_gid in locations.items():
        items = _read_inventory_cache(loc_gid)
        if not items:
            continue
        for item in items:
            if str(item.get("sku", "")).strip() == isbn_clean:
                available = item.get("available", 0)
                stock_by_location[loc_name] = available
                total_stock += available
                break

    # 3. Buscar ventas
    sales_data = _read_sales_cache()
    sku_sales = sales_data.get(isbn_clean, {})

    # Calcular total ventas
    total_sales = sum(sku_sales.values())

    if not product_info and not stock_by_location and not sku_sales:
        raise HTTPException(status_code=404, detail=f"No se encontro producto con ISBN/SKU: {isbn_clean}")

    return {
        "isbn": isbn_clean,
        "title": product_info.get("title", "—") if product_info else "—",
        "vendor": product_info.get("vendor", "—") if product_info else "—",
        "stock_total": total_stock,
        "stock_by_location": stock_by_location,
        "sales_total": total_sales,
        "sales_by_month": sku_sales,
    }


# ---------------------------------------------------------------------------
# /ventas/{isbn} — Historial de ventas
# ---------------------------------------------------------------------------

@router.get("/ventas/{isbn}")
def get_ventas(isbn: str):
    """Historial de ventas mensual de un producto."""
    isbn_clean = isbn.strip()
    if isbn_clean.replace(".", "").replace(",", "").isdigit():
        isbn_clean = str(int(float(isbn_clean)))

    sales_data = _read_sales_cache()
    sku_sales = sales_data.get(isbn_clean, {})

    if not sku_sales:
        # Buscar titulo en catalogo para mejor mensaje
        catalog = _read_product_catalog()
        found = False
        if catalog:
            for item in catalog:
                if str(item.get("sku", "")).strip() == isbn_clean:
                    found = True
                    break
        if found:
            raise HTTPException(
                status_code=404,
                detail=f"Producto encontrado pero sin ventas registradas en los ultimos 6 meses.",
            )
        raise HTTPException(status_code=404, detail=f"No se encontro producto con ISBN/SKU: {isbn_clean}")

    # Ordenar por mes
    sorted_months = sorted(sku_sales.items(), key=lambda x: x[0])
    total = sum(v for _, v in sorted_months)

    # Info del catalogo
    catalog = _read_product_catalog()
    title = "—"
    vendor = "—"
    if catalog:
        for item in catalog:
            if str(item.get("sku", "")).strip() == isbn_clean:
                title = item.get("title", "—")
                vendor = item.get("vendor", "—")
                break

    return {
        "isbn": isbn_clean,
        "title": title,
        "vendor": vendor,
        "total_units": total,
        "months": [{"month": m, "units": u} for m, u in sorted_months],
    }


# ---------------------------------------------------------------------------
# /top — Top productos mas vendidos
# ---------------------------------------------------------------------------

MONTH_MAP = {
    "enero": "01", "febrero": "02", "marzo": "03", "abril": "04",
    "mayo": "05", "junio": "06", "julio": "07", "agosto": "08",
    "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12",
}


@router.get("/top")
def get_top(
    sede: Optional[str] = Query(default=None, description="Nombre de la sede"),
    mes: Optional[str] = Query(default=None, description="Mes (nombre o YYYY-MM)"),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Top productos mas vendidos, opcionalmente filtrado por sede y/o mes."""
    sales_data = _read_sales_cache()
    if not sales_data:
        raise HTTPException(status_code=404, detail="No hay datos de ventas disponibles.")

    # Resolver filtro de mes
    month_filter = None
    if mes:
        mes_lower = mes.strip().lower()
        if mes_lower in MONTH_MAP:
            # Inferir anio actual
            year = datetime.now(timezone.utc).year
            month_filter = f"{year}-{MONTH_MAP[mes_lower]}"
        elif len(mes_lower) == 7 and "-" in mes_lower:
            month_filter = mes_lower
        else:
            # Intentar como numero
            try:
                m = int(mes_lower)
                if 1 <= m <= 12:
                    year = datetime.now(timezone.utc).year
                    month_filter = f"{year}-{m:02d}"
            except ValueError:
                pass

    # Si hay filtro de sede, necesitamos cruzar con inventario
    # para filtrar solo SKUs presentes en esa sede
    sede_skus = None
    if sede:
        locations = _get_all_locations()
        match = _match_location(sede, locations)
        if not match:
            raise HTTPException(status_code=404, detail=f"Sede '{sede}' no encontrada.")
        _, loc_gid = match
        items = _read_inventory_cache(loc_gid)
        if items:
            sede_skus = {str(item.get("sku", "")).strip() for item in items}

    # Agregar ventas
    sku_totals: dict[str, int] = {}
    for sku, months in sales_data.items():
        if sede_skus is not None and sku not in sede_skus:
            continue
        if month_filter:
            qty = months.get(month_filter, 0)
        else:
            qty = sum(months.values())
        if qty > 0:
            sku_totals[sku] = qty

    # Ordenar y limitar
    top_items = sorted(sku_totals.items(), key=lambda x: x[1], reverse=True)[:limit]

    # Enriquecer con info del catalogo
    catalog = _read_product_catalog()
    catalog_map = {}
    if catalog:
        catalog_map = {str(item.get("sku", "")).strip(): item for item in catalog}

    results = []
    for sku, units in top_items:
        info = catalog_map.get(sku, {})
        results.append({
            "sku": sku,
            "title": info.get("title", "—"),
            "vendor": info.get("vendor", "—"),
            "units": units,
        })

    return {
        "sede": sede,
        "mes": month_filter or "todos",
        "total_results": len(results),
        "items": results,
    }


# ---------------------------------------------------------------------------
# /agotados — Productos sin stock
# ---------------------------------------------------------------------------

@router.get("/agotados")
def get_agotados(
    sede: str = Query(..., description="Nombre de la sede"),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Lista productos con stock 0 o negativo en una sede."""
    locations = _get_all_locations()
    match = _match_location(sede, locations)
    if not match:
        raise HTTPException(status_code=404, detail=f"Sede '{sede}' no encontrada. Sedes disponibles: {', '.join(locations.keys())}")

    loc_name, loc_gid = match
    items = _read_inventory_cache(loc_gid)
    if items is None:
        raise HTTPException(status_code=404, detail=f"No hay datos de inventario para '{loc_name}'.")

    # Filtrar agotados (available <= 0)
    out_of_stock = [
        {
            "sku": item.get("sku", "—"),
            "title": item.get("title", "—"),
            "vendor": item.get("vendor", "—"),
            "available": item.get("available", 0),
        }
        for item in items
        if item.get("available", 0) <= 0
    ]

    # Ordenar por vendor para agrupar
    out_of_stock.sort(key=lambda x: (x["vendor"], x["title"]))

    return {
        "sede": loc_name,
        "total_agotados": len(out_of_stock),
        "total_productos": len(items),
        "porcentaje": round(len(out_of_stock) / len(items) * 100, 1) if len(items) > 0 else 0,
        "items": out_of_stock[:limit],
    }


# ---------------------------------------------------------------------------
# /resumen — Resumen operativo
# ---------------------------------------------------------------------------

@router.get("/resumen")
def get_resumen():
    """Resumen operativo rapido: estado de caches, totales, alertas."""
    # 1. Estado de caches
    locations = _get_all_locations()
    total_stock_all = 0
    total_agotados_all = 0
    total_productos_all = 0
    location_summaries = []

    for loc_name, loc_gid in locations.items():
        items = _read_inventory_cache(loc_gid)
        if items is None:
            location_summaries.append({"sede": loc_name, "status": "sin_datos"})
            continue
        agotados = sum(1 for i in items if i.get("available", 0) <= 0)
        total = len(items)
        stock = sum(i.get("available", 0) for i in items if i.get("available", 0) > 0)
        total_stock_all += stock
        total_agotados_all += agotados
        total_productos_all += total
        location_summaries.append({
            "sede": loc_name,
            "productos": total,
            "agotados": agotados,
            "stock_total": stock,
        })

    # 2. Estado de ventas (desde PostgreSQL)
    from services.database import pg_read_sales_meta
    ventas_status = "sin_datos"
    ventas_skus = 0
    ventas_last_refresh = None
    sales_meta = pg_read_sales_meta()
    if sales_meta:
        ventas_status = "ok"
        ventas_skus = sales_meta.get("sku_count", 0)
        ventas_last_refresh = sales_meta.get("cached_at")

    # 3. Tareas pendientes (sigue en Firestore)
    tareas_count = 0
    try:
        from google.cloud.firestore_v1 import FieldFilter
        db = _get_firestore()
        tasks_query = db.collection("tasks").where(filter=FieldFilter("status", "==", "todo"))
        tareas_count = len(list(tasks_query.stream()))
    except Exception:
        try:
            tasks_query = db.collection("tasks").where("status", "==", "todo")
            tareas_count = len(list(tasks_query.stream()))
        except Exception:
            pass

    return {
        "inventario": {
            "sedes": len(locations),
            "productos_totales": total_productos_all,
            "stock_total": total_stock_all,
            "agotados_total": total_agotados_all,
            "por_sede": location_summaries,
        },
        "ventas": {
            "status": ventas_status,
            "skus_con_ventas": ventas_skus,
            "ultimo_refresh": ventas_last_refresh,
        },
        "tareas_pendientes": tareas_count,
    }
