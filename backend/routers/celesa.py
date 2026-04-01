"""
Router: Actualización de Inventario Celesa (Dropshipping España)
Endpoints:
  POST /api/celesa/start    -> Inicia comparación Azeta vs Shopify (background)
  GET  /api/celesa/status   -> Estado y diferencias encontradas
  POST /api/celesa/apply    -> Aplica cambios a Shopify

Usa Bulk Operations para consultar ~90k SKUs de inventario eficientemente.
"""

import json
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
    return stock


# -- Shopify Bulk Operation --------------------------------------------------

def _start_inventory_bulk() -> str:
    """Lanza bulk operation para inventario completo con locations y vendors."""
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
                  product {
                    title
                    vendor
                  }
                }
                inventoryLevels {
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
        \"\"\"
      ) {
        bulkOperation { id status }
        userErrors { field message }
      }
    }
    """
    data = _gql(mutation, timeout=30)
    result = data.get("bulkOperationRunQuery", {})
    errors = result.get("userErrors", [])
    if errors:
        raise RuntimeError(f"Bulk operation user errors: {errors}")

    op_id = result.get("bulkOperation", {}).get("id")
    if not op_id:
        raise RuntimeError("Bulk operation no retornó ID")
    print(f"[CELESA] Bulk op started: {op_id}", flush=True)
    return op_id


def _poll_bulk(op_id: str, max_wait: int = 900) -> str:
    """Espera a que la bulk operation termine y retorna la URL de descarga."""
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
            print(f"[CELESA] Bulk: {status} ({count} objects)", flush=True)

            if status == "COMPLETED":
                url = op.get("url")
                if not url:
                    raise RuntimeError("Bulk operation completada sin URL de descarga")
                return url
            elif status in ("FAILED", "CANCELED"):
                raise RuntimeError(f"Bulk operation {status}: {op.get('errorCode')}")

        except RuntimeError:
            raise
        except Exception:
            pass

        time.sleep(5)

    raise RuntimeError(f"Bulk operation timeout ({max_wait}s)")


def _process_inventory_jsonl(url: str, location_gid: str) -> list[dict]:
    """
    Descarga JSONL de bulk operation y extrae inventario filtrado por:
    - Location: Dropshipping [España]
    - Vendor: Bukz España
    Retorna [{"sku", "title", "vendor", "available", "inventory_item_id"}, ...]
    """
    resp = http_requests.get(url, timeout=300, stream=True)

    # JSONL flat: InventoryItem rows, then child InventoryLevel rows con __parentId
    items: dict[str, dict] = {}  # inventory_item_gid -> {sku, title, vendor, inventory_item_id}

    results: list[dict] = []

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
            variant = obj.get("variant") or {}
            product = variant.get("product") or {}
            vendor = (product.get("vendor") or "").strip()
            sku = (obj.get("sku") or "").strip()

            # Filtro de vendor
            if sku and vendor == VENDOR_FILTER:
                items[obj_id] = {
                    "sku": sku,
                    "title": (product.get("title") or "").strip(),
                    "vendor": vendor,
                    "inventory_item_id": obj_id,
                }

        # InventoryLevel row (child of InventoryItem)
        elif "gid://shopify/InventoryLevel/" in obj_id:
            loc_name = (obj.get("location", {}).get("name") or "").strip()

            # Filtro de location
            if loc_name != DROPSHIPPING_LOCATION_NAME:
                continue

            # Solo si el parent es un item que pasó el filtro de vendor
            if parent_id not in items:
                continue

            available = 0
            for q in obj.get("quantities", []):
                if q.get("name") == "available":
                    available = int(q.get("quantity") or 0)
                    break

            item = items[parent_id]
            results.append({
                "sku": item["sku"],
                "title": item["title"],
                "vendor": item["vendor"],
                "available": available,
                "inventory_item_id": item["inventory_item_id"],
            })

    print(f"[CELESA] Procesados {len(results)} items (vendor={VENDOR_FILTER}, location={DROPSHIPPING_LOCATION_NAME})", flush=True)
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

        _set_job(phase="shopify_bulk")
        op_id = _start_inventory_bulk()

        _set_job(phase="shopify_polling")
        jsonl_url = _poll_bulk(op_id)

        _set_job(phase="processing")
        shopify_items = _process_inventory_jsonl(jsonl_url, location_gid)

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
