"""
Router: Rotacion de Inventario por Sede
Endpoints:
  POST /api/turnover/start   -> Inicia calculo (background)
  GET  /api/turnover/status  -> Estado y resultados

Optimizado: usa 2 Bulk Operations en paralelo (inventario + ventas).
Requiere API version 2026-01+ para bulk ops concurrentes.
"""

import json
import threading
import time
import requests
from datetime import datetime, timedelta

from fastapi import APIRouter

from config import settings

router = APIRouter(prefix="/api/turnover", tags=["Inventory Turnover"])

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


# -- Helpers -------------------------------------------------------------

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


def _get_target_locations() -> dict[str, str]:
    """Retorna {name: gid} para las sedes objetivo."""
    data = _gql("{ locations(first: 50) { edges { node { id name } } } }")
    all_locs = {e["node"]["name"]: e["node"]["id"] for e in data["locations"]["edges"]}

    found = {}
    for name in TARGET_LOCATIONS:
        if name in all_locs:
            found[name] = all_locs[name]
        else:
            match = next((k for k in all_locs if name.lower() in k.lower()), None)
            if match:
                found[match] = all_locs[match]

    return found


# -- Bulk Operation: Inventario ------------------------------------------

def _start_inventory_bulk() -> str | None:
    """Lanza bulk operation para inventario completo con locations."""
    mutation = """
    mutation {
      bulkOperationRunQuery(
        query: \"\"\"
        {
          inventoryItems {
            edges {
              node {
                id
                sku
                variant {
                  id
                  product {
                    id
                    title
                  }
                }
                inventoryLevels {
                  edges {
                    node {
                      location {
                        id
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
        \"\"\"
      ) {
        bulkOperation { id status }
        userErrors { field message }
      }
    }
    """
    resp = requests.post(
        settings.get_graphql_url(),
        json={"query": mutation},
        headers=settings.get_shopify_headers(),
        timeout=30,
    )
    body = resp.json()

    if "errors" in body:
        raise RuntimeError(f"GraphQL inventory bulk: {body['errors']}")

    result = body.get("data", {}).get("bulkOperationRunQuery", {})
    errors = result.get("userErrors", [])
    if errors:
        raise RuntimeError(f"Inventory bulk user errors: {errors}")

    op_id = result.get("bulkOperation", {}).get("id")
    print(f"[TURNOVER] Inventory bulk op started: {op_id}", flush=True)
    return op_id


def _process_inventory_jsonl(url: str, locations: dict[str, str]) -> dict[str, dict]:
    """Descarga JSONL de inventario y suma por sede."""
    loc_names = set(locations.keys())
    inventory = {name: {"total_units": 0, "product_count": 0} for name in loc_names}

    resp = requests.get(url, timeout=180, stream=True)

    # Mapear inventoryItem -> sku (para contar SKUs unicos por sede)
    # En JSONL flat: InventoryItem tiene sku, InventoryLevel tiene __parentId -> InventoryItem
    items_seen = {}  # item_gid -> sku

    for line in resp.iter_lines():
        if not line:
            continue
        try:
            obj = json.loads(line.decode("utf-8"))
        except json.JSONDecodeError:
            continue

        obj_id = obj.get("id", "")
        parent_id = obj.get("__parentId", "")

        # InventoryItem row
        if "gid://shopify/InventoryItem/" in obj_id and "InventoryLevel" not in obj_id:
            items_seen[obj_id] = obj.get("sku", "")

        # InventoryLevel row (child of InventoryItem)
        elif "gid://shopify/InventoryLevel/" in obj_id:
            loc_data = obj.get("location", {})
            loc_name = loc_data.get("name", "")

            if loc_name not in loc_names:
                continue

            qty = 0
            for q in obj.get("quantities", []):
                if q.get("name") == "available":
                    qty = q.get("quantity", 0)
                    break

            if qty > 0:
                inventory[loc_name]["total_units"] += qty
                inventory[loc_name]["product_count"] += 1

    for name, data in inventory.items():
        print(f"[TURNOVER] Inventario {name}: {data['total_units']} unidades, {data['product_count']} SKUs", flush=True)

    return inventory


# -- Bulk Operation: Ventas ----------------------------------------------

def _start_sales_bulk(months: int) -> str | None:
    """Lanza bulk operation para ventas con fulfillment location."""
    date_start = (datetime.now() - timedelta(days=months * 30)).strftime("%Y-%m-%dT00:00:00Z")

    mutation = """
    mutation {
      bulkOperationRunQuery(
        query: \"\"\"
        {
          orders(query: "created_at:>=%s AND financial_status:paid") {
            edges {
              node {
                id
                lineItems {
                  edges {
                    node {
                      sku
                      quantity
                    }
                  }
                }
                fulfillmentOrders {
                  edges {
                    node {
                      assignedLocation {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
        \"\"\"
      ) {
        bulkOperation { id status }
        userErrors { field message }
      }
    }
    """ % date_start

    resp = requests.post(
        settings.get_graphql_url(),
        json={"query": mutation},
        headers=settings.get_shopify_headers(),
        timeout=30,
    )
    body = resp.json()

    if "errors" in body:
        raise RuntimeError(f"GraphQL sales bulk: {body['errors']}")

    result = body.get("data", {}).get("bulkOperationRunQuery", {})
    errors = result.get("userErrors", [])
    if errors:
        raise RuntimeError(f"Sales bulk user errors: {errors}")

    op_id = result.get("bulkOperation", {}).get("id")
    print(f"[TURNOVER] Sales bulk op started: {op_id}", flush=True)
    return op_id


def _poll_bulk_by_id(op_id: str, label: str, max_wait: int = 600) -> str | None:
    """Espera una bulk operation especifica y retorna URL de descarga."""
    # Intentar primero con node query (funciona en 2026-01+)
    # Fallback a currentBulkOperation si no soporta node query
    query_by_id = '{ node(id: "%s") { ... on BulkOperation { id status errorCode objectCount url } } }' % op_id
    query_current = "{ currentBulkOperation { id status errorCode objectCount url } }"

    start = time.time()
    use_node_query = True

    while time.time() - start < max_wait:
        try:
            if use_node_query:
                try:
                    data = _gql(query_by_id)
                    op = data.get("node")
                except Exception:
                    # node query no soportada — fallback a currentBulkOperation
                    use_node_query = False
                    data = _gql(query_current)
                    op = data.get("currentBulkOperation")
            else:
                data = _gql(query_current)
                op = data.get("currentBulkOperation")

            if not op:
                time.sleep(3)
                continue

            status = op.get("status")
            count = op.get("objectCount", 0)
            print(f"\r[TURNOVER] {label}: {status} ({count} objects)     ", end="", flush=True)

            if status == "COMPLETED":
                print(flush=True)
                return op.get("url")
            elif status in ("FAILED", "CANCELED"):
                print(flush=True)
                raise RuntimeError(f"{label} bulk op {status}: {op.get('errorCode')}")

        except RuntimeError:
            raise
        except Exception:
            pass

        time.sleep(5)

    raise RuntimeError(f"{label} bulk operation timeout ({max_wait}s)")


def _process_sales_jsonl(url: str, locations: dict[str, str]) -> dict[str, dict]:
    """Descarga JSONL y calcula ventas por sede (solo unidades)."""
    sales = {name: {"total_units_sold": 0, "sku_count": 0, "_skus": set()}
             for name in locations}

    resp = requests.get(url, timeout=180, stream=True)
    objects_by_id = {}

    for line in resp.iter_lines():
        if not line:
            continue
        try:
            obj = json.loads(line.decode("utf-8"))
        except json.JSONDecodeError:
            continue

        obj_id = obj.get("id", "")
        parent_id = obj.get("__parentId", "")

        if "gid://shopify/Order/" in obj_id and "LineItem" not in obj_id and "FulfillmentOrder" not in obj_id:
            objects_by_id[obj_id] = {"items": [], "locations": []}

        elif "gid://shopify/FulfillmentOrder/" in obj_id:
            loc_name = obj.get("assignedLocation", {}).get("name", "")
            if parent_id in objects_by_id and loc_name:
                objects_by_id[parent_id]["locations"].append(loc_name)

        elif "sku" in obj:
            sku = str(obj.get("sku", "")).strip()
            qty = obj.get("quantity", 0)
            if parent_id in objects_by_id:
                objects_by_id[parent_id]["items"].append({"sku": sku, "quantity": qty})

    # Agregar por sede
    for order_data in objects_by_id.values():
        order_locations = order_data.get("locations", [])
        if not order_locations:
            continue

        matched = None
        for loc in order_locations:
            for target in locations:
                if target.lower() in loc.lower() or loc.lower() in target.lower():
                    matched = target
                    break
            if matched:
                break
        if not matched:
            continue

        for item in order_data.get("items", []):
            if item["sku"]:
                sales[matched]["total_units_sold"] += item["quantity"]
                sales[matched]["_skus"].add(item["sku"])

    for loc in sales:
        sales[loc]["sku_count"] = len(sales[loc]["_skus"])
        del sales[loc]["_skus"]

    return sales


# -- Result builder ------------------------------------------------------

def _build_result(
    locations: dict[str, str],
    inventory: dict[str, dict],
    sales: dict[str, dict],
    months: int,
) -> dict:
    rows = []
    for loc_name in locations:
        inv = inventory.get(loc_name, {})
        sal = sales.get(loc_name, {})

        inv_units = inv.get("total_units", 0)
        sold_units = sal.get("total_units_sold", 0)
        sku_count = inv.get("product_count", 0)

        turnover = round(sold_units / inv_units, 2) if inv_units > 0 else None
        days_of_inv = round((inv_units / sold_units) * (months * 30)) if sold_units > 0 else None

        rows.append({
            "sede": loc_name,
            "inventario_unidades": inv_units,
            "inventario_skus": sku_count,
            "vendidas_unidades": sold_units,
            "vendidas_skus": sal.get("sku_count", 0),
            "rotacion": turnover,
            "dias_inventario": days_of_inv,
        })

    total_inv = sum(r["inventario_unidades"] for r in rows)
    total_sold = sum(r["vendidas_unidades"] for r in rows)

    return {
        "periodo_meses": months,
        "fecha_calculo": datetime.now().isoformat(),
        "sedes": rows,
        "totales": {
            "inventario_unidades": total_inv,
            "vendidas_unidades": total_sold,
            "rotacion": round(total_sold / total_inv, 2) if total_inv > 0 else None,
            "dias_inventario": round((total_inv / total_sold) * (months * 30)) if total_sold > 0 else None,
        },
    }


# -- Background worker ---------------------------------------------------

def _run_inventory_pipeline(locations: dict[str, str]) -> dict[str, dict]:
    """Lanza bulk op de inventario, pollea, procesa JSONL."""
    op_id = _start_inventory_bulk()
    url = _poll_bulk_by_id(op_id, "Inventario", max_wait=600)
    if not url:
        raise RuntimeError("Inventory bulk op no retorno URL")
    return _process_inventory_jsonl(url, locations)


def _run_sales_pipeline(months: int, locations: dict[str, str]) -> dict[str, dict]:
    """Lanza bulk op de ventas, pollea, procesa JSONL."""
    op_id = _start_sales_bulk(months)
    url = _poll_bulk_by_id(op_id, "Ventas", max_wait=600)
    if not url:
        raise RuntimeError("Sales bulk op no retorno URL")
    return _process_sales_jsonl(url, locations)


def _turnover_worker(months: int):
    """Ejecuta calculo secuencial: inventario bulk op, luego ventas bulk op."""
    try:
        # Fase 1: Locations
        _job["phase"] = "locations"
        locations = _get_target_locations()
        if not locations:
            raise RuntimeError("No se encontraron sedes objetivo en Shopify")
        print(f"[TURNOVER] Sedes: {list(locations.keys())}", flush=True)

        # Fase 2: Bulk op inventario
        _job["phase"] = "inventory"
        print("[TURNOVER] === FASE INVENTARIO ===", flush=True)
        inventory = _run_inventory_pipeline(locations)
        total_inv = sum(v["total_units"] for v in inventory.values())
        total_skus = sum(v["product_count"] for v in inventory.values())
        print(f"[TURNOVER] Inventario total: {total_inv} unidades, {total_skus} SKUs", flush=True)

        # Fase 3: Bulk op ventas (secuencial — Shopify solo permite 1 bulk query a la vez)
        _job["phase"] = "sales"
        print(f"[TURNOVER] === FASE VENTAS ({months} meses) ===", flush=True)
        sales = _run_sales_pipeline(months, locations)
        total_sold = sum(v["total_units_sold"] for v in sales.values())
        print(f"[TURNOVER] Ventas total: {total_sold} unidades", flush=True)

        # Fase 4: Calcular rotacion
        _job["phase"] = "processing"
        _job["result"] = _build_result(locations, inventory, sales, months)
        _job["error"] = None
        print("[TURNOVER] Calculo completado", flush=True)

    except Exception as e:
        _job["error"] = str(e)
        print(f"[TURNOVER] Error: {e}", flush=True)
    finally:
        _job["running"] = False
        _job["phase"] = None


# -- Endpoints -----------------------------------------------------------

@router.post("/start")
def start_turnover(months: int = 12):
    """
    Inicia el calculo de rotacion de inventario en background.
    Usa 2 bulk operations en paralelo (inventario + ventas).
    Consultar GET /status para ver progreso y resultados.
    """
    with _job_lock:
        if _job["running"]:
            return {"success": True, "message": "Ya hay un calculo en progreso", "phase": _job["phase"]}

        _job["running"] = True
        _job["error"] = None
        _job["result"] = None
        _job["started_at"] = datetime.now().isoformat()

    thread = threading.Thread(target=_turnover_worker, args=(months,), daemon=True)
    thread.start()

    return {"success": True, "message": f"Calculo de rotacion iniciado ({months} meses)"}


@router.get("/status")
def turnover_status():
    """Retorna el estado del calculo y los resultados si estan listos."""
    return {
        "running": _job["running"],
        "phase": _job["phase"],
        "error": _job["error"],
        "started_at": _job["started_at"],
        "result": _job["result"],
    }
