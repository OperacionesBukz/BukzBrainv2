"""
Cliente Evolution API (WhatsApp) para envío de mensajes y archivos.

Configurado vía settings.EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE.
"""
import base64
import re
from typing import Optional

import httpx
from fastapi import HTTPException

from config import settings


def _normalizar_numero(numero: str) -> str:
    digits = re.sub(r"\D", "", numero or "")
    if not digits:
        raise HTTPException(status_code=400, detail="Número de WhatsApp vacío o inválido")
    return digits


def _base_headers() -> dict:
    if not settings.EVOLUTION_API_KEY:
        raise HTTPException(status_code=503, detail="EVOLUTION_API_KEY no configurada")
    return {"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"}


async def send_text(numero: str, texto: str) -> dict:
    """Envía un mensaje de texto. `numero` puede incluir +, espacios o guiones."""
    if not texto.strip():
        raise HTTPException(status_code=400, detail="Mensaje vacío")

    url = f"{settings.EVOLUTION_API_URL}/message/sendText/{settings.EVOLUTION_INSTANCE}"
    payload = {"number": _normalizar_numero(numero), "text": texto}

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, headers=_base_headers(), json=payload)

    if r.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Evolution rechazó el mensaje (HTTP {r.status_code}): {r.text[:300]}"
        )
    return r.json()


async def send_media(
    numero: str,
    file_content: bytes,
    file_name: str,
    mimetype: str,
    caption: Optional[str] = None,
) -> dict:
    """Envía un archivo (xlsx, pdf, imagen) por WhatsApp con caption opcional."""
    if not file_content:
        raise HTTPException(status_code=400, detail="Archivo vacío")

    if mimetype.startswith("image/"):
        mediatype = "image"
    elif mimetype.startswith("video/"):
        mediatype = "video"
    elif mimetype.startswith("audio/"):
        mediatype = "audio"
    else:
        mediatype = "document"

    url = f"{settings.EVOLUTION_API_URL}/message/sendMedia/{settings.EVOLUTION_INSTANCE}"
    payload = {
        "number": _normalizar_numero(numero),
        "mediatype": mediatype,
        "mimetype": mimetype,
        "media": base64.b64encode(file_content).decode("ascii"),
        "fileName": file_name,
    }
    if caption:
        payload["caption"] = caption

    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(url, headers=_base_headers(), json=payload)

    if r.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Evolution rechazó el archivo (HTTP {r.status_code}): {r.text[:300]}"
        )
    return r.json()


async def connection_state() -> dict:
    """Diagnóstico: estado de la instancia."""
    url = f"{settings.EVOLUTION_API_URL}/instance/connectionState/{settings.EVOLUTION_INSTANCE}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(url, headers=_base_headers())
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Evolution HTTP {r.status_code}: {r.text[:300]}")
    return r.json()
