"""
Scheduler de background para pre-computo de caches de reposiciones.
Jobs:
  1. inventory_refresh: cada 4h, cachea inventario de Shopify por ubicacion en Firestore
  2. sales_pre_refresh: cada 1h, verifica edad del sales cache y lo refresca proactivamente
"""
import logging
import threading
from datetime import datetime, timedelta, timezone

logger = logging.getLogger("bukz.scheduler")

# ── Constants ──
INVENTORY_CACHE_COLLECTION = "inventory_cache"
INVENTORY_CACHE_TTL_HOURS = 2
SALES_PRE_REFRESH_THRESHOLD_HOURS = 20
INVENTORY_REFRESH_INTERVAL_HOURS = 4
PRODUCT_CATALOG_COLLECTION = "product_catalog"
PRODUCT_CATALOG_DOC = "global"
PRODUCT_CATALOG_TTL_HOURS = 24

# ── Module state ──
_scheduler = None
_scheduler_lock = threading.Lock()
_inventory_refreshing = False
_inventory_refresh_lock = threading.Lock()
_catalog_refreshing = False
_catalog_refresh_lock = threading.Lock()


def _get_firestore():
    from services.firebase_service import get_firestore_db
    return get_firestore_db()


def _sanitize_gid(gid: str) -> str:
    """Convierte 'gid://shopify/Location/12345' en 'gid__shopify__Location__12345' para doc ID."""
    return gid.replace("://", "__").replace("/", "__")


# ── Inventory Cache: Write ──

def write_inventory_cache(location_gid: str, location_name: str, items: list[dict]):
    """
    Escribe snapshot de inventario en Firestore.
    Si >8000 items, usa chunking en subcollection.
    """
    db = _get_firestore()
    doc_id = _sanitize_gid(location_gid)
    doc_ref = db.collection(INVENTORY_CACHE_COLLECTION).document(doc_id)

    meta = {
        "location_gid": location_gid,
        "location_name": location_name,
        "cached_at": datetime.now(timezone.utc).isoformat(),
        "sku_count": len(items),
        "status": "ready",
    }

    if len(items) <= 8000:
        meta["chunked"] = False
        meta["data"] = items
        doc_ref.set(meta)
    else:
        meta["chunked"] = True
        doc_ref.set(meta)
        # Borrar chunks anteriores
        old_chunks = doc_ref.collection("chunks").stream()
        for old in old_chunks:
            old.reference.delete()
        # Escribir nuevos chunks de 500
        for i in range(0, len(items), 500):
            chunk = items[i:i + 500]
            doc_ref.collection("chunks").document(str(i // 500)).set({"data": chunk})

    logger.info(f"[inventory_cache] Wrote {len(items)} items for {location_name} ({doc_id})")


# ── Inventory Cache: Read ──

def read_inventory_cache(location_gid: str) -> tuple[list[dict] | None, dict | None]:
    """
    Lee cache de inventario para una ubicacion.
    Returns (items, meta) si cache existe y tiene <TTL horas.
    Returns (None, None) si no existe o esta vencido.
    """
    db = _get_firestore()
    doc_id = _sanitize_gid(location_gid)
    doc_ref = db.collection(INVENTORY_CACHE_COLLECTION).document(doc_id)

    try:
        snap = doc_ref.get()
        if not snap.exists:
            return None, None

        meta = snap.to_dict()
        cached_at_str = meta.get("cached_at", "")
        if not cached_at_str:
            return None, None

        cached_at = datetime.fromisoformat(cached_at_str)
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=timezone.utc)
        age_hours = (datetime.now(timezone.utc) - cached_at).total_seconds() / 3600

        if age_hours > INVENTORY_CACHE_TTL_HOURS:
            return None, None

        # Leer datos inline
        if not meta.get("chunked", False) and "data" in meta:
            return meta["data"], meta

        # Leer datos chunked
        if meta.get("chunked"):
            items = []
            chunks = doc_ref.collection("chunks").stream()
            for chunk in sorted(chunks, key=lambda c: int(c.id)):
                items.extend(chunk.to_dict().get("data", []))
            return items, meta

        return None, None
    except Exception as e:
        logger.warning(f"[inventory_cache] Error leyendo cache para {location_gid}: {e}")
        return None, None


# ── Scheduler Job: Inventory Refresh ──

def refresh_all_inventory_caches():
    """
    Refresca inventario de TODAS las ubicaciones de Shopify.
    Secuencial por location para respetar rate limits.
    """
    global _inventory_refreshing
    with _inventory_refresh_lock:
        if _inventory_refreshing:
            logger.info("[inventory_cache] Refresh ya en progreso, skipping")
            return
        _inventory_refreshing = True

    try:
        from services import shopify_service
        locations = shopify_service.get_locations()  # {name: gid}
        logger.info(f"[inventory_cache] Refrescando inventario para {len(locations)} ubicaciones")

        for name, gid in locations.items():
            try:
                items = shopify_service.get_inventory_by_location(
                    location_gid=gid,
                    vendor_filter=None,
                )
                write_inventory_cache(gid, name, items)
            except Exception as e:
                logger.error(f"[inventory_cache] Error refrescando {name}: {e}")
                continue

        logger.info("[inventory_cache] Refresh completado")
    except Exception as e:
        logger.error(f"[inventory_cache] Error general en refresh: {e}")
    finally:
        with _inventory_refresh_lock:
            _inventory_refreshing = False


# ── Product Catalog Cache: Write ──

def write_product_catalog(items: list[dict]):
    """
    Escribe catálogo de productos (SKU→vendor+title) en Firestore.
    Si >8000 items, usa chunking en subcollection.
    """
    db = _get_firestore()
    doc_ref = db.collection(PRODUCT_CATALOG_COLLECTION).document(PRODUCT_CATALOG_DOC)

    meta = {
        "cached_at": datetime.now(timezone.utc).isoformat(),
        "sku_count": len(items),
        "status": "ready",
    }

    if len(items) <= 8000:
        meta["chunked"] = False
        meta["data"] = items
        doc_ref.set(meta)
    else:
        meta["chunked"] = True
        doc_ref.set(meta)
        # Borrar chunks anteriores
        old_chunks = doc_ref.collection("chunks").stream()
        for old in old_chunks:
            old.reference.delete()
        # Escribir nuevos chunks de 500
        for i in range(0, len(items), 500):
            chunk = items[i:i + 500]
            doc_ref.collection("chunks").document(str(i // 500)).set({"data": chunk})

    logger.info(f"[product_catalog] Wrote {len(items)} items")


# ── Product Catalog Cache: Read ──

def read_product_catalog(check_ttl: bool = True) -> tuple[list[dict] | None, dict | None]:
    """
    Lee catálogo de productos desde Firestore.
    Returns (items, meta) si cache existe y tiene <TTL horas (o check_ttl=False).
    Returns (None, None) si no existe o esta vencido.
    """
    db = _get_firestore()
    doc_ref = db.collection(PRODUCT_CATALOG_COLLECTION).document(PRODUCT_CATALOG_DOC)

    try:
        snap = doc_ref.get()
        if not snap.exists:
            return None, None

        meta = snap.to_dict()
        cached_at_str = meta.get("cached_at", "")
        if not cached_at_str:
            return None, None

        if check_ttl:
            cached_at = datetime.fromisoformat(cached_at_str)
            if cached_at.tzinfo is None:
                cached_at = cached_at.replace(tzinfo=timezone.utc)
            age_hours = (datetime.now(timezone.utc) - cached_at).total_seconds() / 3600

            if age_hours > PRODUCT_CATALOG_TTL_HOURS:
                return None, None

        # Leer datos inline
        if not meta.get("chunked", False) and "data" in meta:
            return meta["data"], meta

        # Leer datos chunked
        if meta.get("chunked"):
            items = []
            chunks = doc_ref.collection("chunks").stream()
            for chunk in sorted(chunks, key=lambda c: int(c.id)):
                items.extend(chunk.to_dict().get("data", []))
            return items, meta

        return None, None
    except Exception as e:
        logger.warning(f"[product_catalog] Error leyendo cache: {e}")
        return None, None


# ── Scheduler Job: Product Catalog Refresh ──

def refresh_product_catalog():
    """
    Refresca catálogo completo de productos desde Shopify.
    """
    global _catalog_refreshing
    with _catalog_refresh_lock:
        if _catalog_refreshing:
            logger.info("[product_catalog] Refresh ya en progreso, skipping")
            return
        _catalog_refreshing = True

    try:
        from services import shopify_service
        logger.info("[product_catalog] Refrescando catálogo de productos")
        items = shopify_service.get_all_products_catalog()
        write_product_catalog(items)
        logger.info(f"[product_catalog] Refresh completado: {len(items)} SKUs")
    except Exception as e:
        logger.error(f"[product_catalog] Error en refresh: {e}")
    finally:
        with _catalog_refresh_lock:
            _catalog_refreshing = False


# ── Scheduler Job: Sales Pre-Refresh ──

def check_and_refresh_sales_cache():
    """
    Verifica edad del sales cache. Si >20h, dispara Bulk Op proactivamente.
    Guards: skip si Bulk Op ya corriendo.
    """
    try:
        from services import shopify_service
        from routers.reposiciones import (
            _get_sales_cache_meta,
            _reposiciones_job,
            _sales_refresh_worker,
            _JOB_STALE_SECONDS,
        )

        # Guard: job local corriendo
        if _reposiciones_job["running"]:
            started = _reposiciones_job.get("started_at")
            if started:
                age = (datetime.now(timezone.utc) - started).total_seconds()
                if age < _JOB_STALE_SECONDS:
                    logger.info("[sales_pre_refresh] Job local en progreso, skipping")
                    return

        # Guard: Bulk Op corriendo en Shopify
        current_op = shopify_service.check_bulk_operation_status()
        if current_op.get("status") in ("RUNNING", "CREATED"):
            logger.info("[sales_pre_refresh] Bulk Op en Shopify en progreso, skipping")
            return

        # Verificar edad del cache
        cache_doc = _get_sales_cache_meta()
        if cache_doc:
            last_refreshed_str = cache_doc.get("last_refreshed", "")
            if last_refreshed_str:
                last_refreshed = datetime.fromisoformat(last_refreshed_str)
                if last_refreshed.tzinfo is None:
                    last_refreshed = last_refreshed.replace(tzinfo=timezone.utc)
                age_hours = (datetime.now(timezone.utc) - last_refreshed).total_seconds() / 3600
                if age_hours < SALES_PRE_REFRESH_THRESHOLD_HOURS:
                    logger.info(f"[sales_pre_refresh] Cache fresco ({age_hours:.1f}h), skipping")
                    return

        # Lanzar refresh en background
        logger.info("[sales_pre_refresh] Cache >20h o inexistente, lanzando refresh")
        _reposiciones_job["running"] = True
        _reposiciones_job["error"] = None
        _reposiciones_job["started_at"] = datetime.now(timezone.utc)
        _reposiciones_job["operation_id"] = None
        thread = threading.Thread(target=_sales_refresh_worker, args=(180,), daemon=True)
        thread.start()

    except Exception as e:
        logger.error(f"[sales_pre_refresh] Error: {e}")


# ── Cache Status ──

def get_cache_status() -> dict:
    """Retorna estado de todos los caches para el endpoint /cache/status."""
    db = _get_firestore()
    now = datetime.now(timezone.utc)
    result = {
        "inventory": {},
        "sales": {"fresh": False, "age_hours": None, "sku_count": 0, "last_refreshed": None},
        "scheduler_running": _scheduler is not None,
    }

    # Inventory caches
    try:
        inv_docs = db.collection(INVENTORY_CACHE_COLLECTION).stream()
        for doc in inv_docs:
            data = doc.to_dict()
            cached_at_str = data.get("cached_at", "")
            age_hours = None
            fresh = False
            if cached_at_str:
                cached_at = datetime.fromisoformat(cached_at_str)
                if cached_at.tzinfo is None:
                    cached_at = cached_at.replace(tzinfo=timezone.utc)
                age_hours = round((now - cached_at).total_seconds() / 3600, 1)
                fresh = age_hours <= INVENTORY_CACHE_TTL_HOURS

            loc_name = data.get("location_name", doc.id)
            result["inventory"][loc_name] = {
                "age_hours": age_hours,
                "sku_count": data.get("sku_count", 0),
                "fresh": fresh,
                "cached_at": cached_at_str,
            }
    except Exception:
        pass

    # Sales cache
    try:
        from routers.reposiciones import _SALES_CACHE_COLLECTION, _SALES_CACHE_DOC, _CACHE_TTL_HOURS
        sales_doc = db.collection(_SALES_CACHE_COLLECTION).document(_SALES_CACHE_DOC).get()
        if sales_doc.exists:
            sales_data = sales_doc.to_dict()
            last_refreshed = sales_data.get("last_refreshed", "")
            if last_refreshed:
                lr = datetime.fromisoformat(last_refreshed)
                if lr.tzinfo is None:
                    lr = lr.replace(tzinfo=timezone.utc)
                age = round((now - lr).total_seconds() / 3600, 1)
                result["sales"] = {
                    "fresh": age <= _CACHE_TTL_HOURS,
                    "age_hours": age,
                    "sku_count": sales_data.get("sku_count", 0),
                    "last_refreshed": last_refreshed,
                }
    except Exception:
        pass

    return result


# ── Start/Stop ──

def start_scheduler():
    """Inicia APScheduler. Llamado desde FastAPI lifespan."""
    global _scheduler
    with _scheduler_lock:
        if _scheduler is not None:
            return
        from apscheduler.schedulers.background import BackgroundScheduler
        _scheduler = BackgroundScheduler(daemon=True)
        _scheduler.add_job(
            refresh_all_inventory_caches,
            "interval",
            hours=INVENTORY_REFRESH_INTERVAL_HOURS,
            next_run_time=datetime.now(timezone.utc) + timedelta(seconds=30),
            id="inventory_refresh",
            max_instances=1,
            misfire_grace_time=300,
        )
        _scheduler.add_job(
            check_and_refresh_sales_cache,
            "interval",
            hours=1,
            next_run_time=datetime.now(timezone.utc) + timedelta(minutes=2),
            id="sales_pre_refresh",
            max_instances=1,
            misfire_grace_time=300,
        )
        _scheduler.add_job(
            refresh_product_catalog,
            "interval",
            hours=24,
            next_run_time=datetime.now(timezone.utc) + timedelta(minutes=5),
            id="product_catalog_refresh",
            max_instances=1,
            misfire_grace_time=300,
        )
        _scheduler.start()
        logger.info("Scheduler iniciado: inventory_refresh cada 4h, sales_pre_refresh cada 1h, product_catalog cada 24h")


def stop_scheduler():
    """Detiene APScheduler. Llamado desde FastAPI lifespan shutdown."""
    global _scheduler
    with _scheduler_lock:
        if _scheduler:
            _scheduler.shutdown(wait=False)
            _scheduler = None
            logger.info("Scheduler detenido")
