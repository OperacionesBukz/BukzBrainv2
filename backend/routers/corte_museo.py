"""
Router para Corte Museo — envío de correo con archivo adjunto al Museo de Antioquia.
"""
import json
import re
from html import escape
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from services.email_service import send_email

router = APIRouter(prefix="/api/corte-museo", tags=["corte-museo"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def build_museo_html(mes: str, anio: str) -> str:
    """Template HTML para correo de corte Museo."""
    mes = escape(mes)
    anio = escape(anio)
    return f"""<p>Buenas tardes, espero que todo marche excelente</p>

<p>Te env&iacute;o archivo correspondiente a las ventas de la sede Bukz Museo de Antioquia del mes de {mes} de {anio}.</p>

<p>Saludos!</p>"""


@router.post("/enviar-correo")
async def enviar_correo(
    file: UploadFile = File(...),
    destinatarios: str = Form(...),
    mes: str = Form(...),
    anio: str = Form(...),
    asunto: str = Form(...),
):
    """Envía el correo del corte Museo con archivo adjunto."""
    try:
        recipients = json.loads(destinatarios)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail="Lista de destinatarios inválida")

    if not recipients:
        raise HTTPException(status_code=400, detail="Se requiere al menos un destinatario")

    for r in recipients:
        if not isinstance(r, str) or not _EMAIL_RE.match(r):
            raise HTTPException(status_code=400, detail=f"Correo inválido: {r}")

    file_content = await file.read()
    if not file_content:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    html_body = build_museo_html(mes, anio)

    try:
        send_email(
            to=recipients,
            subject=asunto,
            html_body=html_body,
            sender_name="Bukz Operaciones",
            attachments=[(file.filename or "corte_museo.xlsx", file_content)],
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error enviando correo: {e}")

    return {"success": True, "message": "Correo enviado exitosamente"}
