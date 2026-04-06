"""
Router: Actualización de Inventario Celesa (Dropshipping España)
Endpoints:
  POST /api/celesa/upload  -> Sube CSV de Shopify, descarga Azeta, cruza diferencias
  GET  /api/celesa/status   -> Estado y diferencias encontradas
  POST /api/celesa/apply    -> Aplica cambios a Shopify
  POST /api/celesa/cancel   -> Cancela job en curso

Recibe un CSV exportado desde Shopify Products y lo cruza con stock de Azeta.
"""

import io
import os
import threading
import time

import pandas as pd
import requests as http_requests
from fastapi import APIRouter, File, UploadFile

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
    print(f"[CELESA] Azeta: {len(stock)} SKUs descargados", flush=True)
    if stock:
        sample = list(stock.items())[:3]
        print(f"[CELESA] Azeta sample: {sample}", flush=True)
    return stock


# -- Inventory Item ID lookup ------------------------------------------------

def _get_inventory_item_ids(variant_ids: list[str]) -> dict[str, str]:
    """Given variant IDs, return {variant_id: inventory_item_gid}."""
    result = {}
    # Process in batches of 50 using aliases
    for i in range(0, len(variant_ids), 50):
        batch = variant_ids[i:i + 50]
        # Build aliased query
        parts = []
        for j, vid in enumerate(batch):
            gid = vid if vid.startswith("gid://") else f"gid://shopify/ProductVariant/{vid}"
            parts.append(
                f'v{j}: node(id: "{gid}") {{ ... on ProductVariant {{ id inventoryItem {{ id }} }} }}'
            )
        query = "{ " + " ".join(parts) + " }"
        data = _gql(query, timeout=30)
        for j, vid in enumerate(batch):
            node = data.get(f"v{j}")
            if node and node.get("inventoryItem"):
                result[vid] = node["inventoryItem"]["id"]
    return result


# -- Background worker: CSV comparison --------------------------------------

def _run_csv_comparison(csv_content: bytes):
    """Parses uploaded Shopify CSV, downloads Azeta stock, cross-references by SKU."""
    try:
        _set_job(phase="uploading", started_at=time.time())

        # Step 1: Parse uploaded CSV
        _set_job(phase="parsing")
        df_products = pd.read_csv(io.BytesIO(csv_content))

        # Validate required columns
        required_cols = [
            "Variant SKU",
            "Variant ID",
            "Vendor",
            "Inventory Available: Dropshipping [España]",
        ]
        missing = [c for c in required_cols if c not in df_products.columns]
        if missing:
            raise RuntimeError(f"Columnas faltantes en CSV: {', '.join(missing)}")

        # Clean SKUs (remove .0 suffix) and filter vendor
        df_products["Variant SKU"] = (
            df_products["Variant SKU"].astype(str).str.replace(r"\.0$", "", regex=True)
        )
        df_products = df_products.loc[df_products["Vendor"] == VENDOR_FILTER].copy()

        if df_products.empty:
            raise RuntimeError(
                f"No se encontraron productos con vendor '{VENDOR_FILTER}' en el CSV"
            )

        # Step 2: Get location for apply
        _set_job(phase="location")
        location_gid = _get_dropshipping_location()
        _set_job(location_gid=location_gid)

        # Step 3: Download Azeta stock
        _set_job(phase="azeta")
        azeta_stock = _fetch_azeta_stock()

        # Step 4: Cross-reference
        _set_job(phase="comparing")

        # Build Azeta dataframe
        df_azeta = pd.DataFrame(
            list(azeta_stock.items()), columns=["Variant SKU", "Stock_Azeta"]
        )
        df_azeta["Variant SKU"] = df_azeta["Variant SKU"].astype(str)

        # Merge on SKU
        df_merged = pd.merge(df_products, df_azeta, on="Variant SKU", how="left")

        # Clean numeric columns
        df_merged["Inventory Available: Dropshipping [España]"] = (
            pd.to_numeric(
                df_merged["Inventory Available: Dropshipping [España]"], errors="coerce"
            )
            .fillna(0)
            .astype(int)
        )
        df_merged["Stock_Azeta"] = (
            pd.to_numeric(df_merged["Stock_Azeta"], errors="coerce").fillna(0).astype(int)
        )

        # Find differences only
        df_diff = df_merged.loc[
            df_merged["Inventory Available: Dropshipping [España]"]
            != df_merged["Stock_Azeta"]
        ].copy()

        # Build differences list (same format as before for frontend compatibility)
        differences = []
        for _, row in df_diff.iterrows():
            sku = str(row["Variant SKU"])
            shopify_qty = int(row["Inventory Available: Dropshipping [España]"])
            azeta_qty = int(row["Stock_Azeta"])
            variant_id = str(row.get("Variant ID", "")).replace(".0", "")
            title = str(row.get("Title", row.get("Variant SKU", "")))

            differences.append({
                "sku": sku,
                "title": title,
                "vendor": VENDOR_FILTER,
                "shopify_qty": shopify_qty,
                "azeta_qty": azeta_qty,
                "diff": azeta_qty - shopify_qty,
                "inventory_item_id": "",  # Will be resolved during apply
                "variant_id": variant_id,
            })

        differences.sort(key=lambda d: abs(d["diff"]), reverse=True)

        with _job_lock:
            started_at = _job.get("started_at") or time.time()
        elapsed = time.time() - started_at

        summary = {
            "total_azeta_skus": len(azeta_stock),
            "total_shopify_items": len(df_products),
            "differences_found": len(differences),
            "elapsed_seconds": round(elapsed, 1),
        }

        _set_job(
            running=False,
            phase=None,
            differences=differences,
            summary=summary,
        )
        print(
            f"[CELESA] CSV comparison done: {len(df_products)} products, "
            f"{len(azeta_stock)} Azeta SKUs, {len(differences)} differences",
            flush=True,
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

        # Look up inventory_item_ids from variant_ids if needed
        needs_lookup = [d for d in diffs if not d.get("inventory_item_id") and d.get("variant_id")]
        if needs_lookup:
            _set_job(apply_phase="Obteniendo IDs de inventario...")
            variant_ids = [d["variant_id"] for d in needs_lookup]
            id_map = _get_inventory_item_ids(variant_ids)
            for d in needs_lookup:
                d["inventory_item_id"] = id_map.get(d["variant_id"], "")
            # Remove items without inventory_item_id
            diffs = [d for d in diffs if d.get("inventory_item_id")]
            if not diffs:
                _set_job(
                    applying=False,
                    apply_error="No se encontraron IDs de inventario para los productos",
                )
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

@router.post("/upload")
async def upload_and_compare(file: UploadFile = File(...)):
    """Recibe CSV de productos Shopify, descarga Azeta, cruza y encuentra diferencias."""
    with _job_lock:
        if _job["running"]:
            return {"success": False, "message": "Ya hay una comparación en curso"}
        if _job["applying"]:
            return {"success": False, "message": "Ya se están aplicando cambios"}
        _job.update({
            "running": True,
            "phase": "uploading",
            "error": None,
            "differences": None,
            "location_gid": None,
            "summary": None,
            "applying": False,
            "apply_phase": None,
            "apply_error": None,
            "apply_result": None,
        })

    # Read the uploaded file content before spawning thread
    content = await file.read()
    threading.Thread(target=_run_csv_comparison, args=(content,), daemon=True).start()
    return {"success": True, "message": "Procesando CSV..."}


@router.get("/status")
def get_status():
    with _job_lock:
        return {
            "running": _job["running"],
            "phase": _job["phase"],
            "error": _job["error"],
            "summary": _job["summary"],
            "differences": _job["differences"],
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
