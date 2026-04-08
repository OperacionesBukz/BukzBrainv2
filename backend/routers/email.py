"""
Router para envío de emails genéricos.
Migrado desde PythonAnywhere (app.py → /send-email).
"""
from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

from services.email_service import send_email, markdown_to_email_html, wrap_email_template

router = APIRouter(prefix="/api/email", tags=["Email"])


class SendEmailRequest(BaseModel):
    to_email: EmailStr = "rh@bukz.co"
    userEmail: EmailStr | None = None
    subject: str | None = None
    email_body: str | None = None


@router.post("/send")
def send_generic_email(payload: SendEmailRequest):
    """Envía un email genérico con copia a operaciones y al usuario."""
    destinatarios = [payload.to_email, "operaciones@bukz.co"]
    if payload.userEmail:
        destinatarios.append(payload.userEmail)

    # Eliminar duplicados manteniendo orden
    destinatarios = list(dict.fromkeys(destinatarios))

    subject = payload.subject or "Nueva Solicitud"
    raw_body = payload.email_body or "Se ha recibido una nueva solicitud."

    # Convertir Markdown del agente a HTML y envolver en template Bukz
    html_content = markdown_to_email_html(raw_body)
    html_body = wrap_email_template(html_content)

    send_email(
        to=destinatarios,
        subject=subject,
        html_body=html_body,
        sender_name="Operaciones Bukz",
    )

    return {"status": "success"}
