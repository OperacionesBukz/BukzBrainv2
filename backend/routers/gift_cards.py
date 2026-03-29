"""
Router de Gift Cards — endpoints para crear y listar tarjetas de regalo de Shopify.
"""
import logging
import re
from datetime import date, timedelta

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gift-cards", tags=["Gift Cards"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class GiftCardCreateRequest(BaseModel):
    initial_value: str = Field(..., description="Valor inicial en COP (ej: '50000')")
    note: str = Field("", description="Nota interna opcional")
    customer_email: str = Field("", description="Email del cliente (opcional)")
    expires_months: int = Field(12, ge=1, le=60, description="Meses hasta expiración")


class GiftCardSearchRequest(BaseModel):
    query: str = Field("", description="Filtro de búsqueda (ej: 'enabled:true')")
    limit: int = Field(20, ge=1, le=100)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sanitize(value: str) -> str:
    return re.sub(r'["\\\n\r{}()\[\]]', "", value.strip())


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
        raise HTTPException(status_code=502, detail=f"Shopify respondió HTTP {resp.status_code}")

    data = resp.json()

    if "errors" in data:
        error_msgs = [e.get("message", str(e)) for e in data["errors"]]
        logger.error(f"Shopify GraphQL errors: {error_msgs}")
        raise HTTPException(status_code=400, detail=f"Error Shopify: {'; '.join(error_msgs)}")

    return data.get("data", {})


# ---------------------------------------------------------------------------
# Queries y Mutations
# ---------------------------------------------------------------------------

_GIFT_CARD_CREATE = """
mutation giftCardCreate($input: GiftCardCreateInput!) {
  giftCardCreate(input: $input) {
    giftCard {
      id
      code
      balance { amount currencyCode }
      initialValue { amount currencyCode }
      expiresOn
      enabled
      note
      createdAt
      customer { id email firstName lastName }
    }
    userErrors { field message }
  }
}
"""

_GIFT_CARDS_QUERY = """
query giftCards($first: Int!, $query: String, $after: String) {
  giftCards(first: $first, query: $query, after: $after) {
    edges {
      node {
        id
        code
        balance { amount currencyCode }
        initialValue { amount currencyCode }
        expiresOn
        enabled
        note
        createdAt
        customer { id email firstName lastName }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
"""

_GIFT_CARD_DISABLE = """
mutation giftCardDisable($id: ID!) {
  giftCardDisable(id: $id) {
    giftCard { id enabled }
    userErrors { field message }
  }
}
"""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/health")
def health_check():
    """Verifica conexión con Shopify."""
    from services import shopify_service
    result = shopify_service.verify_shopify_connection()
    if not result.get("connected"):
        raise HTTPException(status_code=503, detail=result.get("error", "No conectado"))
    return result


@router.post("/create")
def create_gift_card(req: GiftCardCreateRequest):
    """Crea una nueva tarjeta de regalo en Shopify."""
    try:
        value = float(req.initial_value)
        if value <= 0:
            raise ValueError
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="El valor debe ser un número positivo")

    expires_on = (date.today() + timedelta(days=req.expires_months * 30)).isoformat()

    variables: dict = {
        "input": {
            "initialValue": req.initial_value,
            "note": req.note or None,
            "expiresOn": expires_on,
        }
    }

    if req.customer_email:
        customer_id = _find_customer_by_email(req.customer_email)
        if customer_id:
            variables["input"]["customerId"] = customer_id

    data = _graphql(_GIFT_CARD_CREATE, variables)
    result = data.get("giftCardCreate", {})

    user_errors = result.get("userErrors", [])
    if user_errors:
        msgs = [f"{e.get('field', '?')}: {e.get('message', '?')}" for e in user_errors]
        raise HTTPException(status_code=400, detail="; ".join(msgs))

    gift_card = result.get("giftCard")
    if not gift_card:
        raise HTTPException(status_code=500, detail="No se pudo crear la gift card")

    return {
        "success": True,
        "gift_card": _format_gift_card(gift_card),
    }


@router.post("/search")
def search_gift_cards(req: GiftCardSearchRequest):
    """Lista/busca tarjetas de regalo en Shopify."""
    variables: dict = {
        "first": req.limit,
        "query": req.query or None,
    }

    data = _graphql(_GIFT_CARDS_QUERY, variables)
    gift_cards_data = data.get("giftCards", {})
    edges = gift_cards_data.get("edges", [])
    page_info = gift_cards_data.get("pageInfo", {})

    cards = [_format_gift_card(edge["node"]) for edge in edges]

    return {
        "gift_cards": cards,
        "total": len(cards),
        "has_next": page_info.get("hasNextPage", False),
    }


@router.post("/disable/{gift_card_gid}")
def disable_gift_card(gift_card_gid: str):
    """Desactiva una tarjeta de regalo."""
    if not gift_card_gid.startswith("gid://shopify/GiftCard/"):
        gift_card_gid = f"gid://shopify/GiftCard/{gift_card_gid}"

    data = _graphql(_GIFT_CARD_DISABLE, {"id": gift_card_gid})
    result = data.get("giftCardDisable", {})

    user_errors = result.get("userErrors", [])
    if user_errors:
        msgs = [f"{e.get('field', '?')}: {e.get('message', '?')}" for e in user_errors]
        raise HTTPException(status_code=400, detail="; ".join(msgs))

    return {"success": True, "enabled": result.get("giftCard", {}).get("enabled", False)}


# ---------------------------------------------------------------------------
# Utilidades internas
# ---------------------------------------------------------------------------

def _find_customer_by_email(email: str) -> str | None:
    query = """
    query customerByEmail($query: String!) {
      customers(first: 1, query: $query) {
        edges { node { id email } }
      }
    }
    """
    safe_email = _sanitize(email)
    try:
        data = _graphql(query, {"query": f"email:{safe_email}"})
        edges = data.get("customers", {}).get("edges", [])
        if edges:
            return edges[0]["node"]["id"]
    except Exception:
        pass
    return None


def _format_gift_card(gc: dict) -> dict:
    customer = gc.get("customer")
    return {
        "id": gc.get("id", ""),
        "code": gc.get("code", ""),
        "balance": gc.get("balance", {}).get("amount", "0"),
        "currency": gc.get("balance", {}).get("currencyCode", "COP"),
        "initial_value": gc.get("initialValue", {}).get("amount", "0"),
        "expires_on": gc.get("expiresOn"),
        "enabled": gc.get("enabled", False),
        "note": gc.get("note", ""),
        "created_at": gc.get("createdAt", ""),
        "customer_email": customer.get("email", "") if customer else "",
        "customer_name": f"{customer.get('firstName', '')} {customer.get('lastName', '')}".strip() if customer else "",
    }
