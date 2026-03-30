"""
Router de Reposiciones — Pipeline de Datos Shopify.
Expone endpoints para locations, vendors, inventario y cache de ventas (bulk ops).
Plan 01: locations, vendors, inventory
Plan 02: sales/refresh, sales/status, sales/data (bulk ops + cache)
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from services import shopify_service

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

@router.get("/vendors")
def get_vendors():
    """
    Devuelve lista de proveedores únicos desde productos de Shopify con conteo.
    Returns: [{"name": str, "product_count": int}, ...]
    """
    try:
        return shopify_service.get_vendors_from_shopify()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo proveedores: {str(e)}")


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
