"""
Router para webhooks de Shopify.
Recibe notificaciones de eventos y actualiza datos en Firestore.
"""
import base64
import hashlib
import hmac
import json
import logging
from datetime import datetime
from html import escape as _esc

from fastapi import APIRouter, HTTPException, Header, Request
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from config import settings
from services.celesa_common import VENDOR_FILTER
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


@router.post("/shopify/products-update")
async def handle_products_update(
    request: Request,
    x_shopify_hmac_sha256: str = Header(...),
):
    """
    Webhook: products/update y products/create
    Actualiza el catálogo de productos incrementalmente cuando se crea o actualiza
    un producto en Shopify.
    """
    body = await request.body()

    if not _verify_hmac(body, x_shopify_hmac_sha256):
        raise HTTPException(status_code=401, detail="Firma HMAC invalida")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="JSON invalido")

    vendor = payload.get("vendor", "")
    title = payload.get("title", "")
    variants = payload.get("variants", [])

    if not variants:
        return {"status": "ok", "updated": 0}

    # Read current catalog (ignore TTL — always update even if stale)
    from services.scheduler_service import read_product_catalog, write_product_catalog
    items, meta = read_product_catalog(check_ttl=False)
    if items is None:
        items = []

    # Remove old entries for this product's SKUs and add new ones
    new_skus = {v.get("sku", "").strip() for v in variants if v.get("sku", "").strip()}
    # Keep items that don't belong to these SKUs
    items = [item for item in items if item.get("sku") not in new_skus]
    # Add updated entries
    for sku in new_skus:
        items.append({"sku": sku, "vendor": vendor, "title": title})

    write_product_catalog(items)

    logger.info(
        "Webhook products/update: %d SKUs actualizados para '%s'",
        len(new_skus),
        title,
    )
    return {"status": "ok", "updated": len(new_skus)}


# ---------------------------------------------------------------------------
# orders/paid  ->  detecta libros Celesa (Bukz España), los registra en
# celesa_orders y avisa por correo a ux@bukz.co para pedirlos a Celesa.
# ---------------------------------------------------------------------------

CELESA_EMAIL_TO = ["ux@bukz.co"]
CELESA_SENDER_NAME = "BukzBrain · Celesa"


def _sanitize_doc_id(order_name: str, key: str) -> str:
    """ID determinístico de Firestore para una línea Celesa (numeroPedido + isbn).

    Firestore no permite '/' en el ID; quitamos '#' para que quede legible.
    """
    raw = f"{order_name}_{key}".replace("/", "-").replace("#", "")
    return raw.strip() or "celesa"


def _resolve_celesa_lines(line_items: list[dict]) -> list[dict]:
    """Filtra las líneas cuyo vendor es Celesa (Bukz España).

    Señal principal: line_items[].vendor. Fallback por SKU contra el catálogo
    interno (mantenido por el webhook products/update) cuando el vendor viene vacío.
    """
    celesa: list[dict] = []
    missing_vendor = False
    for li in line_items:
        vendor = (li.get("vendor") or "").strip()
        if vendor == VENDOR_FILTER:
            celesa.append(li)
        elif not vendor:
            missing_vendor = True

    if missing_vendor:
        try:
            from services.scheduler_service import read_product_catalog
            items, _ = read_product_catalog(check_ttl=False)
            sku_vendor = {i.get("sku"): i.get("vendor") for i in (items or [])}
            for li in line_items:
                if (li.get("vendor") or "").strip():
                    continue
                if sku_vendor.get((li.get("sku") or "").strip()) == VENDOR_FILTER:
                    celesa.append(li)
        except Exception as e:  # el fallback nunca debe tumbar el webhook
            logger.warning("Fallback SKU→vendor Celesa falló: %s", e)

    return celesa


def _send_celesa_email(order_name: str, cliente: str, fecha: str, lines: list[dict]) -> None:
    """Envía un correo a ux@bukz.co con todos los libros Celesa a pedir del pedido."""
    from services.email_service import send_email, wrap_email_template

    rows = "".join(
        f'<tr>'
        f'<td style="padding:8px 12px;border:1px solid #ddd;font-size:13px;">{_esc(l["producto"])}</td>'
        f'<td style="padding:8px 12px;border:1px solid #ddd;font-size:13px;">{_esc(l["isbn"])}</td>'
        f'<td style="padding:8px 12px;border:1px solid #ddd;font-size:13px;text-align:center;">{l["cantidad"]}</td>'
        f'</tr>'
        for l in lines
    )
    content = f"""<p style="margin:6px 0;line-height:1.6;">Se pag&oacute; un pedido con libros que hay que pedir a <strong>Celesa</strong> (Bukz Espa&ntilde;a).</p>
<p style="margin:12px 0 4px;line-height:1.6;"><strong>Pedido:</strong> {_esc(order_name)}<br>
<strong>Cliente:</strong> {_esc(cliente) or "&mdash;"}<br>
<strong>Fecha del pedido:</strong> {_esc(fecha) or "&mdash;"}</p>
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:10px 0;width:100%;">
<tr>
<th style="padding:8px 12px;background:#f8f8f8;border:1px solid #ddd;font-weight:700;text-align:left;font-size:13px;">Producto</th>
<th style="padding:8px 12px;background:#f8f8f8;border:1px solid #ddd;font-weight:700;text-align:left;font-size:13px;">ISBN</th>
<th style="padding:8px 12px;background:#f8f8f8;border:1px solid #ddd;font-weight:700;text-align:center;font-size:13px;">Cant.</th>
</tr>
{rows}
</table>
<p style="margin:12px 0;font-size:13px;color:#666;">Seguimiento: <a href="https://operacionesbukz.github.io/BukzBrainv2/celesa-seguimiento">celesa-seguimiento</a></p>"""

    n = len(lines)
    subject = f"Celesa: {n} libro{'s' if n != 1 else ''} para pedir — pedido {order_name}"
    send_email(
        to=CELESA_EMAIL_TO,
        subject=subject,
        html_body=wrap_email_template(content, sender_name=CELESA_SENDER_NAME),
        sender_name=CELESA_SENDER_NAME,
    )


@router.post("/shopify/orders-paid")
async def handle_orders_paid(
    request: Request,
    x_shopify_hmac_sha256: str = Header(...),
):
    """
    Webhook: orders/paid
    Cuando un pedido se marca como pagado en Shopify, detecta las líneas cuyo
    vendor es 'Bukz España' (Celesa), las registra en celesa_orders como
    'Pendiente' y envía un correo a ux@bukz.co para pedirlas a Celesa.

    Idempotente: deduplica por (numeroPedido, isbn) — no crea filas ni correos
    duplicados si Shopify reintenta o si el pedido ya entró por el sync manual.
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
        logger.warning("Webhook orders/paid sin campo 'name' en payload")
        return {"status": "ignored", "reason": "no order name"}

    celesa_lines = _resolve_celesa_lines(payload.get("line_items", []))
    if not celesa_lines:
        return {"status": "ok", "order_name": order_name, "celesa_lines": 0}

    # Datos del pedido
    cust = payload.get("customer") or {}
    cliente = f"{cust.get('first_name', '') or ''} {cust.get('last_name', '') or ''}".strip()
    if not cliente:
        cliente = payload.get("email", "") or cust.get("email", "") or ""

    fecha = ""
    created_at = payload.get("created_at", "")
    if created_at:
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            fecha = dt.strftime("%Y-%m-%d")
        except ValueError:
            fecha = created_at[:10]

    db = get_firestore_db()

    # Dedup vs sync manual (IDs aleatorios) y reintentos: por numeroPedido + isbn
    existing_docs = (
        db.collection("celesa_orders")
        .where("numeroPedido", "==", order_name)
        .stream()
    )
    existing_isbns = {doc.to_dict().get("isbn", "") for doc in existing_docs}

    new_lines: list[dict] = []
    for li in celesa_lines:
        isbn = (li.get("sku") or "").strip()
        title = li.get("title") or ""
        qty = li.get("quantity", 1) or 1

        if isbn and isbn in existing_isbns:
            continue  # ya registrado (manual o webhook previo)

        doc_id = _sanitize_doc_id(order_name, isbn or title)
        ref = db.collection("celesa_orders").document(doc_id)
        if ref.get().exists:
            continue  # segunda barrera contra reintentos concurrentes

        ref.set({
            "numeroPedido": order_name,
            "cliente": cliente,
            "producto": title,
            "isbn": isbn,
            "fechaPedido": fecha,
            "estado": "Pendiente",
            "createdBy": "shopify-webhook",
            "createdAt": SERVER_TIMESTAMP,
            "updatedAt": SERVER_TIMESTAMP,
        })
        new_lines.append({"producto": title, "isbn": isbn, "cantidad": qty})
        if isbn:
            existing_isbns.add(isbn)

    if new_lines:
        try:
            _send_celesa_email(order_name, cliente, fecha, new_lines)
            logger.info(
                "Pedido %s: %d línea(s) Celesa registradas + correo a ux@bukz.co",
                order_name,
                len(new_lines),
            )
        except Exception as e:
            # El correo no debe tumbar el webhook (Shopify reintentaría y duplicaría filas)
            logger.error("Error enviando correo Celesa para %s: %s", order_name, e)

    return {
        "status": "ok",
        "order_name": order_name,
        "celesa_lines": len(celesa_lines),
        "new": len(new_lines),
    }
