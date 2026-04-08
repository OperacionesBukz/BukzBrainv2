"""
Router de Transfers - consulta transfers de inventario entre ubicaciones en Shopify.
Endpoints sin auth Firebase para acceso directo (lectura solamente).
"""
import logging

import requests
from fastapi import APIRouter, HTTPException, Query

from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transfers", tags=["Transfers"])


def _rest_get(endpoint: str, params: dict | None = None) -> dict:
    """GET request a Shopify REST API."""
    url = f"{settings.get_rest_url()}{endpoint}"
    headers = settings.get_shopify_headers()
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=30)
    except Exception as e:
        logger.error(f"Error conectando a Shopify: {e}")
        raise HTTPException(status_code=503, detail=f"No se pudo conectar a Shopify: {e}")

    if resp.status_code == 429:
        raise HTTPException(status_code=429, detail="Shopify rate limit, intenta en unos segundos")
    if resp.status_code != 200:
        logger.error(f"Shopify HTTP {resp.status_code}: {resp.text[:500]}")
        raise HTTPException(status_code=502, detail=f"Shopify respondio HTTP {resp.status_code}")

    return resp.json()


@router.get("/")
def list_transfers(
    limit: int = Query(50, ge=1, le=250),
    since_id: int | None = Query(None),
):
    """Lista transfers de inventario entre ubicaciones."""
    params: dict = {"limit": limit}
    if since_id:
        params["since_id"] = since_id

    data = _rest_get("/transfers.json", params)
    transfers = data.get("transfers", [])

    return {
        "transfers": transfers,
        "total": len(transfers),
    }


@router.get("/count")
def count_transfers():
    """Cuenta el total de transfers."""
    data = _rest_get("/transfers/count.json")
    return {"count": data.get("count", 0)}


@router.get("/{transfer_id}")
def get_transfer(transfer_id: int):
    """Obtiene un transfer especifico con sus line items."""
    data = _rest_get(f"/transfers/{transfer_id}.json")
    transfer = data.get("transfer")
    if not transfer:
        raise HTTPException(status_code=404, detail=f"Transfer {transfer_id} no encontrado")
    return transfer
