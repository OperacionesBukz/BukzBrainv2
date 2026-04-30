"""
Router de Pedidos — envío de pedidos por email a proveedores (por sede o por ciudad).
Migrado desde Panel-Operaciones/Modulos/Pedidos.py.
Proveedores se leen de la colección Firestore 'directory' (type=proveedor, estado=Activo).
"""
import asyncio
import base64
import re
from datetime import datetime

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from services.email_service import send_email
from services.firebase_service import get_firestore_db

router = APIRouter(prefix="/api/pedidos", tags=["pedidos"])


class PedidoJSONPayload(BaseModel):
    proveedor: str = Field(..., min_length=1)
    destino: str = Field(..., min_length=1, description="Sede o Ciudad según endpoint")
    tipo: str = Field(..., min_length=1)
    mes: str = Field(..., min_length=1)
    anio: str = Field(..., min_length=1)
    remitente: str = Field(..., min_length=1)
    archivo_b64: str = Field(..., description="Excel codificado en base64")
    archivo_nombre: str = Field(default="pedido.xlsx")

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

SEDES: dict[str, dict[str, str]] = {
    "Bukz Las Lomas": {
        "direccion": "Cra. 30 #10-335, Medellín",
        "horario": "10:00 am a 5:00 pm Lunes a Viernes",
    },
    "Bukz Viva Envigado": {
        "direccion": "Centro Comercial Viva, Cra. 48 #32B Sur-139, Local 357 Zona 1, Envigado, Antioquia",
        "horario": "10:00 am a 12:00 pm - 2:00 pm a 5:00 pm | Lunes a Viernes",
    },
    "Bukz Museo de Antioquia": {
        "direccion": "Cl. 52 #52-43, La Candelaria, Medellín",
        "horario": "10:00 am a 5:00 pm Lunes a Viernes",
    },
    "Cedi Lomas": {
        "direccion": "Cra 30a # 10D- 52, Medellín",
        "horario": "8:00 am a 4:00 pm Lunes a Viernes",
    },
    "Bukz Bogota 109": {
        "direccion": "Cl. 109 #18-39 Local 2, Bogotá",
        "horario": "10:00 am a 5:00 pm Lunes a Viernes",
    },
}

TIPOS = ["Reposición", "Novedad", "B2B", "Reimpresiones"]

MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

CIUDADES = ["Medellín", "Bogotá"]

DESTINATARIOS_B2B = ["camilo.atehortua@bukz.co", "empresasqueleen@bukz.co"]


# ---------------------------------------------------------------------------
# Firestore — proveedores desde colección 'directory'
# ---------------------------------------------------------------------------

_EMAIL_SEPARATORS_RE = re.compile(r"[;,\s]+")


def _split_emails(value) -> list[str]:
    """Acepta str con separadores (`;`, `,`, espacios) o list y devuelve
    la lista limpia de correos individuales. Filtra strings vacíos y
    duplicados conservando el orden."""
    if not value:
        return []
    raw_parts: list[str] = []
    if isinstance(value, list):
        for item in value:
            if isinstance(item, str):
                raw_parts.extend(_EMAIL_SEPARATORS_RE.split(item))
    elif isinstance(value, str):
        raw_parts.extend(_EMAIL_SEPARATORS_RE.split(value))
    seen: set[str] = set()
    out: list[str] = []
    for p in raw_parts:
        p = p.strip().strip("<>").lower()
        if p and "@" in p and p not in seen:
            seen.add(p)
            out.append(p)
    return out


def _get_proveedores_from_directory() -> dict[str, list[str]]:
    """Lee proveedores activos de la colección 'directory' en Firestore.

    Returns:
        dict de empresa -> [correo_principal, *correos_cc]
        Cada string se sanitiza/desempaqueta si trae múltiples correos
        pegados con `;`, `,` o espacios.
    """
    try:
        db = get_firestore_db()
        docs = (
            db.collection("directory")
            .where("type", "==", "proveedor")
            .where("estado", "==", "Activo")
            .stream()
        )
        result: dict[str, list[str]] = {}
        for doc in docs:
            data = doc.to_dict()
            empresa = data.get("empresa", "")
            principales = _split_emails(data.get("correo", ""))
            cc = _split_emails(data.get("correos_cc", []))
            todos: list[str] = []
            seen: set[str] = set()
            for e in principales + cc:
                if e and e not in seen:
                    seen.add(e)
                    todos.append(e)
            if empresa and todos:
                result[empresa] = todos
        return result
    except Exception as e:
        print(f"[pedidos] Error al leer proveedores de Firestore: {e}")
        return {}


# ---------------------------------------------------------------------------
# HTML builders
# ---------------------------------------------------------------------------

def _build_sede_html(sede_nombre: str, sede_info: dict[str, str]) -> str:
    return f"""<html>
<body>
<p>Estimados, un saludo cordial:</p>

<p>Adjunto encontrar&aacute;n el archivo Excel con el pedido solicitado para nuestra Sede: <b>{sede_nombre}</b>.</p>

<p>Para facilitar el proceso de recepci&oacute;n en tienda o bodega, agradecemos su apoyo con los siguientes puntos:</p>

<p><b>1. Datos para la entrega:</b></p>
<ul>
    <li>Direcci&oacute;n: <b>{sede_info['direccion']}</b>.</li>
    <li>Horario de recepci&oacute;n: <b>{sede_info['horario']}</b>.</li>
    <li>Remisi&oacute;n: Agradecemos una vez despachado el pedido responder a este correo adjuntando la remisi&oacute;n en Excel para proceder a la actualizaci&oacute;n o creaci&oacute;n de los productos en nuestro sistema.</li>
</ul>

<p><b>2. Sobre el contenido del pedido:</b></p>
<ul>
    <li>Les agradecemos despachar exclusivamente los t&iacute;tulos y cantidades detallados en el archivo adjunto.</li>
    <li><b>Nota importante:</b> Por temas de control de inventario, no podremos recibir t&iacute;tulos adicionales o novedades que no est&eacute;n incluidos en este pedido.</li>
</ul>

<p>Quedo atento/a a su confirmaci&oacute;n. &iexcl;Muchas gracias por su gesti&oacute;n!</p>

<p>Saludos,</p>
</body>
</html>"""


def _build_ciudad_html(ciudad: str) -> str:
    if ciudad == "Medellín":
        return """<html><body>
<p>Estimados, buen@s d&iacute;as/tardes:</p>

<p>Agradecemos enviar los pedidos adjuntos para la Bodega Bukz Lomas de Medell&iacute;n, a la direcci&oacute;n Kra 30a # 10D- 52, entre las 8 am y las 5pm. Por favor nos env&iacute;en la remisi&oacute;n del pedido en excel, por este medio.</p>

<p>Adjunto se encuentra:</p>
<ul>
    <li>Excel con t&iacute;tulos y sus respectivas cantidades.</li>
</ul>

<p>Quedo atento a sus comentarios,</p>

<p>Muchas gracias,</p>
</body></html>"""

    return """<html><body>
<p>Estimados, buen@s d&iacute;as/tardes:</p>

<p>Agradecemos enviar los pedidos adjuntos para la sede Bogot&aacute;, con direcci&oacute;n Cl. 109 #18-39 Local 2, entre las 10 am y las 8pm. Por favor nos env&iacute;en la remisi&oacute;n del pedido en excel, por este medio.</p>

<p>Adjunto se encuentra:</p>
<ul>
    <li>Excel con t&iacute;tulos y sus respectivas cantidades.</li>
</ul>

<p>Quedo atento a sus comentarios,</p>

<p>Muchas gracias,</p>
</body></html>"""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/config")
async def get_config():
    """Retorna listas de configuración para los formularios del frontend."""
    proveedores = await asyncio.to_thread(_get_proveedores_from_directory)
    proveedores_sorted = sorted(proveedores.keys())
    return {
        "sedes": list(SEDES.keys()),
        "sedes_info": SEDES,
        "proveedores": proveedores_sorted,
        "tipos": TIPOS,
        "meses": MESES,
        "ciudades": CIUDADES,
    }


@router.post("/sedes")
async def enviar_pedido_sede(
    proveedor: str = Form(...),
    sede: str = Form(...),
    tipo: str = Form(...),
    mes: str = Form(...),
    anio: str = Form(...),
    remitente: str = Form(...),
    archivo: UploadFile = File(...),
):
    """Envía un pedido por email a un proveedor para una sede específica."""
    if archivo.content_type not in (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
    ):
        raise HTTPException(400, detail="El archivo debe ser un Excel (.xlsx)")
    if sede not in SEDES:
        raise HTTPException(404, detail=f"Sede '{sede}' no encontrada")

    proveedores = await asyncio.to_thread(_get_proveedores_from_directory)
    if not proveedores:
        raise HTTPException(503, detail="No se pudo cargar la lista de proveedores. Intente de nuevo.")
    if proveedor not in proveedores:
        raise HTTPException(404, detail=f"Proveedor '{proveedor}' no encontrado")

    sede_info = SEDES[sede]
    fecha_str = datetime.now().strftime("%d %b %Y")
    asunto = f"Pedido BUKZ {tipo} - Sede: {sede} - {proveedor} - {fecha_str}"
    html_body = _build_sede_html(sede, sede_info)

    correos = list(proveedores[proveedor])
    if tipo == "B2B":
        correos = correos + DESTINATARIOS_B2B

    archivo_bytes = await archivo.read()
    fecha_file = datetime.now().strftime("%d_%m_%Y")
    nombre_archivo = f"Pedido_{sede}_{mes}_{anio}_{fecha_file}.xlsx"

    try:
        send_email(
            to=[correos[0]],
            subject=asunto,
            html_body=html_body,
            sender_name=remitente,
            cc=correos[1:] if len(correos) > 1 else None,
            attachments=[(nombre_archivo, archivo_bytes)],
        )
    except Exception as e:
        raise HTTPException(502, detail=f"Error al enviar email: {e}")

    return {
        "success": True,
        "proveedor": proveedor,
        "sede": sede,
        "correos": correos,
        "asunto": asunto,
    }


@router.post("/ciudad")
async def enviar_pedido_ciudad(
    proveedor: str = Form(...),
    ciudad: str = Form(...),
    tipo: str = Form(...),
    mes: str = Form(...),
    anio: str = Form(...),
    remitente: str = Form(...),
    archivo: UploadFile = File(...),
):
    """Envía un pedido por email a un proveedor para una ciudad."""
    if archivo.content_type not in (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
    ):
        raise HTTPException(400, detail="El archivo debe ser un Excel (.xlsx)")
    if ciudad not in CIUDADES:
        raise HTTPException(400, detail=f"Ciudad '{ciudad}' no válida. Opciones: {', '.join(CIUDADES)}")

    proveedores = await asyncio.to_thread(_get_proveedores_from_directory)
    if not proveedores:
        raise HTTPException(503, detail="No se pudo cargar la lista de proveedores. Intente de nuevo.")
    if proveedor not in proveedores:
        raise HTTPException(404, detail=f"Proveedor '{proveedor}' no encontrado")

    # Construir asunto según tipo
    asunto = f"Pedido {mes} Bukz {ciudad} {anio} - {proveedor}"
    if tipo == "Novedad":
        asunto = f"Novedad - {asunto}"
    elif tipo == "B2B":
        asunto = f"PEDIDOS B2B - {asunto}"

    html_body = _build_ciudad_html(ciudad)

    correos = list(proveedores[proveedor])
    if tipo == "B2B":
        correos = correos + DESTINATARIOS_B2B

    archivo_bytes = await archivo.read()
    fecha_file = datetime.now().strftime("%d_%m_%Y")
    nombre_archivo = f"Pedido_{ciudad}_{mes}_{anio}_{fecha_file}.xlsx"

    try:
        send_email(
            to=[correos[0]],
            subject=asunto,
            html_body=html_body,
            sender_name=remitente,
            cc=correos[1:] if len(correos) > 1 else None,
            attachments=[(nombre_archivo, archivo_bytes)],
        )
    except Exception as e:
        raise HTTPException(502, detail=f"Error al enviar email: {e}")

    return {
        "success": True,
        "proveedor": proveedor,
        "ciudad": ciudad,
        "correos": correos,
        "asunto": asunto,
    }


# ---------------------------------------------------------------------------
# Endpoints JSON (alternativos a multipart/form-data)
# Necesarios cuando AV/firewalls corporativos bloquean POST multipart pero
# permiten POST application/json. El archivo viene base64-encoded en el body.
# ---------------------------------------------------------------------------

def _decode_archivo_b64(b64_str: str) -> bytes:
    """Decodifica el archivo base64. Acepta el prefijo data:URI opcional."""
    if "," in b64_str and b64_str.lstrip().startswith("data:"):
        b64_str = b64_str.split(",", 1)[1]
    try:
        return base64.b64decode(b64_str, validate=True)
    except Exception as e:
        raise HTTPException(400, detail=f"archivo_b64 inválido: {e}")


@router.post("/sedes-json")
async def enviar_pedido_sede_json(payload: PedidoJSONPayload):
    """Variante JSON de /sedes — el Excel viene como base64 en el body."""
    sede = payload.destino
    if sede not in SEDES:
        raise HTTPException(404, detail=f"Sede '{sede}' no encontrada")

    proveedores = await asyncio.to_thread(_get_proveedores_from_directory)
    if not proveedores:
        raise HTTPException(503, detail="No se pudo cargar la lista de proveedores. Intente de nuevo.")
    if payload.proveedor not in proveedores:
        raise HTTPException(404, detail=f"Proveedor '{payload.proveedor}' no encontrado")

    archivo_bytes = _decode_archivo_b64(payload.archivo_b64)

    sede_info = SEDES[sede]
    fecha_str = datetime.now().strftime("%d %b %Y")
    asunto = f"Pedido BUKZ {payload.tipo} - Sede: {sede} - {payload.proveedor} - {fecha_str}"
    html_body = _build_sede_html(sede, sede_info)

    correos = list(proveedores[payload.proveedor])
    if payload.tipo == "B2B":
        correos = correos + DESTINATARIOS_B2B

    fecha_file = datetime.now().strftime("%d_%m_%Y")
    nombre_archivo = payload.archivo_nombre or f"Pedido_{sede}_{payload.mes}_{payload.anio}_{fecha_file}.xlsx"

    try:
        await asyncio.to_thread(
            send_email,
            [correos[0]],
            asunto,
            html_body,
            payload.remitente,
            correos[1:] if len(correos) > 1 else None,
            [(nombre_archivo, archivo_bytes)],
        )
    except Exception as e:
        raise HTTPException(502, detail=f"Error al enviar email: {e}")

    return {
        "success": True,
        "proveedor": payload.proveedor,
        "sede": sede,
        "correos": correos,
        "asunto": asunto,
    }


@router.post("/ciudad-json")
async def enviar_pedido_ciudad_json(payload: PedidoJSONPayload):
    """Variante JSON de /ciudad — el Excel viene como base64 en el body."""
    ciudad = payload.destino
    if ciudad not in CIUDADES:
        raise HTTPException(400, detail=f"Ciudad '{ciudad}' no válida. Opciones: {', '.join(CIUDADES)}")

    proveedores = await asyncio.to_thread(_get_proveedores_from_directory)
    if not proveedores:
        raise HTTPException(503, detail="No se pudo cargar la lista de proveedores. Intente de nuevo.")
    if payload.proveedor not in proveedores:
        raise HTTPException(404, detail=f"Proveedor '{payload.proveedor}' no encontrado")

    archivo_bytes = _decode_archivo_b64(payload.archivo_b64)

    asunto = f"Pedido {payload.mes} Bukz {ciudad} {payload.anio} - {payload.proveedor}"
    if payload.tipo == "Novedad":
        asunto = f"Novedad - {asunto}"
    elif payload.tipo == "B2B":
        asunto = f"PEDIDOS B2B - {asunto}"

    html_body = _build_ciudad_html(ciudad)

    correos = list(proveedores[payload.proveedor])
    if payload.tipo == "B2B":
        correos = correos + DESTINATARIOS_B2B

    fecha_file = datetime.now().strftime("%d_%m_%Y")
    nombre_archivo = payload.archivo_nombre or f"Pedido_{ciudad}_{payload.mes}_{payload.anio}_{fecha_file}.xlsx"

    try:
        await asyncio.to_thread(
            send_email,
            [correos[0]],
            asunto,
            html_body,
            payload.remitente,
            correos[1:] if len(correos) > 1 else None,
            [(nombre_archivo, archivo_bytes)],
        )
    except Exception as e:
        raise HTTPException(502, detail=f"Error al enviar email: {e}")

    return {
        "success": True,
        "proveedor": payload.proveedor,
        "ciudad": ciudad,
        "correos": correos,
        "asunto": asunto,
    }
