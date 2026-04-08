"""
Servicio de envío de emails vía SMTP_SSL (Gmail).
Usado por el módulo de Envío de Cortes a proveedores.
"""
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders

from config import settings


# ---------------------------------------------------------------------------
# Markdown → HTML (email-safe, inline styles para Gmail)
# ---------------------------------------------------------------------------

def _inline_md(text: str) -> str:
    """Convierte **bold** y *italic* a HTML inline."""
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    return text


def _convert_table(lines: list[str]) -> str:
    """Convierte una tabla Markdown a HTML con estilos inline."""
    if len(lines) < 2:
        return ""
    headers = [c.strip() for c in lines[0].strip().strip("|").split("|")]
    rows = []
    for row_line in lines[2:]:  # skip separator
        cells = [c.strip() for c in row_line.strip().strip("|").split("|")]
        rows.append(cells)

    th_style = "padding:8px 12px;background:#f8f8f8;border:1px solid #ddd;font-weight:700;text-align:left;font-size:13px;"
    td_style = "padding:8px 12px;border:1px solid #ddd;font-size:13px;"
    html = '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:10px 0;width:100%;">\n<tr>'
    for h in headers:
        html += f'<th style="{th_style}">{_inline_md(h)}</th>'
    html += "</tr>\n"
    for row in rows:
        html += "<tr>"
        for cell in row:
            html += f'<td style="{td_style}">{_inline_md(cell)}</td>'
        html += "</tr>\n"
    html += "</table>"
    return html


def markdown_to_email_html(text: str) -> str:
    """Convierte Markdown básico a HTML con estilos inline (Gmail-safe).

    Si el texto ya contiene tags HTML de bloque, lo devuelve tal cual.
    """
    if re.search(r'<(?:p|div|ul|ol|table|h[1-6])\b', text, re.IGNORECASE):
        return text

    result: list[str] = []
    list_tag: str | None = None
    table_buf: list[str] = []
    lines = text.split("\n")
    i = 0

    while i < len(lines):
        stripped = lines[i].strip()

        # --- Tabla Markdown ---
        if "|" in stripped and i + 1 < len(lines) and re.match(r'^[\s|:-]+$', lines[i + 1].strip()):
            table_buf = [stripped, lines[i + 1].strip()]
            i += 2
            while i < len(lines) and "|" in lines[i]:
                table_buf.append(lines[i].strip())
                i += 1
            if list_tag:
                result.append(f"</{list_tag}>")
                list_tag = None
            result.append(_convert_table(table_buf))
            table_buf = []
            continue

        # --- Línea vacía ---
        if not stripped:
            if list_tag:
                result.append(f"</{list_tag}>")
                list_tag = None
            i += 1
            continue

        # --- Lista desordenada ---
        m = re.match(r'^[-*]\s+(.*)', stripped)
        if m:
            if list_tag != "ul":
                if list_tag:
                    result.append(f"</{list_tag}>")
                result.append('<ul style="margin:6px 0;padding-left:24px;">')
                list_tag = "ul"
            result.append(f'  <li style="margin:3px 0;line-height:1.5;">{_inline_md(m.group(1))}</li>')
            i += 1
            continue

        # --- Lista ordenada ---
        m = re.match(r'^\d+\.\s+(.*)', stripped)
        if m:
            if list_tag != "ol":
                if list_tag:
                    result.append(f"</{list_tag}>")
                result.append('<ol style="margin:6px 0;padding-left:24px;">')
                list_tag = "ol"
            result.append(f'  <li style="margin:3px 0;line-height:1.5;">{_inline_md(m.group(1))}</li>')
            i += 1
            continue

        # Cerrar lista si estamos en una
        if list_tag:
            result.append(f"</{list_tag}>")
            list_tag = None

        # --- Encabezados ---
        if stripped.startswith("### "):
            result.append(f'<p style="margin:14px 0 4px;font-weight:700;font-size:15px;color:#1a1a1a;">{_inline_md(stripped[4:])}</p>')
        elif stripped.startswith("## "):
            result.append(f'<p style="margin:16px 0 6px;font-weight:700;font-size:16px;color:#1a1a1a;">{_inline_md(stripped[3:])}</p>')
        elif stripped.startswith("# "):
            result.append(f'<p style="margin:18px 0 6px;font-weight:700;font-size:18px;color:#1a1a1a;">{_inline_md(stripped[2:])}</p>')
        elif stripped == "---":
            result.append('<hr style="border:none;border-top:1px solid #e0e0e0;margin:14px 0;">')
        else:
            result.append(f'<p style="margin:6px 0;line-height:1.6;">{_inline_md(stripped)}</p>')

        i += 1

    if list_tag:
        result.append(f"</{list_tag}>")

    return "\n".join(result)


def wrap_email_template(content_html: str, sender_name: str = "Operaciones Bukz") -> str:
    """Envuelve contenido HTML en un template de email con branding Bukz."""
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr>
          <td style="background-color:#FFED4E;padding:18px 28px;">
            <span style="font-size:22px;font-weight:800;color:#1a1a1a;letter-spacing:-0.5px;">bukz</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 24px;color:#333333;font-size:14px;">
            {content_html}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 28px;background-color:#fafafa;border-top:1px solid #eee;">
            <p style="margin:0;font-size:11px;color:#999;">Enviado por {sender_name} &middot; Bukz Librer&iacute;as</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

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
