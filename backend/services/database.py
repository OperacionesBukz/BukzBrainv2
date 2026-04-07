"""
Conexion a PostgreSQL — reemplaza Firestore para datos de cache
(inventario, ventas, catalogo de productos).
"""
import os
import json
import logging
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger("bukz.database")


# =============================================
# CONEXION
# =============================================

def get_connection():
    """
    Abre una conexion a PostgreSQL.
    Lee la URL de la variable de entorno DATABASE_URL
    (la que configuraste en EasyPanel en el Paso A4).
    """
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "Variable DATABASE_URL no encontrada. "
            "Configurala en EasyPanel > tu backend > Environment"
        )
    return psycopg2.connect(url)


@contextmanager
def get_cursor():
    """
    Abre conexion + cursor para hacer queries.

    Uso:
        with get_cursor() as cur:
            cur.execute("SELECT * FROM mi_tabla")
            filas = cur.fetchall()
        # Aqui ya se cerro la conexion automaticamente

    Si todo sale bien: hace COMMIT (guarda los cambios).
    Si hay error: hace ROLLBACK (deshace los cambios).
    """
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


# =============================================
# CREAR TABLAS (se ejecuta al iniciar la app)
# =============================================

SCHEMA_SQL = """
-- Tabla 1: Inventario por sede (una fila por cada tienda/bodega)
CREATE TABLE IF NOT EXISTS inventory_cache (
    location_id    TEXT PRIMARY KEY,
    location_name  TEXT NOT NULL,
    location_gid   TEXT NOT NULL DEFAULT '',
    items          JSONB NOT NULL DEFAULT '[]',
    item_count     INTEGER NOT NULL DEFAULT 0,
    cached_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla 2: Ventas de los ultimos 6 meses (una sola fila)
CREATE TABLE IF NOT EXISTS sales_cache (
    id             TEXT PRIMARY KEY DEFAULT '6m_global',
    sales_data     JSONB NOT NULL DEFAULT '{}',
    sku_count      INTEGER NOT NULL DEFAULT 0,
    cached_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla 3: Catalogo de productos (una sola fila con todos los SKUs)
CREATE TABLE IF NOT EXISTS product_catalog (
    id             TEXT PRIMARY KEY DEFAULT 'global',
    products       JSONB NOT NULL DEFAULT '[]',
    sku_count      INTEGER NOT NULL DEFAULT 0,
    cached_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def init_database():
    """
    Crea las tablas si no existen.
    Se llama UNA vez al iniciar la app.
    Si las tablas ya existen, no hace nada (por el IF NOT EXISTS).
    Con 2+ workers de uvicorn, puede haber race condition — se maneja con gracia.
    """
    try:
        with get_cursor() as cur:
            cur.execute(SCHEMA_SQL)
        logger.info("PostgreSQL: tablas listas (inventory_cache, sales_cache, product_catalog)")
    except Exception as e:
        # Con multiples workers, otro worker puede haber creado las tablas primero
        if "already exists" in str(e):
            logger.info("PostgreSQL: tablas ya existian (creadas por otro worker)")
        else:
            logger.error(f"PostgreSQL: ERROR creando tablas — {e}")
            raise


# =============================================
# ESCRITURA — usado por scheduler_service.py
# =============================================

def pg_write_inventory(location_gid: str, location_name: str, items: list[dict]):
    """
    Guarda el inventario de UNA sede en PostgreSQL.
    Si ya existia, lo sobreescribe (UPSERT).
    """
    doc_id = location_gid.replace("://", "__").replace("/", "__")

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO inventory_cache (location_id, location_name, location_gid, items, item_count, cached_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (location_id) DO UPDATE SET
                location_name = EXCLUDED.location_name,
                location_gid  = EXCLUDED.location_gid,
                items         = EXCLUDED.items,
                item_count    = EXCLUDED.item_count,
                cached_at     = NOW()
        """, (doc_id, location_name, location_gid, json.dumps(items), len(items)))

    logger.info(f"[PG inventory] Guardados {len(items)} items para {location_name}")


def pg_write_sales(sales_data: dict, sku_count: int):
    """Guarda el cache de ventas en PostgreSQL."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO sales_cache (id, sales_data, sku_count, cached_at)
            VALUES ('6m_global', %s, %s, NOW())
            ON CONFLICT (id) DO UPDATE SET
                sales_data = EXCLUDED.sales_data,
                sku_count  = EXCLUDED.sku_count,
                cached_at  = NOW()
        """, (json.dumps(sales_data), sku_count))

    logger.info(f"[PG sales] Guardadas ventas de {sku_count} SKUs")


def pg_write_product_catalog(items: list[dict]):
    """Guarda el catalogo de productos en PostgreSQL."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO product_catalog (id, products, sku_count, cached_at)
            VALUES ('global', %s, %s, NOW())
            ON CONFLICT (id) DO UPDATE SET
                products  = EXCLUDED.products,
                sku_count = EXCLUDED.sku_count,
                cached_at = NOW()
        """, (json.dumps(items), len(items)))

    logger.info(f"[PG catalog] Guardados {len(items)} productos")


# =============================================
# LECTURA — usado por agent_commands.py
# =============================================

def pg_read_inventory(location_id: str) -> list[dict] | None:
    """Lee el inventario de UNA sede. Retorna lista de items o None."""
    with get_cursor() as cur:
        cur.execute("SELECT items FROM inventory_cache WHERE location_id = %s", (location_id,))
        row = cur.fetchone()
        if not row:
            return None
        return row["items"]


def pg_read_all_locations() -> dict[str, str]:
    """Lista todas las sedes. Retorna {nombre: gid}."""
    with get_cursor() as cur:
        cur.execute("SELECT location_name, location_gid FROM inventory_cache ORDER BY location_name")
        rows = cur.fetchall()
        return {r["location_name"]: r["location_gid"] for r in rows}


def pg_read_sales() -> dict:
    """Lee el cache de ventas. Retorna {sku: {mes: cantidad}} o {}."""
    with get_cursor() as cur:
        cur.execute("SELECT sales_data FROM sales_cache WHERE id = '6m_global'")
        row = cur.fetchone()
        if not row:
            return {}
        return row["sales_data"]


def pg_read_sales_meta() -> dict | None:
    """Lee metadata del cache de ventas (para verificar edad)."""
    with get_cursor() as cur:
        cur.execute("SELECT sku_count, cached_at FROM sales_cache WHERE id = '6m_global'")
        row = cur.fetchone()
        if not row:
            return None
        return {
            "sku_count": row["sku_count"],
            "cached_at": row["cached_at"].isoformat() if row["cached_at"] else None,
        }


def pg_read_product_catalog() -> list[dict] | None:
    """Lee el catalogo de productos. Retorna lista o None."""
    with get_cursor() as cur:
        cur.execute("SELECT products FROM product_catalog WHERE id = 'global'")
        row = cur.fetchone()
        if not row:
            return None
        return row["products"]


def pg_read_inventory_all() -> list[dict]:
    """Lee inventario de TODAS las sedes (para resumen)."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT location_id, location_name, location_gid, items, item_count, cached_at
            FROM inventory_cache ORDER BY location_name
        """)
        return [dict(r) for r in cur.fetchall()]


def pg_read_cache_status() -> dict:
    """Lee estado de todos los caches para endpoint /cache/status."""
    result = {
        "inventory": {},
        "sales": {"sku_count": 0, "cached_at": None},
        "catalog": {"sku_count": 0, "cached_at": None},
    }

    with get_cursor() as cur:
        cur.execute("SELECT location_name, item_count, cached_at FROM inventory_cache")
        for row in cur.fetchall():
            result["inventory"][row["location_name"]] = {
                "sku_count": row["item_count"],
                "cached_at": row["cached_at"].isoformat() if row["cached_at"] else None,
            }

        cur.execute("SELECT sku_count, cached_at FROM sales_cache WHERE id = '6m_global'")
        row = cur.fetchone()
        if row:
            result["sales"] = {
                "sku_count": row["sku_count"],
                "cached_at": row["cached_at"].isoformat() if row["cached_at"] else None,
            }

        cur.execute("SELECT sku_count, cached_at FROM product_catalog WHERE id = 'global'")
        row = cur.fetchone()
        if row:
            result["catalog"] = {
                "sku_count": row["sku_count"],
                "cached_at": row["cached_at"].isoformat() if row["cached_at"] else None,
            }

    return result
