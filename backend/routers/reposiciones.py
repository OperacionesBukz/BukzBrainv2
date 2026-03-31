"""
Router de Reposiciones — Pipeline de Datos Shopify.
Expone endpoints para locations, vendors, inventario y cache de ventas (bulk ops).
Plan 01: locations, vendors, inventory
Plan 02: sales/refresh, sales/status, sales/data (bulk ops + cache)
"""
import json
import time
import threading
import base64
import zipfile
import openpyxl
from io import BytesIO
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from services import shopify_service

# ---------------------------------------------------------------------------
# Estado del job de Bulk Operations (en memoria + persistido en Firestore)
# ---------------------------------------------------------------------------

_BULK_OP_COLLECTION = "reposiciones_meta"
_BULK_OP_STATE_DOC = "bulk_op_state"
_SALES_CACHE_COLLECTION = "sales_cache"
_SALES_CACHE_DOC = "6m_global"
_CACHE_TTL_HOURS = 24
_VENDORS_CACHE_DOC = "vendors_cache"
_VENDORS_CACHE_TTL_HOURS = 12
_JOB_STALE_SECONDS = 900  # 15 minutos — si running pero sin actualización, asumir muerto

_reposiciones_job: dict = {
    "running": False,
    "error": None,
    "started_at": None,
    "operation_id": None,
}

router = APIRouter(prefix="/api/reposiciones", tags=["Reposiciones"])


# ---------------------------------------------------------------------------
# SHOP-01: Locations (sedes)
# ---------------------------------------------------------------------------

@router.get("/locations")
def get_locations():
    """
    Devuelve lista de sedes (Locations) de Shopify.
    Returns: [{"name": str, "id": str}, ...]
    """
    try:
        locations_dict = shopify_service.get_locations()
        # get_locations() devuelve {name: id} — convertir a lista de objetos
        return [{"name": name, "id": loc_id} for name, loc_id in locations_dict.items()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo sedes: {str(e)}")


# ---------------------------------------------------------------------------
# SHOP-03: Vendors (proveedores)
# ---------------------------------------------------------------------------

_vendors_refresh_lock = threading.Lock()
_vendors_refreshing = False


def _refresh_vendors_background():
    """Background thread that fetches vendors from Shopify and caches in Firestore."""
    global _vendors_refreshing
    try:
        vendors = shopify_service.get_vendors_from_shopify()
        db = _get_firestore()
        db.collection(_BULK_OP_COLLECTION).document(_VENDORS_CACHE_DOC).set({
            "vendors": vendors,
            "cached_at": datetime.now(timezone.utc).isoformat(),
            "count": len(vendors),
        })
    except Exception as e:
        print(f"[vendors] Error en refresh background: {e}")
    finally:
        with _vendors_refresh_lock:
            _vendors_refreshing = False


@router.get("/vendors")
def get_vendors():
    """
    Devuelve lista de proveedores desde cache en Firestore.
    Si no hay cache o esta vencido, lanza refresh en background y retorna lo que haya
    (o lista vacia si es la primera vez). Nunca bloquea.
    """
    global _vendors_refreshing
    db = _get_firestore()
    cache_ref = db.collection(_BULK_OP_COLLECTION).document(_VENDORS_CACHE_DOC)

    # Read cache
    cached_vendors = []
    cache_fresh = False
    try:
        cache_snap = cache_ref.get()
        if cache_snap.exists:
            cache_data = cache_snap.to_dict()
            cached_vendors = cache_data.get("vendors", [])
            cached_at = cache_data.get("cached_at", "")
            if cached_at:
                cache_time = datetime.fromisoformat(cached_at)
                cache_fresh = datetime.now(timezone.utc) - cache_time < timedelta(hours=_VENDORS_CACHE_TTL_HOURS)
    except Exception:
        pass

    # If cache is stale or empty, trigger background refresh (non-blocking)
    if not cache_fresh:
        with _vendors_refresh_lock:
            if not _vendors_refreshing:
                _vendors_refreshing = True
                threading.Thread(target=_refresh_vendors_background, daemon=True).start()

    return cached_vendors


# ---------------------------------------------------------------------------
# SHOP-02: Inventory por location y vendor
# ---------------------------------------------------------------------------

@router.get("/inventory")
def get_inventory(
    location_id: str = Query(..., description="GID de la sede, e.g. gid://shopify/Location/12345"),
    vendors: Optional[list[str]] = Query(default=None, alias="vendors[]", description="Filtro de proveedores"),
):
    """
    Devuelve niveles de inventario (available) para una sede, opcionalmente filtrados por proveedor.
    Query params: location_id (requerido), vendors[] (opcional, repetible)
    Returns: [{"sku": str, "title": str, "vendor": str, "available": int}, ...]
    """
    if not location_id:
        raise HTTPException(status_code=422, detail="location_id es requerido")

    try:
        return shopify_service.get_inventory_by_location(
            location_gid=location_id,
            vendor_filter=vendors if vendors else None,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo inventario: {str(e)}")


# ---------------------------------------------------------------------------
# Helpers: Firestore
# ---------------------------------------------------------------------------

def _get_firestore():
    from services.firebase_service import get_firestore_db
    return get_firestore_db()


def _array_union(values: list):
    """Lazy import wrapper for Firestore ArrayUnion sentinel."""
    from google.cloud.firestore_v1 import ArrayUnion
    return ArrayUnion(values)


def _persist_job_state(operation_id: str | None, status: str):
    """Persiste estado del job en Firestore para sobrevivir reinicios del backend."""
    try:
        db = _get_firestore()
        db.collection(_BULK_OP_COLLECTION).document(_BULK_OP_STATE_DOC).set({
            "operation_id": operation_id,
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass  # No es fatal — el job continúa aunque no persista


def _recover_job_state_on_startup():
    """
    Lee Firestore al startup para detectar jobs huérfanos.
    Si hay un job RUNNING en Firestore, lo refleja en _reposiciones_job para
    que /sales/status pueda informar el progreso.
    """
    try:
        db = _get_firestore()
        doc = db.collection(_BULK_OP_COLLECTION).document(_BULK_OP_STATE_DOC).get()
        if doc.exists:
            data = doc.to_dict()
            if data.get("status") == "RUNNING":
                _reposiciones_job["operation_id"] = data.get("operation_id")
                # No marcamos running=True — el worker no está corriendo
                # El cliente puede llamar /sales/status para ver si Shopify completó
    except Exception:
        pass


def _get_sales_cache_meta() -> dict | None:
    """Lee metadata del cache de ventas desde Firestore. None si no existe."""
    try:
        db = _get_firestore()
        doc = db.collection(_SALES_CACHE_COLLECTION).document(_SALES_CACHE_DOC).get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception:
        return None


def _is_cache_stale(cache_doc: dict) -> bool:
    """Retorna True si el cache tiene más de 24 horas."""
    last_refreshed_str = cache_doc.get("last_refreshed")
    if not last_refreshed_str:
        return True
    try:
        last_refreshed = datetime.fromisoformat(last_refreshed_str)
        if last_refreshed.tzinfo is None:
            last_refreshed = last_refreshed.replace(tzinfo=timezone.utc)
        age_hours = (datetime.now(timezone.utc) - last_refreshed).total_seconds() / 3600
        return age_hours > _CACHE_TTL_HOURS
    except Exception:
        return True


def _download_and_aggregate(url: str) -> dict:
    """
    Descarga JSONL de Shopify Bulk Op y agrega currentQuantity por SKU + year-month.
    IMPORTANTE: Lee createdAt del nodo order (parent) para asociar la fecha al line item.
    Returns: {sku: {"2025-10": 5, "2025-11": 12, ...}, ...}
    """
    orders_by_id: dict[str, dict] = {}
    sales_by_sku_month: dict[str, dict[str, int]] = {}

    try:
        import requests as _requests
        response = _requests.get(url, timeout=120, stream=True)
        if response.status_code != 200:
            return {}

        for line in response.iter_lines():
            if not line:
                continue
            try:
                data = json.loads(line.decode("utf-8") if isinstance(line, bytes) else line)
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue

            if "createdAt" in data and "id" in data:
                # Nodo order (parent) — guardar fecha para resolver en line items
                orders_by_id[data["id"]] = {"createdAt": data["createdAt"]}

            elif "sku" in data and "currentQuantity" in data:
                # Nodo line item (child) — per D-03: usar currentQuantity no quantity
                sku = str(data.get("sku") or "").strip()
                qty = int(data.get("currentQuantity") or 0)
                if not sku or qty <= 0:
                    continue

                parent_id = data.get("__parentId", "")
                order = orders_by_id.get(parent_id, {})
                created_at = order.get("createdAt", "")
                # Derivar year-month de createdAt: "2025-10-01T14:00:00Z" -> "2025-10"
                year_month = created_at[:7] if len(created_at) >= 7 else "unknown"

                if sku not in sales_by_sku_month:
                    sales_by_sku_month[sku] = {}
                sales_by_sku_month[sku][year_month] = (
                    sales_by_sku_month[sku].get(year_month, 0) + qty
                )
    except Exception:
        pass

    return sales_by_sku_month


def _write_sales_cache_to_firestore(sales_by_sku_month: dict, date_range_days: int = 180):
    """
    Escribe ventas agregadas en Firestore sales_cache/6m_global.
    Si hay más de 8000 SKUs, escribe metadata en el doc principal y datos en subcollection chunks.
    Per D-07, D-08, D-10.
    """
    db = _get_firestore()
    now = datetime.now(timezone.utc)
    doc_data = {
        "last_refreshed": now.isoformat(),
        "date_range_start": (now - timedelta(days=date_range_days)).strftime("%Y-%m-%d"),
        "date_range_end": now.strftime("%Y-%m-%d"),
        "sku_count": len(sales_by_sku_month),
        "status": "ready",
    }

    if len(sales_by_sku_month) <= 8000:
        # Cabe en el documento principal (< 1MB estimado)
        doc_data["data"] = sales_by_sku_month
        db.collection(_SALES_CACHE_COLLECTION).document(_SALES_CACHE_DOC).set(doc_data)
    else:
        # Metadata en doc principal, datos en subcollection de chunks de 500 SKUs
        doc_data["chunked"] = True
        db.collection(_SALES_CACHE_COLLECTION).document(_SALES_CACHE_DOC).set(doc_data)
        skus = list(sales_by_sku_month.items())
        for i, chunk_start in enumerate(range(0, len(skus), 500)):
            chunk = dict(skus[chunk_start:chunk_start + 500])
            db.collection(_SALES_CACHE_COLLECTION).document(_SALES_CACHE_DOC) \
              .collection("chunks").document(str(i)).set({"data": chunk})


# ---------------------------------------------------------------------------
# Worker de background: Bulk Operation polling
# ---------------------------------------------------------------------------

def _sales_refresh_worker(date_range_days: int = 180):
    """
    Worker ejecutado en thread daemon.
    1. Inicia Bulk Operation de reposiciones (con currentQuantity + createdAt)
    2. Polling cada 5 seg hasta COMPLETED/FAILED/CANCELED (max 120 intentos = 10 min)
    3. Descarga JSONL, agrega por SKU+mes, escribe en Firestore
    4. Persiste estado en Firestore para sobrevivir reinicios
    """
    global _reposiciones_job
    try:
        # Iniciar bulk operation
        operation_id, error = shopify_service.start_bulk_operation_reposiciones(date_range_days)
        if error:
            _reposiciones_job["error"] = error
            _persist_job_state(None, "FAILED")
            return

        _reposiciones_job["operation_id"] = operation_id
        _persist_job_state(operation_id, "RUNNING")

        # Polling loop (max 10 min = 120 iteraciones × 5 seg)
        for _ in range(120):
            time.sleep(5)
            result = shopify_service.check_bulk_operation_status()
            status = result.get("status")

            if status == "COMPLETED":
                url = result.get("url")
                if not url:
                    _reposiciones_job["error"] = "Bulk Op completó pero sin URL de descarga"
                    _persist_job_state(operation_id, "FAILED")
                    return
                sales_data = _download_and_aggregate(url)
                _write_sales_cache_to_firestore(sales_data, date_range_days)
                _persist_job_state(operation_id, "COMPLETED")
                return

            elif status in ("FAILED", "CANCELED"):
                error_code = result.get("error_code", "")
                _reposiciones_job["error"] = f"Bulk Op {status}: {error_code}"
                _persist_job_state(operation_id, status)
                return

        # Timeout
        _reposiciones_job["error"] = "Timeout: Bulk Operation no completó en 10 minutos"
        _persist_job_state(operation_id, "FAILED")

    except Exception as e:
        _reposiciones_job["error"] = str(e)
        _persist_job_state(None, "FAILED")
    finally:
        _reposiciones_job["running"] = False


# Intentar recuperar estado huérfano al importar el módulo
_recover_job_state_on_startup()


# ---------------------------------------------------------------------------
# SHOP-04, SHOP-05, SHOP-06, SHOP-07: Ventas (Bulk Operations + Cache)
# ---------------------------------------------------------------------------

@router.post("/sales/refresh")
def sales_refresh(date_range_days: int = 180):
    """
    Inicia refresh de ventas históricas via Bulk Operation.
    - Si cache vigente (<24h): devuelve status:cached sin lanzar nueva operación (SHOP-06)
    - Si hay Bulk Op corriendo (ingreso u otro): devuelve 409 OPERATION_IN_PROGRESS (SHOP-07)
    - Si job local en progreso (<15 min): devuelve 409 OPERATION_IN_PROGRESS
    - En cualquier otro caso: lanza nueva Bulk Op en background
    """
    global _reposiciones_job

    # Guard 1: job local en progreso (no stale)
    if _reposiciones_job["running"]:
        started = _reposiciones_job.get("started_at")
        if started:
            age_seconds = (datetime.now(timezone.utc) - started).total_seconds()
            if age_seconds < _JOB_STALE_SECONDS:
                raise HTTPException(
                    status_code=409,
                    detail={"error": "OPERATION_IN_PROGRESS",
                            "message": "Ya hay un refresh en progreso. Revisa /sales/status."},
                )
        # Job stale — resetear y continuar
        _reposiciones_job["running"] = False

    # Guard 2: Bulk Op corriendo en Shopify (puede ser del módulo ingreso — SHOP-07)
    current_op = shopify_service.check_bulk_operation_status()
    if current_op.get("status") in ("RUNNING", "CREATED"):
        raise HTTPException(
            status_code=409,
            detail={"error": "OPERATION_IN_PROGRESS",
                    "message": "Hay una operación Bulk en curso en Shopify. "
                               "Espera a que termine o cancela la operación actual."},
        )

    # Guard 3: Cache vigente — no necesita refresh (SHOP-06)
    cache_doc = _get_sales_cache_meta()
    if cache_doc and not _is_cache_stale(cache_doc):
        return {
            "status": "cached",
            "message": "Cache vigente, no se necesita refresh",
            "last_refreshed": cache_doc.get("last_refreshed"),
            "sku_count": cache_doc.get("sku_count"),
        }

    # Lanzar worker en background
    _reposiciones_job["running"] = True
    _reposiciones_job["error"] = None
    _reposiciones_job["started_at"] = datetime.now(timezone.utc)
    _reposiciones_job["operation_id"] = None
    thread = threading.Thread(
        target=_sales_refresh_worker,
        args=(date_range_days,),
        daemon=True,
    )
    thread.start()

    return {
        "status": "running",
        "message": "Bulk Operation iniciada en background. Consulta /sales/status para ver el progreso.",
    }


@router.get("/sales/status")
def sales_status():
    """
    Devuelve el estado actual del job de refresh de ventas.
    El frontend hace polling a este endpoint via React Query refetchInterval.
    """
    if _reposiciones_job["running"]:
        # Consultar progreso real en Shopify
        shopify_status = shopify_service.check_bulk_operation_status()
        return {
            "status": "running",
            "operation_id": _reposiciones_job.get("operation_id"),
            "object_count": shopify_status.get("object_count", 0),
            "shopify_status": shopify_status.get("status"),
        }

    if _reposiciones_job["error"]:
        return {
            "status": "failed",
            "error": _reposiciones_job["error"],
        }

    # Verificar si hay cache en Firestore (completado previamente)
    cache_doc = _get_sales_cache_meta()
    if cache_doc and cache_doc.get("status") == "ready":
        return {
            "status": "completed",
            "last_refreshed": cache_doc.get("last_refreshed"),
            "sku_count": cache_doc.get("sku_count"),
            "date_range_start": cache_doc.get("date_range_start"),
            "date_range_end": cache_doc.get("date_range_end"),
        }

    return {"status": "idle", "message": "No hay datos de ventas. Lanza un refresh."}


@router.get("/sales/data")
def sales_data():
    """
    Devuelve ventas agregadas por SKU+mes desde Firestore sales_cache.
    Si hay chunks (>8000 SKUs), los lee y concatena.
    Returns: {"data": {sku: {"2025-10": 5, ...}, ...}, "sku_count": int, "last_refreshed": str}
    """
    cache_doc = _get_sales_cache_meta()
    if not cache_doc:
        raise HTTPException(status_code=404, detail="No hay cache de ventas. Lanza POST /sales/refresh primero.")

    if cache_doc.get("status") != "ready":
        raise HTTPException(status_code=202, detail="Cache en proceso de generación. Espera.")

    # Datos inline (caso normal: <= 8000 SKUs)
    if "data" in cache_doc:
        return {
            "data": cache_doc["data"],
            "sku_count": cache_doc.get("sku_count"),
            "last_refreshed": cache_doc.get("last_refreshed"),
        }

    # Datos en chunks (caso >8000 SKUs)
    if cache_doc.get("chunked"):
        try:
            db = _get_firestore()
            chunks_ref = db.collection(_SALES_CACHE_COLLECTION) \
                           .document(_SALES_CACHE_DOC) \
                           .collection("chunks") \
                           .stream()
            merged = {}
            for chunk_doc in chunks_ref:
                chunk_data = chunk_doc.to_dict().get("data", {})
                merged.update(chunk_data)
            return {
                "data": merged,
                "sku_count": cache_doc.get("sku_count"),
                "last_refreshed": cache_doc.get("last_refreshed"),
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error leyendo chunks: {str(e)}")

    raise HTTPException(status_code=500, detail="Cache en estado inconsistente.")


# ---------------------------------------------------------------------------
# Constantes para Motor de Cálculo de Reposición
# ---------------------------------------------------------------------------

_REPLENISHMENT_ORDERS_COLLECTION = "replenishment_orders"

# ---------------------------------------------------------------------------
# Calculation Job State (persisted in Firestore for multi-worker support)
# ---------------------------------------------------------------------------
import uuid

_CALC_JOBS_COLLECTION = "reposiciones_meta"


def _calc_job_ref(job_id: str):
    return _get_firestore().collection(_CALC_JOBS_COLLECTION).document(f"calc_job_{job_id}")


def _update_calc_job(job_id: str, data: dict):
    _calc_job_ref(job_id).set(data, merge=True)


def _run_calculation_job(job_id: str, body_dict: dict):
    """Background thread for async calculation."""
    from services.reposicion_service import calculate_replenishment as _calc_repl
    from datetime import date as date_type

    def _update(step: str, progress: int):
        _update_calc_job(job_id, {"step": step, "progress": progress})

    try:
        db = _get_firestore()
        location_id = body_dict["location_id"]
        vendors = body_dict.get("vendors")
        lead_time_days = body_dict.get("lead_time_days", 14)
        safety_factor = body_dict.get("safety_factor", 1.5)
        date_range_days = body_dict.get("date_range_days", 180)

        # Step 1: Inventory
        _update("inventory", 10)
        try:
            inventory_items = shopify_service.get_inventory_by_location(
                location_gid=location_id,
                vendor_filter=vendors if vendors else None,
            )
        except Exception as e:
            raise Exception(f"Error obteniendo inventario de Shopify: {str(e)}")

        if not inventory_items:
            _update_calc_job(job_id, {
                "status": "completed",
                "step": "done",
                "progress": 100,
                "draft_id": f"empty_{int(time.time())}",
                "product_count": 0,
            })
            return

        _update("sales_cache", 40)
        sales_data, cache_meta = _load_sales_cache_data(db)

        today = datetime.now(timezone.utc).date()
        requested_start = today - timedelta(days=date_range_days)
        cache_start_str = cache_meta.get("date_range_start", "")
        try:
            cache_start = date_type.fromisoformat(cache_start_str)
        except (ValueError, TypeError):
            cache_start = requested_start
        effective_start = max(requested_start, cache_start)

        _update("pending_orders", 60)
        pending_orders_map = _load_pending_orders_map(db)

        _update("calculating", 75)
        params = {
            "lead_time_days": lead_time_days,
            "safety_factor": safety_factor,
            "date_range_days": date_range_days,
            "date_range_start": effective_start,
            "date_range_end": today,
        }
        result = _calc_repl(
            inventory_items=inventory_items,
            sales_cache=sales_data,
            pending_orders_map=pending_orders_map,
            params=params,
        )

        _update("saving", 90)
        request_params = {
            "location_id": location_id,
            "vendors": vendors,
            "lead_time_days": lead_time_days,
            "safety_factor": safety_factor,
            "date_range_days": date_range_days,
        }
        draft_id = _persist_draft(db, result, request_params)

        # Store result in the draft doc (already in Firestore), just mark job done
        _update_calc_job(job_id, {
            "status": "completed",
            "step": "done",
            "progress": 100,
            "draft_id": draft_id,
            "product_count": len(result.get("products", [])),
        })
    except Exception as e:
        _update_calc_job(job_id, {
            "status": "failed",
            "error": str(e),
        })


# ---------------------------------------------------------------------------
# Modelos Pydantic — POST /calculate (CALC-01 a CALC-06)
# ---------------------------------------------------------------------------

class CalculateRequest(BaseModel):
    location_id: str
    vendors: Optional[list[str]] = None
    lead_time_days: int = 14
    safety_factor: float = 1.5
    date_range_days: int = 180

class ProductAnalysis(BaseModel):
    sku: str
    title: str
    vendor: str
    classification: str          # "Bestseller" | "Regular" | "Slow" | "Long Tail"
    classification_label: str
    sales_per_month: float
    sales_per_week: float
    sales_per_day: float
    total_sold: int
    stock: int
    days_of_inventory: Optional[float]   # None cuando daily_sales == 0 (D-10, Pitfall 2)
    urgency: str                  # "URGENTE" | "PRONTO" | "NORMAL" | "OK"
    urgency_label: str
    reorder_point: float
    needs_reorder: bool
    suggested_qty: int
    in_transit_real: int

class VendorSummary(BaseModel):
    vendor: str
    total_skus: int
    total_units_to_order: int
    urgent_count: int

class ReplenishmentStats(BaseModel):
    total_products: int
    needs_replenishment: int
    urgent: int
    out_of_stock: int
    vendors_with_orders: int

class CalculateResponse(BaseModel):
    products: list[ProductAnalysis]
    vendor_summary: list[VendorSummary]
    stats: ReplenishmentStats
    draft_id: str                # ID del documento borrador en Firestore (D-13)


# ---------------------------------------------------------------------------
# Helpers de datos para /calculate
# ---------------------------------------------------------------------------

def _load_sales_cache_data(db) -> tuple[dict, dict]:
    """
    Lee sales_cache/6m_global desde Firestore.
    Maneja tanto almacenamiento inline (<=8000 SKUs) como chunked (>8000 SKUs).
    Returns: (sales_data_dict, cache_meta_dict)
    Raises: HTTPException 424 si el cache no existe o no está listo (Pitfall 4).
    """
    doc = db.collection(_SALES_CACHE_COLLECTION).document(_SALES_CACHE_DOC).get()
    if not doc.exists:
        raise HTTPException(
            status_code=424,
            detail="Cache de ventas no disponible. Ejecuta POST /sales/refresh primero."
        )
    cache_meta = doc.to_dict()
    if cache_meta.get("status") != "ready":
        raise HTTPException(
            status_code=424,
            detail="Cache de ventas en proceso de generación. Espera a que termine."
        )

    if "data" in cache_meta:
        return cache_meta["data"], cache_meta

    if cache_meta.get("chunked"):
        merged = {}
        chunks = db.collection(_SALES_CACHE_COLLECTION).document(_SALES_CACHE_DOC) \
                   .collection("chunks").stream()
        for chunk in chunks:
            merged.update(chunk.to_dict().get("data", {}))
        return merged, cache_meta

    raise HTTPException(status_code=500, detail="Cache en estado inconsistente.")


def _load_pending_orders_map(db) -> dict[str, list[dict]]:
    """
    Lee replenishment_orders donde status in ['aprobado', 'enviado'].
    Construye mapa {sku: [{quantity, created_at, ...}]} para lookup O(1) en el motor.
    Retorna dict vacío si no hay pedidos pendientes (D-03: correcto en primer run).

    SCHEMA CONTRACT: Los documentos deben tener campo 'items' como lista de
    {sku, quantity, vendor, title} y campo 'created_at' como ISO 8601 UTC string.
    Phase 7 debe escribir replenishment_orders con este schema.
    """
    pending_map: dict[str, list[dict]] = {}
    try:
        # Pitfall 3: filtrar explícitamente por status para no inflar in-transit
        docs = db.collection(_REPLENISHMENT_ORDERS_COLLECTION) \
                 .where("status", "in", ["aprobado", "enviado"]) \
                 .stream()
        for doc in docs:
            order = doc.to_dict()
            created_at_str = order.get("created_at", "")
            items = order.get("items", [])
            for item in items:
                sku = item.get("sku", "")
                qty = item.get("quantity", 0)
                if not sku or qty <= 0:
                    continue
                if sku not in pending_map:
                    pending_map[sku] = []
                pending_map[sku].append({
                    "quantity": qty,
                    "created_at": created_at_str,
                })
    except Exception:
        pass  # Colección vacía o no existe — correcto en primer run (D-03)
    return pending_map


def _persist_draft(db, result: dict, request_params: dict) -> str:
    """
    Crea documento borrador en replenishment_orders (D-13).
    Retorna el ID del documento creado.
    """
    doc_ref = db.collection(_REPLENISHMENT_ORDERS_COLLECTION).document()
    doc_ref.set({
        "status": "borrador",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "params": request_params,
        "products": result["products"],
        "vendor_summary": result["vendor_summary"],
        "stats": result["stats"],
    })
    return doc_ref.id


# ---------------------------------------------------------------------------
# CALC-01 a CALC-06: Motor de Cálculo de Reposición
# ---------------------------------------------------------------------------

@router.post("/calculate")
def calculate_replenishment_endpoint(body: CalculateRequest):
    """
    Lanza cálculo de reposición como job asíncrono.
    Devuelve job_id para consultar progreso via GET /calculate/{job_id}.
    """
    job_id = str(uuid.uuid4())[:8]
    _update_calc_job(job_id, {
        "status": "running",
        "step": "starting",
        "progress": 0,
        "started_at": datetime.now(timezone.utc).isoformat(),
    })
    thread = threading.Thread(
        target=_run_calculation_job,
        args=(job_id, body.model_dump()),
        daemon=True,
    )
    thread.start()
    return {"job_id": job_id, "status": "running"}


@router.get("/calculate/{job_id}")
def get_calculation_status(job_id: str):
    """Consulta progreso/resultado de un cálculo asíncrono."""
    doc = _calc_job_ref(job_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Job no encontrado")

    job = doc.to_dict()
    status = job.get("status", "running")

    if status == "completed":
        draft_id = job.get("draft_id", "")
        # Load result from the draft document
        db = _get_firestore()
        draft_doc = db.collection(_REPLENISHMENT_ORDERS_COLLECTION).document(draft_id).get()
        if not draft_doc.exists:
            # Empty result
            return CalculateResponse(
                products=[],
                vendor_summary=[],
                stats=ReplenishmentStats(
                    total_products=0, needs_replenishment=0,
                    urgent=0, out_of_stock=0, vendors_with_orders=0,
                ),
                draft_id=draft_id,
            )
        draft_data = draft_doc.to_dict()
        # Clean up job doc
        _calc_job_ref(job_id).delete()
        return CalculateResponse(
            products=[ProductAnalysis(**p) for p in draft_data.get("products", [])],
            vendor_summary=[VendorSummary(**v) for v in draft_data.get("vendor_summary", [])],
            stats=ReplenishmentStats(**draft_data.get("stats", {})),
            draft_id=draft_id,
        )

    if status == "failed":
        error = job.get("error", "Error desconocido")
        _calc_job_ref(job_id).delete()
        raise HTTPException(status_code=500, detail=error)

    # Still running
    return {
        "status": "running",
        "step": job.get("step", "starting"),
        "progress": job.get("progress", 0),
    }


# ─── Pydantic models — Phase 7: Aprobación y Pedidos ──────────────────────

class EffectiveProductItem(BaseModel):
    sku: str
    title: str
    vendor: str
    quantity: int
    stock: int

class ApproveRequest(BaseModel):
    draft_id: str
    approved_by: str
    effective_products: list[EffectiveProductItem]

class ApproveResponse(BaseModel):
    status: str
    approved_at: str

class GenerateOrdersRequest(BaseModel):
    draft_id: str
    vendors: list[str]
    created_by: str

class OrderCreated(BaseModel):
    order_id: str
    vendor: str
    item_count: int

class GenerateOrdersResponse(BaseModel):
    orders: list[OrderCreated]

class ExportOrdersRequest(BaseModel):
    order_ids: list[str]

class ExportOrdersResponse(BaseModel):
    zip_base64: str
    filename: str

class MarkSentResponse(BaseModel):
    status: str
    sent_at: str


# ─── APPR-05: POST /approve ────────────────────────────────────────────────

@router.post("/approve", response_model=ApproveResponse)
def approve_draft(body: ApproveRequest):
    """
    Aprueba un borrador usando transacción Firestore.
    Verifica status=='borrador' dentro de la transacción — si ya aprobado, falla con 409.
    """
    from google.cloud.firestore_v1 import transactional as _transactional

    db = _get_firestore()
    doc_ref = db.collection(_REPLENISHMENT_ORDERS_COLLECTION).document(body.draft_id)
    now_str = datetime.now(timezone.utc).isoformat()

    @_transactional
    def _do_approve(transaction, doc_ref):
        snap = doc_ref.get(transaction=transaction)
        if not snap.exists:
            raise ValueError("Borrador no encontrado")
        current_status = snap.to_dict().get("status")
        if current_status != "borrador":
            raise ValueError(
                f"El borrador ya fue procesado (status={current_status}). Recarga la pagina."
            )
        transaction.update(doc_ref, {
            "status": "aprobado",
            "approved_by": body.approved_by,
            "approved_at": now_str,
            "effective_products": [p.dict() for p in body.effective_products],
        })

    transaction = db.transaction()
    try:
        _do_approve(transaction, doc_ref)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error aprobando borrador: {str(e)}")

    return ApproveResponse(status="aprobado", approved_at=now_str)


# ─── APPR-06 + ORD-01: POST /orders/generate ──────────────────────────────

@router.post("/orders/generate", response_model=GenerateOrdersResponse)
def generate_orders(body: GenerateOrdersRequest):
    """
    Lee el draft aprobado, filtra effective_products por vendors seleccionados,
    crea un documento en replenishment_orders por proveedor.
    """
    db = _get_firestore()

    draft_snap = db.collection(_REPLENISHMENT_ORDERS_COLLECTION).document(body.draft_id).get()
    if not draft_snap.exists:
        raise HTTPException(status_code=404, detail="Borrador no encontrado")
    draft_data = draft_snap.to_dict()
    if draft_data.get("status") != "aprobado":
        raise HTTPException(status_code=409, detail="El borrador no ha sido aprobado")

    effective_products = draft_data.get("effective_products", [])
    now_str = datetime.now(timezone.utc).isoformat()

    created_orders: list[dict] = []
    for vendor in body.vendors:
        items = [
            {"sku": p["sku"], "title": p["title"], "quantity": p["quantity"], "stock": p["stock"]}
            for p in effective_products
            if p.get("vendor") == vendor and p.get("quantity", 0) > 0
        ]
        if not items:
            continue

        order_ref = db.collection(_REPLENISHMENT_ORDERS_COLLECTION).document()
        order_ref.set({
            "draft_id": body.draft_id,
            "vendor": vendor,
            "status": "aprobado",
            "items": items,
            "created_by": body.created_by,
            "created_at": now_str,
        })
        created_orders.append({"order_id": order_ref.id, "vendor": vendor, "item_count": len(items)})

    return GenerateOrdersResponse(orders=[OrderCreated(**o) for o in created_orders])


# ─── ORD-02 + ORD-03: POST /orders/export ─────────────────────────────────

@router.post("/orders/export", response_model=ExportOrdersResponse)
def export_orders(body: ExportOrdersRequest):
    """
    Genera ZIP base64 con un Excel por order_id.
    Columnas Excel: SKU, Titulo, Cantidad, Stock Actual.
    """
    db = _get_firestore()
    zip_buffer = BytesIO()
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for order_id in body.order_ids:
            order_snap = db.collection(_REPLENISHMENT_ORDERS_COLLECTION).document(order_id).get()
            if not order_snap.exists:
                continue
            order_data = order_snap.to_dict()
            vendor = order_data.get("vendor", "proveedor")
            items = order_data.get("items", [])

            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Pedido"
            ws.append(["SKU", "Titulo", "Cantidad", "Stock Actual"])
            for item in items:
                ws.append([
                    item.get("sku", ""),
                    item.get("title", ""),
                    item.get("quantity", 0),
                    item.get("stock", 0),
                ])

            excel_buf = BytesIO()
            wb.save(excel_buf)

            safe_vendor = vendor.replace("/", "-").replace("\\", "-").replace(" ", "_")
            zf.writestr(f"pedido_{safe_vendor}.xlsx", excel_buf.getvalue())

    zip_base64 = base64.b64encode(zip_buffer.getvalue()).decode("utf-8")
    return ExportOrdersResponse(
        zip_base64=zip_base64,
        filename=f"pedidos_reposicion_{today_str}.zip",
    )


# ─── ORD-04: PATCH /orders/{order_id}/send ────────────────────────────────

@router.patch("/orders/{order_id}/send", response_model=MarkSentResponse)
def mark_order_sent(order_id: str, sent_by: str):
    """Marca un pedido como enviado. Query param: sent_by (UID)."""
    db = _get_firestore()
    doc_ref = db.collection(_REPLENISHMENT_ORDERS_COLLECTION).document(order_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    now_str = datetime.now(timezone.utc).isoformat()
    doc_ref.update({
        "status": "enviado",
        "sent_at": now_str,
        "sent_by": sent_by,
        "enviado_at": now_str,
        "enviado_by": sent_by,
        "status_history": _array_union([{
            "status": "enviado",
            "changed_by": sent_by,
            "changed_at": now_str,
        }]),
    })
    return MarkSentResponse(status="enviado", sent_at=now_str)


# ─── ORD-05: DELETE /orders/{order_id} ────────────────────────────────────

@router.delete("/orders/{order_id}")
def delete_order(order_id: str):
    """Elimina un pedido de reposición."""
    db = _get_firestore()
    doc_ref = db.collection(_REPLENISHMENT_ORDERS_COLLECTION).document(order_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    doc_ref.delete()
    return {"id": order_id, "message": "Pedido eliminado"}


# ─── Pydantic models — Phase 8: Historial de Pedidos ──────────────────────

class OrderListItem(BaseModel):
    order_id: str
    vendor: str
    status: str
    item_count: int
    created_by: str
    created_at: str
    status_history: list = []

class OrderListResponse(BaseModel):
    orders: list[OrderListItem]

class OrderDetailItem(BaseModel):
    sku: str
    title: str
    quantity: int
    stock: int

class StatusHistoryEntry(BaseModel):
    status: str
    changed_by: str
    changed_at: str

class OrderDetailResponse(BaseModel):
    order_id: str
    vendor: str
    status: str
    items: list[OrderDetailItem]
    created_by: str
    created_at: str
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    status_history: list[StatusHistoryEntry] = []

class StatusTransitionRequest(BaseModel):
    status: str
    changed_by: str

class StatusTransitionResponse(BaseModel):
    status: str
    changed_at: str

class SingleExportResponse(BaseModel):
    excel_base64: str
    filename: str


ALLOWED_TRANSITIONS = {
    "aprobado": ["enviado"],
    "enviado": ["parcial", "recibido"],
    "parcial": ["recibido"],
    "recibido": [],
}


# ─── HIST-01: GET /orders ──────────────────────────────────────────────────

@router.get("/orders", response_model=OrderListResponse)
def list_orders(
    vendor: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    """
    Devuelve historial de pedidos (excluyendo borradores).
    Filtros opcionales: vendor, status (un valor), date_from, date_to (ISO 8601 date).
    """
    db = _get_firestore()
    try:
        collection_ref = db.collection(_REPLENISHMENT_ORDERS_COLLECTION)

        if status:
            # Filtrar por status específico
            query = collection_ref.where("status", "==", status)
        else:
            # Excluir borradores
            query = collection_ref.where(
                "status", "in", ["aprobado", "enviado", "parcial", "recibido"]
            )

        docs = query.stream()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando pedidos: {str(e)}")

    orders: list[OrderListItem] = []
    for doc in docs:
        data = doc.to_dict()
        created_at = data.get("created_at", "")

        # Filtros aplicados en Python para evitar índices compuestos
        if vendor and data.get("vendor", "") != vendor:
            continue
        if date_from and created_at < date_from:
            continue
        if date_to:
            from datetime import date as _date
            try:
                dt_to = _date.fromisoformat(date_to)
                from datetime import timedelta as _td
                exclusive_end = (dt_to + _td(days=1)).isoformat()
                if created_at >= exclusive_end:
                    continue
            except ValueError:
                pass

        orders.append(OrderListItem(
            order_id=doc.id,
            vendor=data.get("vendor", ""),
            status=data.get("status", ""),
            item_count=len(data.get("items", [])),
            created_by=data.get("created_by", ""),
            created_at=created_at,
            status_history=data.get("status_history", []),
        ))

    orders.sort(key=lambda o: o.created_at, reverse=True)
    return OrderListResponse(orders=orders)


# ─── HIST-03, HIST-05: GET /orders/{order_id} ─────────────────────────────

@router.get("/orders/{order_id}", response_model=OrderDetailResponse)
def get_order_detail(order_id: str):
    """Devuelve detalle completo de un pedido incluyendo items y status_history."""
    db = _get_firestore()
    doc_snap = db.collection(_REPLENISHMENT_ORDERS_COLLECTION).document(order_id).get()
    if not doc_snap.exists:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    data = doc_snap.to_dict()
    raw_items = data.get("items", [])
    items = [
        OrderDetailItem(
            sku=item.get("sku", ""),
            title=item.get("title", ""),
            quantity=item.get("quantity", 0),
            stock=item.get("stock", 0),
        )
        for item in raw_items
    ]
    raw_history = data.get("status_history", [])
    history = [
        StatusHistoryEntry(
            status=entry.get("status", ""),
            changed_by=entry.get("changed_by", ""),
            changed_at=entry.get("changed_at", ""),
        )
        for entry in raw_history
    ]

    return OrderDetailResponse(
        order_id=doc_snap.id,
        vendor=data.get("vendor", ""),
        status=data.get("status", ""),
        items=items,
        created_by=data.get("created_by", ""),
        created_at=data.get("created_at", ""),
        approved_by=data.get("approved_by"),
        approved_at=data.get("approved_at"),
        status_history=history,
    )


# ─── HIST-02, HIST-05: PATCH /orders/{order_id}/status ────────────────────

@router.patch("/orders/{order_id}/status", response_model=StatusTransitionResponse)
def transition_order_status(order_id: str, body: StatusTransitionRequest):
    """
    Transiciona el estado de un pedido según ALLOWED_TRANSITIONS.
    Usa transacción Firestore para atomicidad y escribe status_history (D-17).
    """
    from google.cloud.firestore_v1 import transactional as _transactional

    db = _get_firestore()
    doc_ref = db.collection(_REPLENISHMENT_ORDERS_COLLECTION).document(order_id)
    now_str = datetime.now(timezone.utc).isoformat()

    @_transactional
    def _do_transition(transaction, doc_ref):
        snap = doc_ref.get(transaction=transaction)
        if not snap.exists:
            raise ValueError("not_found")
        current_status = snap.to_dict().get("status", "")
        allowed = ALLOWED_TRANSITIONS.get(current_status, [])
        if body.status not in allowed:
            raise ValueError(f"invalid_transition:{current_status}")
        transaction.update(doc_ref, {
            "status": body.status,
            f"{body.status}_at": now_str,
            f"{body.status}_by": body.changed_by,
            "status_history": _array_union([{
                "status": body.status,
                "changed_by": body.changed_by,
                "changed_at": now_str,
            }]),
        })

    transaction = db.transaction()
    try:
        _do_transition(transaction, doc_ref)
    except ValueError as e:
        msg = str(e)
        if msg == "not_found":
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        if msg.startswith("invalid_transition:"):
            current = msg.split(":", 1)[1]
            raise HTTPException(
                status_code=409,
                detail=f"Transicion invalida: {current} -> {body.status}",
            )
        raise HTTPException(status_code=409, detail=msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en transicion de estado: {str(e)}")

    return StatusTransitionResponse(status=body.status, changed_at=now_str)


# ─── HIST-04: GET /orders/{order_id}/export ───────────────────────────────

@router.get("/orders/{order_id}/export", response_model=SingleExportResponse)
def export_single_order(order_id: str):
    """
    Genera un Excel base64 para un pedido individual.
    Columnas: SKU, Titulo, Cantidad, Stock Actual.
    """
    db = _get_firestore()
    doc_snap = db.collection(_REPLENISHMENT_ORDERS_COLLECTION).document(order_id).get()
    if not doc_snap.exists:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    data = doc_snap.to_dict()
    vendor = data.get("vendor", "proveedor")
    items = data.get("items", [])
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Pedido"
    ws.append(["SKU", "Titulo", "Cantidad", "Stock Actual"])
    for item in items:
        ws.append([
            item.get("sku", ""),
            item.get("title", ""),
            item.get("quantity", 0),
            item.get("stock", 0),
        ])

    excel_buf = BytesIO()
    wb.save(excel_buf)
    excel_base64 = base64.b64encode(excel_buf.getvalue()).decode("utf-8")

    safe_vendor = vendor.replace("/", "-").replace("\\", "-").replace(" ", "_")
    filename = f"pedido_{safe_vendor}_{today_str}.xlsx"

    return SingleExportResponse(excel_base64=excel_base64, filename=filename)
