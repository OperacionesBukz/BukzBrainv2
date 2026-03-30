"""
Router para webhooks de Shopify.
Recibe notificaciones de eventos y actualiza datos en Firestore.
"""
import base64
import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, HTTPException, Header, Request
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from config import settings
from services.firebase_service import get_firestore_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])


def _verify_hmac(body: bytes, hmac_header: str) -> bool:
    """Verifica la firma HMAC-SHA256 de un webhook de Shopify."""
    secret = settings.SHOPIFY_WEBHOOK_SECRET.encode("utf-8")
    digest = hmac.new(secret, body, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode("utf-8")
    return hmac.compare_digest(expected, hmac_header)


@router.get("/health")
def health():
    """Health check del router de webhooks."""
    return {
        "status": "ok",
        "webhook_secret_configured": bool(settings.SHOPIFY_WEBHOOK_SECRET),
    }


@router.post("/shopify/orders-fulfilled")
async def handle_orders_fulfilled(
    request: Request,
    x_shopify_hmac_sha256: str = Header(...),
):
    """
    Webhook: orders/fulfilled
    Cuando un pedido se marca como Fulfilled en Shopify,
    actualiza los pedidos Celesa con el mismo Order Name a 'Entregado'.
    """
    body = await request.body()

    if not _verify_hmac(body, x_shopify_hmac_sha256):
        raise HTTPException(status_code=401, detail="Firma HMAC invalida")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="JSON invalido")

    order_name = payload.get("name", "")
    if not order_name:
        logger.warning("Webhook orders/fulfilled sin campo 'name' en payload")
        return {"status": "ignored", "reason": "no order name"}

    logger.info("Webhook orders/fulfilled recibido para pedido %s", order_name)

    # Buscar pedidos Celesa con ese numero de pedido
    db = get_firestore_db()
    docs = (
        db.collection("celesa_orders")
        .where("numeroPedido", "==", order_name)
        .stream()
    )

    updated = 0
    for doc in docs:
        data = doc.to_dict()
        estado = data.get("estado", "")
        # No sobrescribir estados finales
        if estado in ("Entregado", "Agotado"):
            continue
        doc.reference.update({
            "estado": "Entregado",
            "updatedAt": SERVER_TIMESTAMP,
        })
        updated += 1

    logger.info(
        "Pedido %s: %d orden(es) Celesa actualizadas a Entregado",
        order_name,
        updated,
    )
    return {"status": "ok", "order_name": order_name, "updated": updated}
