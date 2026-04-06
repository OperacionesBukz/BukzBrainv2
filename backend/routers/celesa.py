"""
Router: Actualización de Inventario Celesa (Dropshipping España)
Endpoints:
  POST /api/celesa/start    -> Inicia comparación Azeta vs Shopify (background)
  GET  /api/celesa/status   -> Estado y diferencias encontradas
  POST /api/celesa/apply    -> Aplica cambios a Shopify

Usa queries GraphQL paginadas para consultar inventario de vendor 'Bukz España'.
"""

import os
import threading
import time
import requests as http_requests

from fastapi import APIRouter

from config import settings
from services.shopify_service import _throttler

router = APIRouter(prefix="/api/celesa", tags=["Celesa Inventory"])

# -- Config ------------------------------------------------------------------

AZETA_URL = os.getenv(
    "AZETA_URL",
    "http://www.azetadistribuciones.es/servicios_web/stock.php"
    "?fr_usuario=861549&fr_clave=Bukz549",
)
DROPSHIPPING_LOCATION_NAME = "Dropshipping [España]"
VENDOR_FILTER = "Bukz España"

# -- Estado global del job --------------------------------------------------

_job_lock = threading.Lock()
_job: dict = {
    "running": False,
    "phase": None,
    "error": None,
    "differences": None,
    "location_gid": None,
    "started_at": None,
    "summary": None,
    "shopify_progress": None,
    # Apply state
    "applying": False,
    "apply_phase": None,
    "apply_error": None,
    "apply_result": None,
}


def _set_job(**kwargs):
    with _job_lock:
        _job.update(kwargs)


# -- GraphQL helper ----------------------------------------------------------

def _gql(query: str, variables: dict | None = None, timeout: int = 30, _retries: int = 3) -> dict:
    _throttler.wait_if_needed()
    payload: dict = {"query": query}
    if variables:
        payload["variables"] = variables
    resp = http_requests.post(
        settings.get_graphql_url(),
        json=payload,
        headers=settings.get_shopify_headers(),
        timeout=timeout,
    )
    _throttler.update_from_response(resp)
    if resp.status_code == 429:
        if _retries <= 0:
            resp.raise_for_status()
        retry_after = float(resp.headers.get("Retry-After", "2"))
        time.sleep(retry_after)
        return _gql(query, variables, timeout, _retries - 1)
    resp.raise_for_status()
    body = resp.json()
    if "errors" in body:
        is_throttled = any(
            e.get("extensions", {}).get("code") == "THROTTLED"
            for e in body["errors"]
        )
        if is_throttled:
            if _retries <= 0:
                raise RuntimeError("Shopify API throttled tras múltiples reintentos")
            time.sleep(2.0)
            return _gql(query, variables, timeout, _retries - 1)
        raise RuntimeError(f"GraphQL errors: {body['errors']}")
    return body["data"]


# -- Location ----------------------------------------------------------------

def _get_dropshipping_location() -> str:
    """Retorna el GID de la location 'Dropshipping [España]'."""
    data = _gql('{ locations(first: 250) { edges { node { id name } } } }')
    for edge in data["locations"]["edges"]:
        if edge["node"]["name"] == DROPSHIPPING_LOCATION_NAME:
            return edge["node"]["id"]
    raise RuntimeError(
        f"Location '{DROPSHIPPING_LOCATION_NAME}' no encontrada en Shopify"
    )


# -- Azeta -------------------------------------------------------------------

def _fetch_azeta_stock() -> dict[str, int]:
    """Descarga stock de Azeta. Retorna {sku: quantity}."""
    resp = http_requests.get(AZETA_URL, timeout=60)
    resp.raise_for_status()

    stock: dict[str, int] = {}
    for line in resp.text.strip().splitlines():
        line = line.strip()
        if not line or ";" not in line:
            continue
        parts = line.split(";", 1)
        sku = parts[0].strip()
        try:
            qty = int(parts[1].strip())
        except (ValueError, IndexError):
            continue
        if sku:
            stock[sku] = qty
    print(f"[CELESA] Azeta: {len(stock)} SKUs descargados", flush=True)
    if stock:
        sample = list(stock.items())[:3]
        print(f"[CELESA] Azeta sample: {sample}", flush=True)
    return stock


# -- Shopify Paginated Inventory Query ---------------------------------------

def _fetch_shopify_inventory(location_gid: str) -> list[dict]:
    """
    Fetch inventory for vendor 'Bukz España' at specific location
    using paginated GraphQL queries.
    Returns [{"sku", "title", "vendor", "available", "inventory_item_id"}, ...]
    """
    query = """
    query ($cursor: String, $locationId: ID!, $vendorQuery: String!) {
      products(first: 250, query: $vendorQuery, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            title
            vendor
            variants(first: 100) {
              edges {
                node {
                  sku
                  inventoryItem {
                    id
                    inventoryLevel(locationId: $locationId) {
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
    }
    """

    results: list[dict] = []
    cursor = None
    page = 0

    while True:
        with _job_lock:
            if not _job["running"]:
                raise RuntimeError("Cancelado por el usuario")

        page += 1
        variables: dict = {
            "locationId": location_gid,
            "vendorQuery": f"vendor:'{VENDOR_FILTER}'",
        }
        if cursor:
            variables["cursor"] = cursor

        data = _gql(query, variables, timeout=30)
        products = data["products"]

        for product_edge in products["edges"]:
            product = product_edge["node"]
            title = (product.get("title") or "").strip()
            vendor = (product.get("vendor") or "").strip()

            for variant_edge in (product.get("variants") or {}).get("edges", []):
                variant = variant_edge["node"]
                sku = (variant.get("sku") or "").strip()
                if not sku:
                    continue

                inv_item = variant.get("inventoryItem") or {}
                inv_item_id = inv_item.get("id")
                if not inv_item_id:
                    continue

                inv_level = inv_item.get("inventoryLevel")
                available = 0
                if inv_level:
                    for q in inv_level.get("quantities", []):
                        if q.get("name") == "available":
                            available = int(q.get("quantity") or 0)
                            break

                results.append({
                    "sku": sku,
                    "title": title,
                    "vendor": vendor,
                    "available": available,
                    "inventory_item_id": inv_item_id,
                })

        _set_job(
            phase="shopify",
            shopify_progress={"page": page, "products_fetched": len(results)},
        )
        print(f"[CELESA] Shopify página {page}: {len(results)} variantes acumuladas", flush=True)

        page_info = products["pageInfo"]
        if not page_info["hasNextPage"]:
            break
        cursor = page_info["endCursor"]

    print(f"[CELESA] Shopify total: {len(results)} variantes en {page} páginas", flush=True)
    return results


# -- Compare -----------------------------------------------------------------

def _compare(
    shopify_items: list[dict], azeta_stock: dict[str, int]
) -> list[dict]:
    """
    Cruza inventario Shopify con stock Azeta por SKU.
    Solo retorna items con diferencias.
    """
    differences: list[dict] = []
    matched_skus = 0
    for item in shopify_items:
        sku = item["sku"]
        if sku not in azeta_stock:
            continue
        matched_skus += 1
        azeta_qty = azeta_stock[sku]
        shopify_qty = item["available"]
        if shopify_qty != azeta_qty:
            differences.append({
                "sku": sku,
                "title": item["title"],
                "vendor": item["vendor"],
                "shopify_qty": shopify_qty,
                "azeta_qty": azeta_qty,
                "diff": azeta_qty - shopify_qty,
                "inventory_item_id": item["inventory_item_id"],
            })
    print(f"[CELESA] Compare: {len(shopify_items)} shopify items, {matched_skus} SKU matches con Azeta, {len(differences)} con diferencias", flush=True)
    if shopify_items and not matched_skus:
        shopify_sample = [i["sku"] for i in shopify_items[:5]]
        azeta_sample = list(azeta_stock.keys())[:5]
        print(f"[CELESA] SKU MISMATCH? Shopify sample: {shopify_sample}, Azeta sample: {azeta_sample}", flush=True)
    return differences


# -- Background worker: comparar --------------------------------------------

def _run_comparison():
    try:
        _set_job(phase="location", started_at=time.time())
        location_gid = _get_dropshipping_location()
        _set_job(location_gid=location_gid)

        _set_job(phase="azeta")
        azeta_stock = _fetch_azeta_stock()

        _set_job(phase="shopify", shopify_progress={"page": 0, "products_fetched": 0})
        shopify_items = _fetch_shopify_inventory(location_gid)

        _set_job(phase="comparing", shopify_progress=None)
        diffs = _compare(shopify_items, azeta_stock)
        diffs.sort(key=lambda d: abs(d["diff"]), reverse=True)

        with _job_lock:
            started_at = _job.get("started_at") or time.time()
        elapsed = time.time() - started_at
        summary = {
            "total_azeta_skus": len(azeta_stock),
            "total_shopify_items": len(shopify_items),
            "differences_found": len(diffs),
            "elapsed_seconds": round(elapsed, 1),
        }

        _set_job(
            running=False,
            phase=None,
            differences=diffs,
            summary=summary,
            shopify_progress=None,
        )
    except Exception as e:
        _set_job(running=False, phase=None, error=str(e), shopify_progress=None)


# -- Background worker: aplicar cambios ------------------------------------

def _run_apply():
    try:
        with _job_lock:
            diffs = _job.get("differences") or []
            location_gid = _job.get("location_gid")

        if not diffs or not location_gid:
            _set_job(applying=False, apply_error="No hay diferencias para aplicar")
            return

        total = len(diffs)
        applied = 0
        errors = []

        mutation = """
        mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
          inventorySetQuantities(input: $input) {
            inventoryAdjustmentGroup {
              createdAt
              reason
            }
            userErrors {
              field
              message
            }
          }
        }
        """

        batch_size = 100
        for i in range(0, total, batch_size):
            batch = diffs[i : i + batch_size]
            _set_job(apply_phase=f"Actualizando {min(i + batch_size, total)}/{total}...")

            quantities_input = []
            for d in batch:
                quantities_input.append({
                    "inventoryItemId": d["inventory_item_id"],
                    "locationId": location_gid,
                    "quantity": d["azeta_qty"],
                })

            variables = {
                "input": {
                    "name": "available",
                    "reason": "correction",
                    "ignoreCompareQuantity": True,
                    "quantities": quantities_input,
                }
            }

            try:
                data = _gql(mutation, variables, timeout=60)
                result_data = data.get("inventorySetQuantities", {})
                user_errors = result_data.get("userErrors", [])
                has_adjustment = result_data.get("inventoryAdjustmentGroup") is not None

                if user_errors:
                    for ue in user_errors:
                        errors.append(f"{ue.get('field')}: {ue.get('message')}")
                    if has_adjustment:
                        applied += len(batch) - len(user_errors)
                else:
                    applied += len(batch)
            except Exception as e:
                errors.append(f"Batch {i // batch_size + 1}: {e}")

        result = {
            "applied": max(applied, 0),
            "total": total,
            "errors": errors,
        }
        _set_job(
            applying=False,
            apply_phase=None,
            apply_result=result,
            apply_error=None if not errors else f"{len(errors)} errores",
        )
    except Exception as e:
        _set_job(applying=False, apply_phase=None, apply_error=str(e))


# -- Endpoints ---------------------------------------------------------------

@router.post("/start")
def start_comparison():
    with _job_lock:
        if _job["running"]:
            return {"success": False, "message": "Ya hay una comparación en curso"}
        _job.update({
            "running": True,
            "phase": "starting",
            "error": None,
            "differences": None,
            "location_gid": None,
            "summary": None,
            "shopify_progress": None,
            "applying": False,
            "apply_phase": None,
            "apply_error": None,
            "apply_result": None,
        })

    threading.Thread(target=_run_comparison, daemon=True).start()
    return {"success": True, "message": "Comparación iniciada"}


@router.get("/status")
def get_status():
    with _job_lock:
        return {
            "running": _job["running"],
            "phase": _job["phase"],
            "error": _job["error"],
            "summary": _job["summary"],
            "differences": _job["differences"],
            "shopify_progress": _job.get("shopify_progress"),
            "started_at": _job.get("started_at"),
            "applying": _job["applying"],
            "apply_phase": _job["apply_phase"],
            "apply_error": _job["apply_error"],
            "apply_result": _job["apply_result"],
        }


@router.post("/cancel")
def cancel_job():
    with _job_lock:
        _job.update({
            "running": False,
            "phase": None,
            "error": "Cancelado por el usuario",
            "applying": False,
            "apply_phase": None,
        })
    return {"success": True, "message": "Cancelado"}


@router.post("/apply")
def apply_changes():
    with _job_lock:
        if _job["running"]:
            return {"success": False, "message": "Comparación aún en curso"}
        if _job["applying"]:
            return {"success": False, "message": "Ya se están aplicando cambios"}
        if not _job.get("differences"):
            return {"success": False, "message": "No hay diferencias para aplicar"}
        _job.update({
            "applying": True,
            "apply_phase": "Iniciando...",
            "apply_error": None,
            "apply_result": None,
        })

    threading.Thread(target=_run_apply, daemon=True).start()
    return {"success": True, "message": "Aplicando cambios a Shopify"}
