"""
Router: Stock Muerto por Proveedor
Endpoints:
  POST /api/dead-stock/start   -> Inicia analisis en background
  GET  /api/dead-stock/status  -> Estado y resultados
"""

import base64
import threading
import time
import requests
from datetime import datetime, timedelta
from io import BytesIO

from fastapi import APIRouter
from pydantic import BaseModel
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from config import settings

router = APIRouter(prefix="/api/dead-stock", tags=["Dead Stock"])

# -- Estado global del job -----------------------------------------------

_job_lock = threading.Lock()
_job: dict = {
    "running": False,
    "phase": None,
    "error": None,
    "result": None,
    "started_at": None,
}

TARGET_LOCATIONS = [
    "Bukz Las Lomas",
    "Bukz Bogota 109",
    "Bukz Viva Envigado",
    "Bukz Museo de Antioquia",
]


# -- Request model -------------------------------------------------------

class DeadStockRequest(BaseModel):
    vendor: str
    days_without_sales: int = 90
    min_product_age_months: int = 2


# -- GraphQL helper ------------------------------------------------------

def _gql(query: str, timeout: int = 30) -> dict:
    resp = requests.post(
        settings.get_graphql_url(),
        json={"query": query},
        headers=settings.get_shopify_headers(),
        timeout=timeout,
    )
    resp.raise_for_status()
    body = resp.json()
    if "errors" in body:
        raise RuntimeError(f"GraphQL errors: {body['errors']}")
    return body["data"]


# -- Fase 1: Obtener productos del vendor --------------------------------

def _fetch_vendor_products(vendor: str, min_age_months: int) -> list[dict]:
    """
    Pagina todos los productos del vendor con inventario por location.
    Filtra productos creados hace mas de min_age_months meses.
    Retorna lista de variantes con stock > 0.
    """
    cutoff_date = datetime.now() - timedelta(days=min_age_months * 30)
    variants = []
    cursor = None
    page = 0

    # Escapar comillas simples en el nombre del vendor
    safe_vendor = vendor.replace("'", "\\'")

    while True:
        after_clause = f', after: "{cursor}"' if cursor else ""
        query = """
        {
          products(first: 40%s, query: "vendor:'%s'") {
            edges {
              node {
                id
                title
                vendor
                createdAt
                variants(first: 100) {
                  edges {
                    node {
                      id
                      sku
                      barcode
                      title
                      inventoryItem {
                        id
                        inventoryLevels(first: 10) {
                          edges {
                            node {
                              location {
                                name
                              }
                              quantities(names: ["available"]) {
                                name
                                quantity
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
            }
          }
        }
        """ % (after_clause, safe_vendor)

        last_err = None
        for attempt in range(3):
            try:
                data = _gql(query, timeout=30)
                last_err = None
                break
            except Exception as e:
                last_err = e
                if attempt < 2:
                    print(f"[DEAD-STOCK] Retry {attempt + 1} products page {page}: {e}", flush=True)
                    time.sleep(2)

        if last_err:
            raise RuntimeError(f"Error obteniendo productos (pagina {page}): {last_err}")

        edges = data["products"]["edges"]
        page_info = data["products"]["pageInfo"]

        for edge in edges:
            product = edge["node"]
            cursor = edge["cursor"]

            # Filtrar productos creados recientemente
            created_at = datetime.fromisoformat(product["createdAt"].replace("Z", "+00:00"))
            if created_at.replace(tzinfo=None) > cutoff_date:
                continue

            product_title = product["title"]
            product_vendor = product["vendor"]
            created_str = created_at.strftime("%Y-%m-%d")

            for v_edge in product.get("variants", {}).get("edges", []):
                variant = v_edge["node"]
                sku = str(variant.get("sku") or "").strip()
                barcode = str(variant.get("barcode") or "").strip()
                variant_title = variant.get("title", "")

                inv_item = variant.get("inventoryItem", {})
                levels = inv_item.get("inventoryLevels", {}).get("edges", [])

                for level_edge in levels:
                    level = level_edge["node"]
                    loc_name = level.get("location", {}).get("name", "")

                    # Solo sedes objetivo
                    if loc_name not in TARGET_LOCATIONS:
                        continue

                    qty = 0
                    for q in level.get("quantities", []):
                        if q.get("name") == "available":
                            qty = q.get("quantity", 0)
                            break

                    if qty > 0:
                        variants.append({
                            "sku": sku,
                            "barcode": barcode,
                            "product_title": product_title,
                            "variant_title": variant_title,
                            "vendor": product_vendor,
                            "created_at": created_str,
                            "location": loc_name,
                            "stock": qty,
                        })

        page += 1
        if page % 3 == 0:
            print(f"[DEAD-STOCK] Products: pagina {page}, {len(variants)} variantes con stock...", flush=True)

        if not page_info["hasNextPage"]:
            break

        time.sleep(0.5)

    print(f"[DEAD-STOCK] Total variantes con stock del vendor '{vendor}': {len(variants)}", flush=True)
    return variants


# -- Fase 2: Obtener SKUs vendidos en el periodo -------------------------

def _fetch_sold_skus(days: int) -> set[str]:
    """
    Pagina ordenes pagadas en los ultimos N dias.
    Retorna set de SKUs que tuvieron al menos 1 venta.
    """
    date_start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%dT00:00:00Z")
    query_filter = f"created_at:>={date_start} financial_status:paid"

    sold_skus: set[str] = set()
    cursor = None
    page = 0
    total_orders = 0

    while True:
        after_clause = f', after: "{cursor}"' if cursor else ""
        query = """
        {
          orders(first: 100%s, query: "%s") {
            edges {
              node {
                id
                lineItems(first: 100) {
                  edges {
                    node {
                      sku
                    }
                  }
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
            }
          }
        }
        """ % (after_clause, query_filter)

        last_err = None
        for attempt in range(3):
            try:
                data = _gql(query, timeout=30)
                last_err = None
                break
            except Exception as e:
                last_err = e
                if attempt < 2:
                    print(f"[DEAD-STOCK] Retry {attempt + 1} sales page {page}: {e}", flush=True)
                    time.sleep(2)

        if last_err:
            raise RuntimeError(f"Error obteniendo ventas (pagina {page}): {last_err}")

        edges = data["orders"]["edges"]
        page_info = data["orders"]["pageInfo"]

        for edge in edges:
            total_orders += 1
            order = edge["node"]
            cursor = edge["cursor"]

            for li_edge in order.get("lineItems", {}).get("edges", []):
                li = li_edge["node"]
                sku = str(li.get("sku") or "").strip()
                if sku:
                    sold_skus.add(sku)

        page += 1
        if page % 10 == 0:
            print(
                f"[DEAD-STOCK] Sales: pagina {page}, {total_orders} ordenes, "
                f"{len(sold_skus)} SKUs unicos vendidos...",
                flush=True,
            )

        if not page_info["hasNextPage"]:
            break

        time.sleep(0.5)

    print(
        f"[DEAD-STOCK] Ventas: {total_orders} ordenes, {len(sold_skus)} SKUs vendidos "
        f"en los ultimos {days} dias",
        flush=True,
    )
    return sold_skus


# -- Fase 3: Cruce y generacion de Excel ---------------------------------

def _generate_excel(dead_rows: list[dict], vendor: str, days: int) -> str:
    """Genera Excel con los productos sin ventas y retorna base64."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Stock Muerto"

    # Estilos
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_border = Border(
        left=Side(style="thin"),
        right=Side(style="thin"),
        top=Side(style="thin"),
        bottom=Side(style="thin"),
    )

    headers = [
        "SKU",
        "Codigo de Barras",
        "Producto",
        "Variante",
        "Proveedor",
        "Fecha Creacion",
        "Sede",
        "Stock Disponible",
        f"Dias Sin Venta (>{days}d)",
        "Estado",
    ]

    # Escribir headers
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border

    # Escribir datos
    red_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    for i, row in enumerate(dead_rows, 2):
        values = [
            row["sku"],
            row["barcode"],
            row["product_title"],
            row["variant_title"],
            row["vendor"],
            row["created_at"],
            row["location"],
            row["stock"],
            f">{days}",
            "Stock Muerto",
        ]
        for col, val in enumerate(values, 1):
            cell = ws.cell(row=i, column=col, value=val)
            cell.border = thin_border
            if col == 10:  # Columna Estado
                cell.fill = red_fill

    # Ajustar anchos de columna
    col_widths = [15, 18, 45, 20, 20, 14, 22, 16, 18, 14]
    for col, width in enumerate(col_widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = width

    # Autofilter
    ws.auto_filter.ref = f"A1:J{len(dead_rows) + 1}"

    # Congelar header
    ws.freeze_panes = "A2"

    # Guardar a buffer y encodear base64
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


# -- Background worker ---------------------------------------------------

def _dead_stock_worker(vendor: str, days: int, min_age_months: int):
    """Ejecuta el analisis de stock muerto en 3 fases."""
    try:
        # Fase 1: Productos del vendor con stock
        _job["phase"] = "products"
        print(f"[DEAD-STOCK] === FASE 1: Productos de '{vendor}' ===", flush=True)
        vendor_variants = _fetch_vendor_products(vendor, min_age_months)

        if not vendor_variants:
            _job["result"] = {
                "vendor": vendor,
                "days_without_sales": days,
                "min_product_age_months": min_age_months,
                "total_variants_with_stock": 0,
                "dead_stock_variants": 0,
                "dead_stock_units": 0,
                "dead_stock_pct": 0,
                "excel_base64": None,
                "fecha_calculo": datetime.now().isoformat(),
                "message": f"No se encontraron productos del proveedor '{vendor}' con stock (creados hace mas de {min_age_months} meses)",
            }
            _job["error"] = None
            print(f"[DEAD-STOCK] Sin productos con stock para '{vendor}'", flush=True)
            return

        # Extraer set de SKUs del vendor para optimizar fase 2
        vendor_skus = {v["sku"] for v in vendor_variants if v["sku"]}

        # Fase 2: SKUs vendidos
        _job["phase"] = "sales"
        print(f"[DEAD-STOCK] === FASE 2: Ventas ultimos {days} dias ===", flush=True)
        sold_skus = _fetch_sold_skus(days)

        # Fase 3: Cruce y Excel
        _job["phase"] = "processing"
        print("[DEAD-STOCK] === FASE 3: Cruzando datos y generando Excel ===", flush=True)

        # Filtrar: variantes con stock que NO tienen ventas
        dead_rows = []
        for v in vendor_variants:
            sku = v["sku"]
            # Si no tiene SKU, no podemos verificar ventas — incluir como dead stock
            if not sku or sku not in sold_skus:
                dead_rows.append(v)

        # Ordenar por sede, luego por stock descendente
        dead_rows.sort(key=lambda r: (r["location"], -r["stock"]))

        total_variants = len(vendor_variants)
        dead_count = len(dead_rows)
        dead_units = sum(r["stock"] for r in dead_rows)
        total_units = sum(v["stock"] for v in vendor_variants)
        dead_pct = round((dead_count / total_variants) * 100, 1) if total_variants > 0 else 0

        # Generar Excel
        excel_b64 = _generate_excel(dead_rows, vendor, days) if dead_rows else None

        _job["result"] = {
            "vendor": vendor,
            "days_without_sales": days,
            "min_product_age_months": min_age_months,
            "total_variants_with_stock": total_variants,
            "total_units": total_units,
            "dead_stock_variants": dead_count,
            "dead_stock_units": dead_units,
            "dead_stock_pct": dead_pct,
            "excel_base64": excel_b64,
            "fecha_calculo": datetime.now().isoformat(),
        }
        _job["error"] = None

        print(
            f"[DEAD-STOCK] Completado: {dead_count}/{total_variants} variantes sin ventas "
            f"({dead_units} unidades, {dead_pct}%)",
            flush=True,
        )

    except Exception as e:
        _job["error"] = str(e)
        print(f"[DEAD-STOCK] Error: {e}", flush=True)
    finally:
        _job["running"] = False
        _job["phase"] = None


# -- Endpoints -----------------------------------------------------------

@router.post("/start")
def start_dead_stock(req: DeadStockRequest):
    """
    Inicia analisis de stock muerto para un proveedor en background.
    Consultar GET /status para ver progreso y resultados.
    """
    with _job_lock:
        if _job["running"]:
            return {
                "success": False,
                "error": "Ya hay un analisis en progreso",
                "phase": _job["phase"],
            }

        _job["running"] = True
        _job["error"] = None
        _job["result"] = None
        _job["started_at"] = datetime.now().isoformat()

    thread = threading.Thread(
        target=_dead_stock_worker,
        args=(req.vendor, req.days_without_sales, req.min_product_age_months),
        daemon=True,
    )
    thread.start()

    return {
        "success": True,
        "message": f"Analisis iniciado para '{req.vendor}' ({req.days_without_sales} dias, productos >{req.min_product_age_months} meses)",
    }


@router.get("/status")
def dead_stock_status():
    """Retorna el estado del analisis y los resultados si estan listos."""
    return {
        "running": _job["running"],
        "phase": _job["phase"],
        "error": _job["error"],
        "started_at": _job["started_at"],
        "result": _job["result"],
    }
