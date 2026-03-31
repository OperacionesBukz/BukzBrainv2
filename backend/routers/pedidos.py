"""
Router de Pedidos — envío de pedidos por email a proveedores (por sede o por ciudad).
Migrado desde Panel-Operaciones/Modulos/Pedidos.py.
Proveedores se leen de la colección Firestore 'directory' (type=proveedor, estado=Activo).
"""
import asyncio
from datetime import datetime

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from services.email_service import send_email
from services.firebase_service import get_firestore_db

router = APIRouter(prefix="/api/pedidos", tags=["pedidos"])

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

SEDES: dict[str, dict[str, str]] = {
    "Bukz Las Lomas": {
        "direccion": "Cra. 30 #10-335, Medellín",
        "horario": "10:00 am a 5:00 pm Lunes a Viernes",
    },
    "Bukz Viva Envigado": {
        "direccion": "Centro Comercial Viva Envigado, Zona 1 Muelle de Carga G, Cl. 32B Sur #48-100 - Local 357 Piso 3, Envigado, Antioquia",
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

def _get_proveedores_from_directory() -> dict[str, list[str]]:
    """Lee proveedores activos de la colección 'directory' en Firestore.

    Returns:
        dict de empresa -> [correo, *correos_cc]
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
            correo = data.get("correo", "")
            cc = data.get("correos_cc", [])
            if empresa and correo:
                result[empresa] = [correo] + [c for c in cc if c]
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
