"""
Procesador de la cola Firestore `pedidos_outbox`.

Flujo:
1. Frontend escribe doc en `pedidos_outbox` con status='pending', archivo
   en base64, kind=('sede'|'ciudad') y todos los parámetros del pedido.
2. Este servicio polea cada N segundos, toma docs pending, los marca
   como 'processing', envía el email, y actualiza status a 'sent' o
   'error' con detalle.

Esto evita que el navegador haga POSTs a easypanel.host — útil cuando
algún AV/firewall corporativo bloquea esos POSTs específicamente.
"""
from __future__ import annotations

import base64
import logging
import threading
from datetime import datetime, timedelta, timezone

from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from routers.pedidos import (
    SEDES,
    CIUDADES,
    DESTINATARIOS_B2B,
    _get_proveedores_from_directory,
    _build_sede_html,
    _build_ciudad_html,
)
from services.email_service import send_email
from services.firebase_service import get_firestore_db

logger = logging.getLogger("bukz.pedidos_outbox")

OUTBOX_COLLECTION = "pedidos_outbox"
PROCESSING_TTL_MINUTES = 10  # docs en 'processing' >10min se reintentan
MAX_AGE_HOURS = 6  # docs viejos no se procesan
_processor_lock = threading.Lock()


def _claim_doc(doc_ref) -> bool:
    """Marca un doc como 'processing' atómicamente. True si se reclamó."""
    db = get_firestore_db()

    @db.transactional
    def _txn(transaction):
        snap = doc_ref.get(transaction=transaction)
        if not snap.exists:
            return False
        data = snap.to_dict() or {}
        status = data.get("status")
        # Reclamamos pendings o processings vencidos (timeout)
        if status == "pending":
            transaction.update(
                doc_ref,
                {"status": "processing", "claimed_at": SERVER_TIMESTAMP},
            )
            return True
        if status == "processing":
            claimed_at = data.get("claimed_at")
            if claimed_at:
                age = datetime.now(timezone.utc) - claimed_at
                if age > timedelta(minutes=PROCESSING_TTL_MINUTES):
                    transaction.update(
                        doc_ref,
                        {"status": "processing", "claimed_at": SERVER_TIMESTAMP},
                    )
                    return True
        return False

    transaction = db.transaction()
    return _txn(transaction)


def _process_doc(doc_id: str, data: dict) -> None:
    """Procesa un pedido pending: arma email y lo envía."""
    doc_ref = get_firestore_db().collection(OUTBOX_COLLECTION).document(doc_id)
    try:
        kind = data.get("kind")  # 'sede' | 'ciudad'
        proveedor = data.get("proveedor", "")
        destino = data.get("destino", "")  # nombre sede o ciudad
        tipo = data.get("tipo", "")
        mes = data.get("mes", "")
        anio = data.get("anio", "")
        remitente = data.get("remitente", "Pedidos Bukz")
        archivo_b64 = data.get("archivo_b64", "")
        archivo_nombre = data.get("archivo_nombre", "pedido.xlsx")

        if not archivo_b64:
            raise ValueError("archivo_b64 vacío")
        archivo_bytes = base64.b64decode(archivo_b64, validate=True)

        proveedores = _get_proveedores_from_directory()
        if not proveedores:
            raise RuntimeError("No se pudo cargar la lista de proveedores")
        if proveedor not in proveedores:
            raise ValueError(f"Proveedor '{proveedor}' no encontrado")

        if kind == "sede":
            if destino not in SEDES:
                raise ValueError(f"Sede '{destino}' no encontrada")
            sede_info = SEDES[destino]
            fecha_str = datetime.now().strftime("%d %b %Y")
            asunto = f"Pedido BUKZ {tipo} - Sede: {destino} - {proveedor} - {fecha_str}"
            html_body = _build_sede_html(destino, sede_info)
            fecha_file = datetime.now().strftime("%d_%m_%Y")
            nombre_default = f"Pedido_{destino}_{mes}_{anio}_{fecha_file}.xlsx"
        elif kind == "ciudad":
            if destino not in CIUDADES:
                raise ValueError(f"Ciudad '{destino}' no válida")
            asunto = f"Pedido {mes} Bukz {destino} {anio} - {proveedor}"
            if tipo == "Novedad":
                asunto = f"Novedad - {asunto}"
            elif tipo == "B2B":
                asunto = f"PEDIDOS B2B - {asunto}"
            html_body = _build_ciudad_html(destino)
            fecha_file = datetime.now().strftime("%d_%m_%Y")
            nombre_default = f"Pedido_{destino}_{mes}_{anio}_{fecha_file}.xlsx"
        else:
            raise ValueError(f"kind inválido: {kind!r}")

        correos = list(proveedores[proveedor])
        if tipo == "B2B":
            correos = correos + DESTINATARIOS_B2B

        nombre_archivo = archivo_nombre or nombre_default

        send_email(
            to=[correos[0]],
            subject=asunto,
            html_body=html_body,
            sender_name=remitente,
            cc=correos[1:] if len(correos) > 1 else None,
            attachments=[(nombre_archivo, archivo_bytes)],
        )

        doc_ref.update(
            {
                "status": "sent",
                "asunto": asunto,
                "correos": correos,
                "processed_at": SERVER_TIMESTAMP,
                "error": None,
                # Borramos el blob para no inflar Firestore
                "archivo_b64": "",
            }
        )
        logger.info("[outbox] Pedido %s enviado a %s", doc_id, ", ".join(correos))
    except Exception as e:
        logger.exception("[outbox] Error procesando %s: %s", doc_id, e)
        try:
            doc_ref.update(
                {
                    "status": "error",
                    "error": str(e)[:500],
                    "processed_at": SERVER_TIMESTAMP,
                    "archivo_b64": "",
                }
            )
        except Exception:
            logger.exception("[outbox] No se pudo marcar el doc como error")


def process_outbox_tick():
    """Una pasada del polling. Llamado por APScheduler."""
    if not _processor_lock.acquire(blocking=False):
        return  # otro tick en curso
    try:
        db = get_firestore_db()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=MAX_AGE_HOURS)
        # Tomamos todos los pending recientes en una sola query.
        q = (
            db.collection(OUTBOX_COLLECTION)
            .where("status", "==", "pending")
            .limit(20)
        )
        docs = list(q.stream())
        if not docs:
            return
        for snap in docs:
            data = snap.to_dict() or {}
            created_at = data.get("created_at")
            if created_at and created_at < cutoff:
                snap.reference.update({"status": "expired"})
                continue
            doc_ref = snap.reference
            if not _claim_doc(doc_ref):
                continue
            # re-leer datos por si cambió en el claim
            fresh = doc_ref.get().to_dict() or data
            _process_doc(doc_ref.id, fresh)
    except Exception:
        logger.exception("[outbox] tick falló")
    finally:
        _processor_lock.release()
