"""
Router para Corte Planeta — envío de correo con archivo adjunto.
"""
import json
import re
from html import escape
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from services.email_service import send_email

router = APIRouter(prefix="/api/corte-planeta", tags=["corte-planeta"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def build_planeta_html(fecha_inicio: str, fecha_fin: str) -> str:
    """Template HTML para correo de corte Planeta."""
    fecha_inicio = escape(fecha_inicio)
    fecha_fin = escape(fecha_fin)
    return f"""<p>Buenas tardes, espero que se encuentren muy bien.</p>

<p>Adjunto env&iacute;o el corte correspondiente al per&iacute;odo comprendido entre el {fecha_inicio} y el {fecha_fin}.</p>

<p>En el archivo podr&aacute;n encontrar el detalle de:</p>
<ul>
    <li>T&iacute;tulos vendidos por ciudad</li>
    <li>Cantidades correspondientes</li>
</ul>

<p>Quedo atento a cualquier inquietud, comentario o solicitud de informaci&oacute;n adicional.</p>

<p>Cordial saludo,</p>"""


@router.post("/enviar-correo")
async def enviar_correo(
    file: UploadFile = File(...),
    destinatarios: str = Form(...),
    fecha_inicio: str = Form(...),
    fecha_fin: str = Form(...),
    asunto: str = Form(...),
):
    """Envía el correo del corte Planeta con archivo adjunto."""
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

    html_body = build_planeta_html(fecha_inicio, fecha_fin)

    try:
        send_email(
            to=recipients,
            subject=asunto,
            html_body=html_body,
            sender_name="Bukz Operaciones",
            attachments=[(file.filename or "corte_planeta.xlsx", file_content)],
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error enviando correo: {e}")

    return {"success": True, "message": "Correo enviado exitosamente"}
