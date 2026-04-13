"""
Router: Actualización de Inventario Celesa (Dropshipping España)
Endpoints:
  POST /api/celesa/upload            -> Sube CSV de Shopify, descarga Azeta, cruza diferencias
  GET  /api/celesa/status            -> Estado y diferencias encontradas
  POST /api/celesa/matrixify         -> Genera Excel y lo sube a Matrixify para importar
  GET  /api/celesa/matrixify-download -> Descarga el Excel Matrixify sin subirlo
  POST /api/celesa/cancel            -> Cancela job en curso

Recibe un CSV exportado desde Shopify Products y lo cruza con stock de Azeta.
"""

import base64
import hashlib
import io
import json
import os
import threading
import time

import pandas as pd
import requests as http_requests
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook

from services.celesa_common import gql, get_dropshipping_location, DROPSHIPPING_LOCATION_NAME, VENDOR_FILTER

router = APIRouter(prefix="/api/celesa", tags=["Celesa Inventory"])

# -- Config ------------------------------------------------------------------

AZETA_URL = os.getenv(
    "AZETA_URL",
    "http://www.azetadistribuciones.es/servicios_web/stock.php"
    "?fr_usuario=861549&fr_clave=Bukz549",
)

# Matrixify MCP
MATRIXIFY_MCP_URL = "https://mcp.matrixify.app/mcp"
MATRIXIFY_MCP_TOKEN = os.getenv("MATRIXIFY_MCP_TOKEN", "")

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
    # Matrixify import state
    "applying": False,
    "apply_phase": None,
    "apply_error": None,
    "apply_result": None,
    "matrixify_job_id": None,
}


def _set_job(**kwargs):
    with _job_lock:
        _job.update(kwargs)


# -- GraphQL & Location (delegated to celesa_common) ------------------------

_gql = gql
_get_dropshipping_location = get_dropshipping_location


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


# -- Matrixify MCP helpers ---------------------------------------------------

_matrixify_last_call = 0.0
MATRIXIFY_RATE_LIMIT_SECONDS = 5.5  # Matrixify enforces 5s between MCP calls


def _matrixify_rpc(method: str, params: dict | None = None) -> dict:
    """Call a Matrixify MCP tool via JSON-RPC, respecting rate limits."""
    global _matrixify_last_call
    if not MATRIXIFY_MCP_TOKEN:
        raise RuntimeError("MATRIXIFY_MCP_TOKEN no configurado en el servidor")

    # Respect rate limit
    elapsed = time.time() - _matrixify_last_call
    if elapsed < MATRIXIFY_RATE_LIMIT_SECONDS:
        time.sleep(MATRIXIFY_RATE_LIMIT_SECONDS - elapsed)

    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": method, "arguments": params or {}},
    }
    resp = http_requests.post(
        MATRIXIFY_MCP_URL,
        json=payload,
        headers={
            "Authorization": f"Bearer {MATRIXIFY_MCP_TOKEN}",
            "Content-Type": "application/json",
        },
        timeout=60,
    )
    _matrixify_last_call = time.time()
    resp.raise_for_status()
    body = resp.json()
    if "error" in body:
        raise RuntimeError(f"Matrixify MCP error: {body['error']}")
    # MCP tools/call returns result.content as a list of content blocks
    result = body.get("result", {})
    content_blocks = result.get("content", [])
    # Extract text from the first text block and parse as JSON if possible
    for block in content_blocks:
        if block.get("type") == "text":
            text = block["text"]
            try:
                return json.loads(text)
            except (json.JSONDecodeError, TypeError):
                return {"text": text}
    return result


def _generate_matrixify_excel(differences: list[dict]) -> bytes:
    """Generate a Matrixify-compatible Excel file from differences.

    Uses ID (Product ID) + UPDATE + Variant SKU — same format as manual uploads.
    ID enables direct lookup without indexing the full catalog.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Products"

    # Headers — matches manual upload format: ID for direct lookup
    ws.append([
        "ID",
        "Command",
        "Variant SKU",
        f"Inventory Available: {DROPSHIPPING_LOCATION_NAME}",
    ])

    # Data rows
    for d in differences:
        ws.append([d.get("product_id", ""), "UPDATE", d["sku"], d["azeta_qty"]])

    # Save to bytes
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _run_matrixify_import():
    """Background worker: generate Excel, upload to Matrixify, start import."""
    try:
        with _job_lock:
            diffs = _job.get("differences") or []

        if not diffs:
            _set_job(applying=False, apply_error="No hay diferencias para importar")
            return

        # Step 1: Generate Excel
        _set_job(apply_phase="Generando Excel Matrixify...")
        excel_bytes = _generate_matrixify_excel(diffs)
        print(f"[CELESA] Matrixify Excel: {len(excel_bytes)} bytes, {len(diffs)} rows", flush=True)

        # Step 2: Get upload URL
        _set_job(apply_phase="Obteniendo URL de subida...")
        checksum = base64.b64encode(hashlib.md5(excel_bytes).digest()).decode()
        upload_info = _matrixify_rpc("matrixify_import_get_upload_url", {
            "filename": f"celesa_stock_{time.strftime('%Y%m%d_%H%M%S')}.xlsx",
            "byte_size": len(excel_bytes),
            "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "checksum": checksum,
        })

        upload_url = upload_info.get("upload_url")
        upload_headers = upload_info.get("upload_headers", {})
        create_url = upload_info.get("create_from_upload_url")

        if not upload_url or not create_url:
            raise RuntimeError(f"Matrixify no retornó URLs de subida: {upload_info}")

        # Step 3: PUT file to S3
        _set_job(apply_phase="Subiendo archivo a Matrixify...")
        put_resp = http_requests.put(
            upload_url,
            data=excel_bytes,
            headers=upload_headers,
            timeout=120,
        )
        put_resp.raise_for_status()
        print("[CELESA] File uploaded to Matrixify S3", flush=True)

        # Step 4: POST callback to finalize upload (no auth needed — URL is pre-signed)
        # Matrixify enforces rate limit on all endpoints
        _set_job(apply_phase="Creando job de importación...")
        time.sleep(MATRIXIFY_RATE_LIMIT_SECONDS)
        create_resp = http_requests.post(create_url, timeout=60)
        print(
            f"[CELESA] create_from_upload: {create_resp.status_code} "
            f"{create_resp.text[:500]}",
            flush=True,
        )
        create_resp.raise_for_status()

        # Extract job_id from response or URL params
        job_id = None
        try:
            create_data = create_resp.json()
            job_id = create_data.get("job_id") or create_data.get("id")
        except Exception:
            pass
        if not job_id:
            from urllib.parse import urlparse, parse_qs
            parsed = parse_qs(urlparse(create_url).query)
            job_id_str = parsed.get("job_id", [None])[0]
            if job_id_str:
                job_id = int(job_id_str)
        if not job_id:
            raise RuntimeError("No se pudo obtener job_id de Matrixify")

        print(f"[CELESA] Matrixify import job created: {job_id}", flush=True)
        _set_job(matrixify_job_id=job_id)

        # Step 5: Poll until estimation complete ("Ready to Import")
        _set_job(apply_phase="Estimando cambios...")
        max_wait = 120  # 2 min max for estimation
        start = time.time()
        while time.time() - start < max_wait:
            job_info = _matrixify_rpc("matrixify_job_get", {"job_id": job_id})
            state = job_info.get("state", "")
            print(f"[CELESA] Matrixify job {job_id} state: {state}", flush=True)
            if state == "Ready to Import":
                break
            if state in ("Failed", "Cancelled"):
                raise RuntimeError(f"Matrixify job falló: {state} - {job_info}")
            time.sleep(3)
        else:
            raise RuntimeError("Timeout esperando estimación de Matrixify")

        # Step 6: Start the import
        _set_job(apply_phase="Importando a Shopify vía Matrixify...")
        _matrixify_rpc("matrixify_import_start", {"job_id": job_id})

        # Step 7: Poll until finished
        max_wait = 600  # 10 min max for import
        start = time.time()
        while time.time() - start < max_wait:
            job_info = _matrixify_rpc("matrixify_job_get", {"job_id": job_id})
            state = job_info.get("state", "")
            progress = job_info.get("progress", {})
            pct = progress.get("percentage", 0) if isinstance(progress, dict) else 0
            _set_job(apply_phase=f"Matrixify importando... {pct}%")
            print(f"[CELESA] Matrixify job {job_id}: {state} ({pct}%)", flush=True)

            if state in ("Finished", "Finished / Limited"):
                # Extract results
                details = job_info.get("details", [])
                total_ok = 0
                total_fail = 0
                for sheet in (details if isinstance(details, list) else []):
                    total_ok += sheet.get("ok", 0) or sheet.get("new", 0) or 0
                    total_fail += sheet.get("failed", 0) or 0

                result = {
                    "applied": total_ok if total_ok else len(diffs),
                    "total": len(diffs),
                    "errors": [f"Matrixify: {total_fail} filas fallidas"] if total_fail else [],
                    "matrixify_job_id": job_id,
                    "matrixify_state": state,
                }
                _set_job(
                    applying=False,
                    apply_phase=None,
                    apply_result=result,
                    apply_error=None if not total_fail else f"{total_fail} errores en Matrixify",
                )
                print(f"[CELESA] Matrixify import done: {total_ok} ok, {total_fail} failed", flush=True)
                return

            if state in ("Failed", "Cancelled"):
                raise RuntimeError(f"Matrixify import falló: {state}")

            time.sleep(5)

        raise RuntimeError("Timeout esperando import de Matrixify (10 min)")

    except Exception as e:
        _set_job(applying=False, apply_phase=None, apply_error=str(e))
        print(f"[CELESA] Matrixify import error: {e}", flush=True)


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
            title = str(row.get("Title", row.get("Variant SKU", "")))

            product_id = str(row.get("ID", "")).replace(".0", "")

            differences.append({
                "sku": sku,
                "title": title,
                "vendor": VENDOR_FILTER,
                "shopify_qty": shopify_qty,
                "azeta_qty": azeta_qty,
                "diff": azeta_qty - shopify_qty,
                "inventory_item_id": "",
                "product_id": product_id,
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
            "matrixify_job_id": _job.get("matrixify_job_id"),
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


@router.post("/matrixify")
def import_via_matrixify():
    """Genera Excel Matrixify y lo sube para importar stock a Shopify."""
    with _job_lock:
        if _job["running"]:
            return {"success": False, "message": "Comparación aún en curso"}
        if _job["applying"]:
            return {"success": False, "message": "Ya se está importando"}
        if not _job.get("differences"):
            return {"success": False, "message": "No hay diferencias para importar"}
        _job.update({
            "applying": True,
            "apply_phase": "Iniciando importación Matrixify...",
            "apply_error": None,
            "apply_result": None,
            "matrixify_job_id": None,
        })

    threading.Thread(target=_run_matrixify_import, daemon=True).start()
    return {"success": True, "message": "Importando vía Matrixify..."}


@router.get("/matrixify-download")
def download_matrixify_excel():
    """Descarga el Excel Matrixify sin subirlo (para importación manual)."""
    with _job_lock:
        diffs = _job.get("differences")
    if not diffs:
        return {"success": False, "message": "No hay diferencias para exportar"}

    excel_bytes = _generate_matrixify_excel(diffs)
    filename = f"celesa_matrixify_{time.strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
