"""
Servicio de envío de emails vía SMTP_SSL (Gmail).
Usado por el módulo de Envío de Cortes a proveedores.
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders

from config import settings

def build_ventas_html(mes: str) -> str:
    """Template HTML para correo de cortes con ventas."""
    return f"""<p>Buenas tardes,</p>

<p>Espero que est&eacute;s muy bien. Adjunto informaci&oacute;n del corte del mes de {mes}.</p>

<p>Le recordamos que la cuenta de cobro o factura debe ser remitida <strong>exclusivamente a facturacion@bukz.co antes del d&iacute;a 25 del mes en curso</strong>.</p>

<p>Por asuntos contables, les pedimos amablemente que env&iacute;en una factura especificando el lugar de venta, indicando si es <strong>Medell&iacute;n</strong> y otra que especifique si es <strong>Bogot&aacute;</strong>, as&iacute; como se especifica en los archivos del corte de venta.</p>

<p>Para cualquier consulta o asunto adicional, no dude en contactar a los siguientes departamentos:</p>
<ul>
    <li>Facturaci&oacute;n: facturacion@bukz.co</li>
    <li>Bodega y Devoluciones: cedi@bukz.co</li>
</ul>"""


def build_no_ventas_html(mes: str) -> str:
    """Template HTML para correo de proveedores sin ventas."""
    return f"""<p>Buenos d&iacute;as,</p>

<p>El presente correo es para informarle que no se registraron ventas durante el mes de {mes}.</p>

<p>Para cualquier consulta o asunto adicional, no dude en ponerse en contacto con nosotros:</p>
<ul>
    <li>Facturaci&oacute;n: facturacion@bukz.co</li>
    <li>Bodega y Devoluciones: cedi@bukz.co</li>
</ul>"""


def send_email(
    to: list[str],
    subject: str,
    html_body: str,
    sender_name: str,
    cc: list[str] | None = None,
    attachments: list[tuple[str, bytes]] | None = None,
) -> None:
    """
    Envía un email vía SMTP_SSL de Gmail.

    Args:
        to: lista de destinatarios principales
        subject: asunto del email
        html_body: cuerpo HTML
        sender_name: nombre visible del remitente
        cc: lista de emails en copia (opcional)
        attachments: lista de (filename, bytes_content) opcionales
    Raises:
        RuntimeError si las credenciales no están configuradas
        smtplib.SMTPException si falla el envío
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise RuntimeError("Credenciales SMTP no configuradas en el servidor")

    msg = MIMEMultipart()
    msg["From"] = f"{sender_name} <{settings.SMTP_USER}>"
    msg["To"] = ", ".join(to)
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = ", ".join(cc)

    msg.attach(MIMEText(html_body, "html"))

    if attachments:
        for fname, content in attachments:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(content)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", "attachment", filename=fname)
            msg.attach(part)

    all_recipients = list(to) + (cc or [])
    with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_USER, all_recipients, msg.as_string())
