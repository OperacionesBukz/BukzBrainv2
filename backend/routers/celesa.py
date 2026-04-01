"""
Router: Actualización de Inventario Celesa (Dropshipping España)
Endpoints:
  POST /api/celesa/start    -> Inicia comparación Azeta vs Shopify (background)
  GET  /api/celesa/status   -> Estado y diferencias encontradas
  POST /api/celesa/apply    -> Aplica cambios a Shopify
"""

import os
import threading
import time
import requests as http_requests

from fastapi import APIRouter

from config import settings
from services.shopify_service import _throttler

router = APIRouter(prefix="/api/celesa", tags=["Celesa Inventory"])

# -- Azeta config -----------------------------------------------------------

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
    # Apply state
    "applying": False,
    "apply_phase": None,
    "apply_error": None,
    "apply_result": None,
}


def _set_job(**kwargs):
    with _job_lock:
        _job.update(kwargs)


# -- Helpers -----------------------------------------------------------------

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
        raise RuntimeError(f"GraphQL errors: {body['errors']}")
    return body["data"]


def _get_dropshipping_location() -> str:
    """Retorna el GID de la location 'Dropshipping [España]'."""
    data = _gql('{ locations(first: 250) { edges { node { id name } } } }')
    for edge in data["locations"]["edges"]:
        if edge["node"]["name"] == DROPSHIPPING_LOCATION_NAME:
            return edge["node"]["id"]
    raise RuntimeError(
        f"Location '{DROPSHIPPING_LOCATION_NAME}' no encontrada en Shopify"
    )


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
    return stock


def _fetch_shopify_inventory(location_gid: str) -> list[dict]:
    """
    Paginado: obtiene inventario completo de la location con rate limiting.
    Retorna [{"sku", "title", "vendor", "available", "inventory_item_id"}, ...]
    """
    results: list[dict] = []
    cursor = None

    query_template = """
    query inventoryLevels($locationId: ID!, $first: Int!, $after: String) {
      location(id: $locationId) {
        inventoryLevels(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              quantities(names: ["available"]) {
                name
                quantity
              }
              item {
                id
                sku
                variant {
                  product {
                    vendor
                    title
                  }
                }
              }
            }
          }
        }
      }
    }
    """

    while True:
        variables = {
            "locationId": location_gid,
            "first": 250,
            "after": cursor,
        }

        data = _gql(query_template, variables)
        location_data = data.get("location") or {}
        inv_levels = location_data.get("inventoryLevels", {})

        for edge in inv_levels.get("edges", []):
            node = edge.get("node", {})
            item = node.get("item", {})
            sku = (item.get("sku") or "").strip()
            inventory_item_id = (item.get("id") or "").strip()
            variant = item.get("variant") or {}
            product = variant.get("product") or {}
            vendor = (product.get("vendor") or "").strip()
            title = (product.get("title") or "").strip()

            available = 0
            for qty_entry in node.get("quantities", []):
                if qty_entry.get("name") == "available":
                    available = int(qty_entry.get("quantity") or 0)
                    break

            if sku and vendor == VENDOR_FILTER:
                results.append({
                    "sku": sku,
                    "title": title,
                    "vendor": vendor,
                    "available": available,
                    "inventory_item_id": inventory_item_id,
                })

        page_info = inv_levels.get("pageInfo", {})
        if not page_info.get("hasNextPage"):
            break
        cursor = page_info.get("endCursor")

    return results


def _compare(
    shopify_items: list[dict], azeta_stock: dict[str, int]
) -> list[dict]:
    """
    Cruza inventario Shopify con stock Azeta por SKU.
    Solo retorna items con diferencias.
    """
    differences: list[dict] = []
    for item in shopify_items:
        sku = item["sku"]
        if sku not in azeta_stock:
            continue
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
    return differences


# -- Background worker: comparar --------------------------------------------

def _run_comparison():
    try:
        _set_job(phase="location")
        location_gid = _get_dropshipping_location()
        _set_job(location_gid=location_gid)

        _set_job(phase="azeta")
        azeta_stock = _fetch_azeta_stock()

        _set_job(phase="shopify")
        shopify_items = _fetch_shopify_inventory(location_gid)

        _set_job(phase="comparing")
        diffs = _compare(shopify_items, azeta_stock)
        diffs.sort(key=lambda d: abs(d["diff"]), reverse=True)

        summary = {
            "total_azeta_skus": len(azeta_stock),
            "total_shopify_items": len(shopify_items),
            "differences_found": len(diffs),
        }

        _set_job(
            running=False,
            phase=None,
            differences=diffs,
            summary=summary,
        )
    except Exception as e:
        _set_job(running=False, phase=None, error=str(e))


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

        # inventorySetQuantities acepta hasta 100 items por llamada
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
                    # Partial success: if adjustmentGroup exists, some items succeeded
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
            "applying": _job["applying"],
            "apply_phase": _job["apply_phase"],
            "apply_error": _job["apply_error"],
            "apply_result": _job["apply_result"],
        }


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
