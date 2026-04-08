"""
Router de Transfers - consulta transfers de inventario entre ubicaciones en Shopify.
Usa GraphQL Admin API (inventoryTransfers query).
Endpoints sin auth Firebase para acceso directo (lectura solamente).
"""
import logging

import requests
from fastapi import APIRouter, HTTPException, Query

from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transfers", tags=["Transfers"])


def _graphql(query: str, variables: dict | None = None) -> dict:
    """Ejecuta query GraphQL contra Shopify y retorna data."""
    payload: dict = {"query": query}
    if variables:
        payload["variables"] = variables

    headers = settings.get_shopify_headers()
    url = settings.get_graphql_url()

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
    except Exception as e:
        logger.error(f"Error conectando a Shopify: {e}")
        raise HTTPException(status_code=503, detail=f"No se pudo conectar a Shopify: {e}")

    if resp.status_code == 429:
        raise HTTPException(status_code=429, detail="Shopify rate limit, intenta en unos segundos")

    if resp.status_code != 200:
        logger.error(f"Shopify HTTP {resp.status_code}: {resp.text[:500]}")
        raise HTTPException(status_code=502, detail=f"Shopify respondio HTTP {resp.status_code}")

    data = resp.json()

    if "errors" in data:
        error_msgs = [e.get("message", str(e)) for e in data["errors"]]
        logger.error(f"Shopify GraphQL errors: {error_msgs}")
        raise HTTPException(status_code=400, detail=f"Error Shopify: {'; '.join(error_msgs)}")

    return data.get("data", {})


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

_TRANSFERS_LIST = """
query inventoryTransfers($first: Int!, $after: String, $query: String, $sortKey: TransferSortKeys, $reverse: Boolean) {
  inventoryTransfers(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
    edges {
      node {
        id
        name
        status
        dateCreated
        totalQuantity
        receivedQuantity
        note
        referenceName
        tags
        origin {
          location { id name }
        }
        destination {
          location { id name }
        }
        lineItemsCount { count }
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
"""

_TRANSFER_DETAIL = """
query inventoryTransfer($id: ID!) {
  inventoryTransfer(id: $id) {
    id
    name
    status
    dateCreated
    totalQuantity
    receivedQuantity
    note
    referenceName
    tags
    origin {
      location { id name }
    }
    destination {
      location { id name }
    }
    lineItems(first: 250) {
      edges {
        node {
          id
          quantity
          receivedQuantity
          inventoryItem {
            id
            sku
            variant {
              id
              title
              displayName
              product {
                id
                title
                vendor
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
"""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/")
def list_transfers(
    limit: int = Query(50, ge=1, le=250),
    after: str | None = Query(None, description="Cursor para paginacion"),
    query: str | None = Query(None, description="Filtro: status, origin_id, destination_id, tag, created_at"),
    sort_key: str = Query("CREATED_AT", description="Campo de ordenamiento: ID, CREATED_AT"),
    reverse: bool = Query(True, description="Orden descendente (mas recientes primero)"),
):
    """Lista transfers de inventario entre ubicaciones."""
    variables: dict = {
        "first": limit,
        "sortKey": sort_key,
        "reverse": reverse,
    }
    if after:
        variables["after"] = after
    if query:
        variables["query"] = query

    data = _graphql(_TRANSFERS_LIST, variables)
    connection = data.get("inventoryTransfers", {})
    edges = connection.get("edges", [])
    page_info = connection.get("pageInfo", {})

    transfers = []
    for edge in edges:
        node = edge["node"]
        transfers.append({
            "id": node.get("id"),
            "name": node.get("name"),
            "status": node.get("status"),
            "date_created": node.get("dateCreated"),
            "total_quantity": node.get("totalQuantity"),
            "received_quantity": node.get("receivedQuantity"),
            "note": node.get("note"),
            "reference_name": node.get("referenceName"),
            "tags": node.get("tags", []),
            "origin": (node.get("origin") or {}).get("location", {}).get("name"),
            "destination": (node.get("destination") or {}).get("location", {}).get("name"),
            "line_items_count": (node.get("lineItemsCount") or {}).get("count", 0),
            "cursor": edge.get("cursor"),
        })

    return {
        "transfers": transfers,
        "total": len(transfers),
        "has_next_page": page_info.get("hasNextPage", False),
        "end_cursor": page_info.get("endCursor"),
    }


@router.get("/{transfer_id}")
def get_transfer(transfer_id: str):
    """Obtiene un transfer con sus line items. Acepta ID numerico o GID completo."""
    if not transfer_id.startswith("gid://"):
        transfer_id = f"gid://shopify/InventoryTransfer/{transfer_id}"

    data = _graphql(_TRANSFER_DETAIL, {"id": transfer_id})
    transfer = data.get("inventoryTransfer")
    if not transfer:
        raise HTTPException(status_code=404, detail=f"Transfer {transfer_id} no encontrado")

    line_items = []
    for edge in transfer.get("lineItems", {}).get("edges", []):
        node = edge["node"]
        inv_item = node.get("inventoryItem") or {}
        variant = inv_item.get("variant") or {}
        product = variant.get("product") or {}
        line_items.append({
            "id": node.get("id"),
            "quantity": node.get("quantity"),
            "received_quantity": node.get("receivedQuantity"),
            "sku": inv_item.get("sku"),
            "variant_title": variant.get("displayName"),
            "product_title": product.get("title"),
            "vendor": product.get("vendor"),
        })

    return {
        "id": transfer.get("id"),
        "name": transfer.get("name"),
        "status": transfer.get("status"),
        "date_created": transfer.get("dateCreated"),
        "total_quantity": transfer.get("totalQuantity"),
        "received_quantity": transfer.get("receivedQuantity"),
        "note": transfer.get("note"),
        "reference_name": transfer.get("referenceName"),
        "tags": transfer.get("tags", []),
        "origin": (transfer.get("origin") or {}).get("location", {}).get("name"),
        "destination": (transfer.get("destination") or {}).get("location", {}).get("name"),
        "line_items": line_items,
        "line_items_has_next": transfer.get("lineItems", {}).get("pageInfo", {}).get("hasNextPage", False),
    }
