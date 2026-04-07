"""
Helpers compartidos para los módulos Celesa (inventario y sincronización de pedidos).
"""

import time

import requests as http_requests

from config import settings
from services.shopify_service import _throttler

DROPSHIPPING_LOCATION_NAME = "Dropshipping [España]"
VENDOR_FILTER = "Bukz España"


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


def get_dropshipping_location() -> str:
    """Retorna el GID de la location 'Dropshipping [España]'."""
    data = gql('{ locations(first: 250) { edges { node { id name } } } }')
    for edge in data["locations"]["edges"]:
        if edge["node"]["name"] == DROPSHIPPING_LOCATION_NAME:
            return edge["node"]["id"]
    raise RuntimeError(
        f"Location '{DROPSHIPPING_LOCATION_NAME}' no encontrada en Shopify"
    )
