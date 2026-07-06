"""
Helpers compartidos para los módulos Celesa (inventario y sincronización de pedidos).
"""

import time

import requests as http_requests

from config import settings
from services.shopify_service import _throttler

DROPSHIPPING_LOCATION_NAME = "Dropshipping [España]"
VENDOR_FILTER = "Bukz España"

# Estados de fulfillmentOrder que significan "esta línea aún se va a despachar
# desde la location asignada". CLOSED/CANCELLED se excluyen: o ya se despachó
# desde una sede (stock local) o es un FO residual de un move.
FULFILLABLE_FO_STATUSES = {"OPEN", "IN_PROGRESS", "SCHEDULED", "ON_HOLD", "INCOMPLETE"}


def gql(query: str, variables: dict | None = None, timeout: int = 30, _retries: int = 5) -> dict:
    """Ejecuta una query GraphQL contra Shopify con throttling y reintentos."""
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
        retry_after = max(float(resp.headers.get("Retry-After", "4")), 4.0)
        print(f"[GQL] 429 rate limited, sleeping {retry_after}s (retries left: {_retries})", flush=True)
        time.sleep(retry_after)
        return gql(query, variables, timeout, _retries - 1)
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
            print(f"[GQL] GraphQL THROTTLED, sleeping 4s (retries left: {_retries})", flush=True)
            time.sleep(4.0)
            return gql(query, variables, timeout, _retries - 1)
        raise RuntimeError(f"GraphQL errors: {body['errors']}")
    return body["data"]


_ORDER_FO_QUERY = """
query($id: ID!) {
  order(id: $id) {
    cancelledAt
    fulfillmentOrders(first: 25) {
      pageInfo { hasNextPage }
      edges { node {
        status
        assignedLocation { name }
        lineItems(first: 50) {
          edges { node {
            totalQuantity
            remainingQuantity
            lineItem { id }
          } }
        }
      } }
    }
  }
}
"""


def get_dropshipping_line_quantities(order_gid: str) -> tuple[dict[int, int], str]:
    """Cantidades por línea que Shopify enrutó a 'Dropshipping [España]'.

    Retorna ({line_item_id_numérico: cantidad}, status) donde status es:
      "ok"        — el pedido tiene fulfillmentOrders (el dict puede quedar vacío
                    si ninguna línea va a dropshipping: stock local)
      "no_order"  — el pedido ya no existe en Shopify (borrado)
      "cancelled" — el pedido está cancelado
      "no_fos"    — existe pero aún sin fulfillmentOrders (el order routing es
                    asíncrono y puede no haber corrido; reintentar luego)
    Solo cuenta FOs en estado accionable (FULFILLABLE_FO_STATUSES): un FO CLOSED en
    una sede es una venta con stock local; uno CLOSED en Dropshipping es residuo de un move.
    Timeout/reintentos cortos a propósito: el reintento real lo hace Shopify
    reenviando el webhook, no este proceso.
    """
    data = gql(_ORDER_FO_QUERY, {"id": order_gid}, timeout=8, _retries=1)
    order = data.get("order")
    if not order:
        return {}, "no_order"
    if order.get("cancelledAt"):
        return {}, "cancelled"
    fos = order.get("fulfillmentOrders") or {}
    fo_edges = fos.get("edges", [])
    if not fo_edges:
        return {}, "no_fos"
    if (fos.get("pageInfo") or {}).get("hasNextPage"):
        print(f"[CELESA] ADVERTENCIA: {order_gid} tiene >25 fulfillmentOrders, lista truncada", flush=True)
    quantities: dict[int, int] = {}
    for fo_edge in fo_edges:
        fo = fo_edge["node"]
        if (fo.get("assignedLocation") or {}).get("name") != DROPSHIPPING_LOCATION_NAME:
            continue
        if fo.get("status") not in FULFILLABLE_FO_STATUSES:
            continue
        for li_edge in (fo.get("lineItems") or {}).get("edges", []):
            node = li_edge["node"]
            gid = (node.get("lineItem") or {}).get("id") or ""
            try:
                li_id = int(gid.rsplit("/", 1)[-1])
            except ValueError:
                continue
            qty = node.get("remainingQuantity")
            if qty is None:
                qty = node.get("totalQuantity") or 0
            if qty > 0:
                quantities[li_id] = quantities.get(li_id, 0) + qty
    return quantities, "ok"


def get_dropshipping_location() -> str:
    """Retorna el GID de la location 'Dropshipping [España]'."""
    data = gql('{ locations(first: 250) { edges { node { id name } } } }')
    for edge in data["locations"]["edges"]:
        if edge["node"]["name"] == DROPSHIPPING_LOCATION_NAME:
            return edge["node"]["id"]
    raise RuntimeError(
        f"Location '{DROPSHIPPING_LOCATION_NAME}' no encontrada en Shopify"
    )
