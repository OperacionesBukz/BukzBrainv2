"""
Router: Sincronización de pedidos Shopify → Celesa Seguimiento
Endpoints:
  POST /api/celesa-sync/fetch   -> Busca pedidos nuevos en Shopify (location Dropshipping [España])
  GET  /api/celesa-sync/status  -> Estado del job de búsqueda
  POST /api/celesa-sync/import  -> Importa pedidos seleccionados a Firestore celesa_orders
"""

import threading
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from pydantic import BaseModel

from services.celesa_common import gql, DROPSHIPPING_LOCATION_NAME
from services.firebase_service import get_firestore_db

router = APIRouter(prefix="/api/celesa-sync", tags=["Celesa Sync"])

# -- Job state ---------------------------------------------------------------

_job_lock = threading.Lock()
_job: dict = {
    "running": False,
    "phase": None,
    "error": None,
    "orders": None,
    "summary": None,
}


def _set_job(**kwargs):
    with _job_lock:
        _job.update(kwargs)


# -- Firestore helpers -------------------------------------------------------

def _get_existing_order_numbers() -> set[str]:
    """Retorna set de numeroPedido ya existentes en celesa_orders."""
    db = get_firestore_db()
    docs = db.collection("celesa_orders").select(["numeroPedido"]).stream()
    return {doc.to_dict().get("numeroPedido", "") for doc in docs}


def _get_cutoff_date(existing_numbers: set[str]) -> str:
    """Determina la fecha de corte para la query a Shopify.

    Busca la fecha más reciente entre los pedidos existentes y resta 7 días
    como margen de seguridad. Si no hay pedidos, usa 90 días atrás.
    """
    if not existing_numbers:
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)
        return cutoff.strftime("%Y-%m-%dT00:00:00Z")

    db = get_firestore_db()
    docs = (
        db.collection("celesa_orders")
        .order_by("fechaPedido", direction="DESCENDING")
        .limit(1)
        .stream()
    )
    latest_date = None
    for doc in docs:
        latest_date = doc.to_dict().get("fechaPedido")

    if latest_date:
        try:
            dt = datetime.strptime(latest_date, "%Y-%m-%d")
            dt = dt - timedelta(days=7)
            return dt.strftime("%Y-%m-%dT00:00:00Z")
        except ValueError:
            pass

    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    return cutoff.strftime("%Y-%m-%dT00:00:00Z")


# -- Shopify query -----------------------------------------------------------

# Single query with small page size to stay under Shopify's 1000-point budget
# Cost: 5 orders × 5 fulfillmentOrders × 20 lineItems = 500 points max
ORDERS_QUERY = """
{
  orders(first: 5, query: "fulfillment_status:unfulfilled created_at:>=%s"%s) {
    edges {
      node {
        name
        createdAt
        customer {
          displayName
        }
        fulfillmentOrders(first: 5) {
          edges {
            node {
              assignedLocation {
                name
              }
              lineItems(first: 20) {
                edges {
                  node {
                    totalQuantity
                    lineItem {
                      sku
                      title
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
"""


def _fetch_dropshipping_orders(cutoff_date: str, existing_numbers: set[str]) -> list[dict]:
    """Pagina órdenes no preparadas y extrae las de Dropshipping [España]."""
    all_orders: list[dict] = []
    cursor = None
    pages = 0
    checked = 0
    found_ds = 0

    while pages < 200:
        pages += 1
        after_clause = f', after: "{cursor}"' if cursor else ""
        query_str = ORDERS_QUERY % (cutoff_date, after_clause)

        if pages > 1:
            time.sleep(0.5)

        _set_job(phase=f"Buscando pedidos Dropshipping [España] (revisadas: {checked}, encontradas: {found_ds})...")
        data = gql(query_str, timeout=60)

        edges = data.get("orders", {}).get("edges", [])
        page_info = data.get("orders", {}).get("pageInfo", {})

        for edge in edges:
            node = edge["node"]
            order_name = node.get("name", "")
            checked += 1

            if order_name in existing_numbers:
                continue

            customer_name = (node.get("customer") or {}).get("displayName", "")
            created_at = node.get("createdAt", "")
            order_date = ""
            if created_at:
                try:
                    dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                    order_date = dt.strftime("%Y-%m-%d")
                except ValueError:
                    order_date = created_at[:10]

            for fo_edge in node.get("fulfillmentOrders", {}).get("edges", []):
                fo_node = fo_edge["node"]
                location_name = (fo_node.get("assignedLocation") or {}).get("name", "")

                if location_name != DROPSHIPPING_LOCATION_NAME:
                    continue

                for li_edge in fo_node.get("lineItems", {}).get("edges", []):
                    li_node = li_edge["node"]
                    qty = li_node.get("totalQuantity", 1)
                    line_item = li_node.get("lineItem") or {}
                    sku = line_item.get("sku", "")
                    title = line_item.get("title", "")

                    if not title:
                        continue

                    found_ds += 1
                    for _ in range(qty):
                        all_orders.append({
                            "numeroPedido": order_name,
                            "cliente": customer_name,
                            "producto": title,
                            "isbn": sku,
                            "fechaPedido": order_date,
                        })

        if not page_info.get("hasNextPage"):
            break
        cursor = page_info.get("endCursor")

    print(f"[CELESA-SYNC] Revisadas {checked} órdenes, encontradas {found_ds} de Dropshipping [España]", flush=True)
    return all_orders


# -- Background worker -------------------------------------------------------

def _run_fetch(existing_numbers: set[str], cutoff_date: str):
    """Background worker: consulta Shopify y filtra pedidos nuevos."""
    try:
        _set_job(phase="Consultando Shopify...")
        orders = _fetch_dropshipping_orders(cutoff_date, existing_numbers)

        # Deduplicate: same order+product should not appear twice
        seen = set()
        unique_orders = []
        for o in orders:
            key = (o["numeroPedido"], o["producto"], o["isbn"])
            if key not in seen:
                seen.add(key)
                unique_orders.append(o)

        _set_job(
            running=False,
            phase=None,
            orders=unique_orders,
            summary={
                "found": len(unique_orders),
                "existing_in_firestore": len(existing_numbers),
            },
        )
        print(
            f"[CELESA-SYNC] Encontrados {len(unique_orders)} pedidos nuevos "
            f"(excluidos {len(existing_numbers)} existentes)",
            flush=True,
        )
    except Exception as e:
        _set_job(running=False, phase=None, error=str(e))
        print(f"[CELESA-SYNC] Error: {e}", flush=True)


# -- Endpoints ---------------------------------------------------------------

@router.post("/fetch")
def fetch_new_orders():
    """Busca pedidos nuevos en Shopify con location Dropshipping [España]."""
    with _job_lock:
        if _job["running"]:
            return {"success": False, "message": "Ya hay una búsqueda en curso"}
        _job.update({
            "running": True,
            "phase": "Obteniendo pedidos existentes...",
            "error": None,
            "orders": None,
            "summary": None,
        })

    # Get existing orders before spawning thread
    try:
        existing = _get_existing_order_numbers()
        cutoff = _get_cutoff_date(existing)
    except Exception as e:
        _set_job(running=False, phase=None, error=f"Error accediendo Firestore: {e}")
        return {"success": False, "message": str(e)}

    threading.Thread(target=_run_fetch, args=(existing, cutoff), daemon=True).start()
    return {"success": True, "message": "Buscando pedidos en Shopify..."}


@router.get("/status")
def get_status():
    """Estado actual del job de búsqueda."""
    with _job_lock:
        return {
            "running": _job["running"],
            "phase": _job["phase"],
            "error": _job["error"],
            "orders": _job["orders"],
            "summary": _job["summary"],
        }


class OrderToImport(BaseModel):
    numeroPedido: str
    cliente: str
    producto: str
    isbn: str
    fechaPedido: str


class ImportRequest(BaseModel):
    orders: list[OrderToImport]
    createdBy: str = "sync-shopify"


@router.post("/import")
def import_orders(req: ImportRequest):
    """Importa pedidos seleccionados a Firestore celesa_orders."""
    if not req.orders:
        return {"success": False, "message": "No hay pedidos para importar", "imported": 0}

    db = get_firestore_db()
    batch = db.batch()
    count = 0

    for order in req.orders:
        ref = db.collection("celesa_orders").document()
        batch.set(ref, {
            "numeroPedido": order.numeroPedido,
            "cliente": order.cliente,
            "producto": order.producto,
            "isbn": order.isbn,
            "fechaPedido": order.fechaPedido,
            "estado": "Pendiente",
            "createdBy": req.createdBy,
            "createdAt": SERVER_TIMESTAMP,
            "updatedAt": SERVER_TIMESTAMP,
        })
        count += 1

        # Firestore batch limit is 500
        if count % 500 == 0:
            batch.commit()
            batch = db.batch()

    if count % 500 != 0:
        batch.commit()

    print(f"[CELESA-SYNC] Importados {count} pedidos a celesa_orders", flush=True)
    return {"success": True, "message": f"{count} pedidos importados", "imported": count}
