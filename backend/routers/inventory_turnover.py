"""
Router: Rotación de Inventario por Sede
Endpoints:
  POST /api/turnover/start   → Inicia cálculo (background)
  GET  /api/turnover/status  → Estado y resultados
"""

import json
import threading
import time
import requests
from datetime import datetime, timedelta

from fastapi import APIRouter

from config import settings
from services import shopify_service

router = APIRouter(prefix="/api/turnover", tags=["Inventory Turnover"])

# ── Estado global del job ───────────────────────────────────────────

_job_lock = threading.Lock()
_job: dict = {
    "running": False,
    "phase": None,       # "inventory" | "bulk_start" | "bulk_poll" | "processing"
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


# ── Helpers ─────────────────────────────────────────────────────────

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


def _get_inventory_per_location(locations: dict[str, str]) -> dict[str, dict]:
    """Inventario actual por sede: {name: {total_units, total_cost, product_count}}"""
    results = {}

    for loc_name, loc_gid in locations.items():
        total_units = 0
        total_cost = 0.0
        product_count = 0
        has_next = True
        cursor = None

        while has_next:
            after = f', after: "{cursor}"' if cursor else ""
            query = f"""
            {{
              location(id: "{loc_gid}") {{
                inventoryLevels(first: 250{after}) {{
                  edges {{
                    node {{
                      quantities(names: ["available"]) {{
                        name
                        quantity
                      }}
                      item {{
                        id
                        unitCost {{
                          amount
                        }}
                      }}
                    }}
                    cursor
                  }}
                  pageInfo {{
                    hasNextPage
                  }}
                }}
              }}
            }}
            """
            try:
                data = _gql(query)
                levels = data["location"]["inventoryLevels"]

                for edge in levels["edges"]:
                    node = edge["node"]
                    qty = 0
                    for q in node.get("quantities", []):
                        if q["name"] == "available":
                            qty = q["quantity"]
                            break

                    if qty > 0:
                        product_count += 1
                        total_units += qty
                        cost = node.get("item", {}).get("unitCost", {})
                        if cost and cost.get("amount"):
                            total_cost += float(cost["amount"]) * qty

                    cursor = edge["cursor"]

                has_next = levels["pageInfo"]["hasNextPage"]
                time.sleep(0.3)

            except Exception as e:
                print(f"[TURNOVER] Error inventory {loc_name}: {e}", flush=True)
                has_next = False

        results[loc_name] = {
            "total_units": total_units,
            "total_cost": round(total_cost, 2),
            "product_count": product_count,
        }
        print(f"[TURNOVER] {loc_name}: {total_units} units, {product_count} SKUs, ${total_cost:,.0f}", flush=True)

    return results


def _start_sales_bulk(months: int) -> str | None:
    """Lanza bulk operation para ventas con fulfillment location. Retorna op ID."""
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
                      variant {
                        inventoryItem {
                          unitCost {
                            amount
                          }
                        }
                      }
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
        raise RuntimeError(f"GraphQL: {body['errors']}")

    result = body.get("data", {}).get("bulkOperationRunQuery", {})
    errors = result.get("userErrors", [])
    if errors:
        raise RuntimeError(f"User errors: {errors}")

    return result.get("bulkOperation", {}).get("id")


def _poll_bulk(max_wait: int = 600) -> str | None:
    """Espera bulk operation y retorna URL de descarga."""
    query = "{ currentBulkOperation { id status errorCode objectCount url } }"
    start = time.time()

    while time.time() - start < max_wait:
        try:
            data = _gql(query)
            op = data.get("currentBulkOperation")
            if not op:
                return None

            status = op.get("status")
            if status == "COMPLETED":
                return op.get("url")
            elif status in ("FAILED", "CANCELED"):
                raise RuntimeError(f"Bulk operation {status}: {op.get('errorCode')}")
        except RuntimeError:
            raise
        except Exception:
            pass

        time.sleep(5)

    raise RuntimeError(f"Bulk operation timeout ({max_wait}s)")


def _process_sales_jsonl(url: str, locations: dict[str, str]) -> dict[str, dict]:
    """Descarga JSONL y calcula ventas por sede."""
    sales = {name: {"total_units_sold": 0, "total_cogs": 0.0, "sku_count": 0, "_skus": set()}
             for name in locations}

    resp = requests.get(url, timeout=120, stream=True)
    lines = []
    for line in resp.iter_lines():
        if line:
            try:
                lines.append(json.loads(line.decode("utf-8")))
            except json.JSONDecodeError:
                continue

    # Bulk JSONL flatten: objetos con __parentId
    objects_by_id = {}

    for obj in lines:
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
            cost_data = (obj.get("variant") or {}).get("inventoryItem", {}).get("unitCost", {})
            unit_cost = float(cost_data.get("amount", 0)) if cost_data else 0

            if parent_id in objects_by_id:
                objects_by_id[parent_id]["items"].append(
                    {"sku": sku, "quantity": qty, "unit_cost": unit_cost}
                )

    # Agregar por sede — usar la primera location que matchee una sede objetivo
    for order_data in objects_by_id.values():
        order_locations = order_data.get("locations", [])
        if not order_locations:
            continue

        # Buscar la primera sede que matchee un target
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
                sales[matched]["total_cogs"] += item["unit_cost"] * item["quantity"]
                sales[matched]["_skus"].add(item["sku"])

    # Convertir sets a counts
    for loc in sales:
        sales[loc]["sku_count"] = len(sales[loc]["_skus"])
        sales[loc]["total_cogs"] = round(sales[loc]["total_cogs"], 2)
        del sales[loc]["_skus"]

    return sales


def _build_result(
    locations: dict[str, str],
    inventory: dict[str, dict],
    sales: dict[str, dict],
    months: int,
) -> dict:
    """Construye resultado final con rotación por sede."""
    rows = []
    for loc_name in locations:
        inv = inventory.get(loc_name, {})
        sal = sales.get(loc_name, {})

        inv_units = inv.get("total_units", 0)
        inv_cost = inv.get("total_cost", 0)
        sold_units = sal.get("total_units_sold", 0)
        cogs = sal.get("total_cogs", 0)
        sku_count = inv.get("product_count", 0)

        turnover = round(sold_units / inv_units, 2) if inv_units > 0 else None
        cost_turnover = round(cogs / inv_cost, 2) if inv_cost > 0 else None
        days_of_inv = round((inv_units / sold_units) * (months * 30)) if sold_units > 0 else None

        rows.append({
            "sede": loc_name,
            "inventario_unidades": inv_units,
            "inventario_valor": inv_cost,
            "inventario_skus": sku_count,
            "vendidas_unidades": sold_units,
            "vendidas_cogs": cogs,
            "vendidas_skus": sal.get("sku_count", 0),
            "rotacion": turnover,
            "rotacion_costo": cost_turnover,
            "dias_inventario": days_of_inv,
        })

    # Totales
    total_inv = sum(r["inventario_unidades"] for r in rows)
    total_cost = sum(r["inventario_valor"] for r in rows)
    total_sold = sum(r["vendidas_unidades"] for r in rows)
    total_cogs = sum(r["vendidas_cogs"] for r in rows)

    return {
        "periodo_meses": months,
        "fecha_calculo": datetime.now().isoformat(),
        "sedes": rows,
        "totales": {
            "inventario_unidades": total_inv,
            "inventario_valor": round(total_cost, 2),
            "vendidas_unidades": total_sold,
            "vendidas_cogs": round(total_cogs, 2),
            "rotacion": round(total_sold / total_inv, 2) if total_inv > 0 else None,
            "rotacion_costo": round(total_cogs / total_cost, 2) if total_cost > 0 else None,
            "dias_inventario": round((total_inv / total_sold) * (months * 30)) if total_sold > 0 else None,
        },
    }


# ── Background worker ──────────────────────────────────────────────

def _turnover_worker(months: int):
    """Ejecuta todo el cálculo en background."""
    try:
        # Fase 1: Locations
        _job["phase"] = "locations"
        locations = _get_target_locations()
        if not locations:
            raise RuntimeError("No se encontraron sedes objetivo en Shopify")
        print(f"[TURNOVER] Sedes: {list(locations.keys())}", flush=True)

        # Fase 2: Inventario actual
        _job["phase"] = "inventory"
        inventory = _get_inventory_per_location(locations)

        # Fase 3: Bulk operation de ventas
        _job["phase"] = "bulk_start"
        op_id = _start_sales_bulk(months)
        print(f"[TURNOVER] Bulk operation started: {op_id}", flush=True)

        _job["phase"] = "bulk_poll"
        url = _poll_bulk(max_wait=600)
        if not url:
            raise RuntimeError("Bulk operation no retorno URL de descarga")

        # Fase 4: Procesar resultados
        _job["phase"] = "processing"
        sales = _process_sales_jsonl(url, locations)

        for loc, data in sales.items():
            print(f"[TURNOVER] Ventas {loc}: {data['total_units_sold']} unidades", flush=True)

        # Fase 5: Calcular rotación
        _job["result"] = _build_result(locations, inventory, sales, months)
        _job["error"] = None
        print("[TURNOVER] Calculo completado", flush=True)

    except Exception as e:
        _job["error"] = str(e)
        print(f"[TURNOVER] Error: {e}", flush=True)
    finally:
        _job["running"] = False
        _job["phase"] = None


# ── Endpoints ───────────────────────────────────────────────────────

@router.post("/start")
def start_turnover(months: int = 12):
    """
    Inicia el calculo de rotacion de inventario en background.
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
