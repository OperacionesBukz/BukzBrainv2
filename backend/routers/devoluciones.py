"""
Router de Devoluciones — envío de emails a sedes (recolección) y proveedores (devolución lista).
Migrado desde Panel-Operaciones/Modulos/Devoluciones.py.
"""
import asyncio
from datetime import datetime

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from services.email_service import send_email
from services.firebase_service import get_firestore_db

router = APIRouter(prefix="/api/devoluciones", tags=["devoluciones"])

# ---------------------------------------------------------------------------
# Constantes (migradas desde Panel-Operaciones/Modulos/proveedores_data.py)
# ---------------------------------------------------------------------------

SEDES: dict[str, str] = {
    "Bukz Las Lomas": "lomas@bukz.co",
    "Bukz Viva Envigado": "vivaenvigado@bukz.co",
    "Bukz Museo": "museo@bukz.co",
    "Bukz Bogotá": "bogota109@bukz.co",
    "Bukz Cedi": "cedi@bukz.co",
}

MOTIVOS_SEDES = ["Devolución", "Devolución Descatalogados", "Devolución Urgente"]

PROVEEDORES_EMAIL: dict[str, list[str]] = {
    "Proveedor Prueba": ["cedi@bukz.co"],
    "Penguin RandomHouse (MED)": ["natalia.Hurtado@penguinrandomhouse.com", "cedi@bukz.co"],
    "Penguin RandomHouse (BOG)": ["fernanda.Herrera@penguinrandomhouse.com", "cedi@bukz.co"],
    "Grupo Editorial Planeta (MED)": ["mromero@planeta.com.co", "cedi@bukz.co"],
    "Grupo Editorial Planeta (BOG)": ["ovargas@planeta.com.co", "cedi@bukz.co"],
    "Oceano": ["alejandro.vargas@oceano.com.co", "cedi@bukz.co"],
    "Grupo Penta": ["zoraida.ojeda@grupopenta.com.co", "cedi@bukz.co"],
    "Siglo del Hombre (MED)": ["hjimenez@siglodelhombre.com", "cedi@bukz.co"],
    "Siglo del Hombre (BOG)": ["jbernal@somossiglo.com", "cedi@bukz.co"],
    "Grupo Monserrate": ["grupomonserratemedellin@hotmail.com", "artbooksmilenaleonel@gmail.com", "cedi@bukz.co"],
    "Sin Fronteras": ["comercial1@gruposinfronteras.com", "cedi@bukz.co"],
    "ACLI": ["info.aclilibreros@gmail.com", "inventariosacli@gmail.com", "cedi@bukz.co"],
    "Alianza Editorial": ["alianzaeditorialmed@hotmail.com", "cedi@bukz.co"],
    "Alicia Mejia": ["administrativo@thinklicious.com", "cedi@bukz.co"],
    "Angosta Editores": ["auxiliar@angosta.co", "cedi@bukz.co"],
    "Arquine": ["camilo@agendarq.com", "andrea@arquine.com", "miquel@arquine.com", "distribucion@arquine.com"],
    "Artemis Libros": ["artemislibros@yahoo.es", "cedi@bukz.co"],
    "Caballito de Acero": ["editorial@caballitodeacero.com", "cedi@bukz.co"],
    "Calixta Editores": ["luis.izquierdo@calixtaeditores.com", "cedi@bukz.co"],
    "Carolina Giraldo García": ["hola@carogiraldogarcia.com", "cedi@bukz.co"],
    "Carolina Pérez Botero": ["carolina@amorescaprichosos.com", "cedi@bukz.co"],
    "Catalina Mayorga": ["gonzalez.saldarriaga@gmail.com", "cedi@bukz.co"],
    "Circulo de lectores": ["aremil@circulo.com.co", "cedi@bukz.co"],
    "Contenido": ["contenido.contenido@gmail.com", "cedi@bukz.co"],
    "Cubo Universo Creativo": ["gerencia@cubocultural.com", "cedi@bukz.co"],
    "Difusora Larousse de Colombia": ["francygonzalez@larousse.co", "cedi@bukz.co"],
    "Diseños Lalys": ["leamosliteraturayletras@gmail.com", "cedi@bukz.co"],
    "Ediciones Gaviota": ["ventas1@ediciones-gaviota.com", "cedi@bukz.co"],
    "Ediciones Urano (MED)": ["m.osorio@edicionesurano.com", "cedi@bukz.co"],
    "Ediciones Urano (BOG)": ["f.arevalo@uranoworld.com", "cedi@bukz.co"],
    "Ediciones Vestigio": ["editor.vestigio@gmail.com", "cedi@bukz.co"],
    "Editorial Eafit": ["aherrerag@eafit.edu.co", "cedi@bukz.co"],
    "Editorial Quimbombó": ["editorialquimbombo@gmail.com", "cedi@bukz.co"],
    "Editorial Solar": ["nathalie.editorialsolar@gmail.com", "cedi@bukz.co"],
    "Elev8 Media S.A.S": ["gary@elev8.io", "elizabeth@elev8.io", "giraldo.anamaria@asesoriashg.com", "cedi@bukz.co"],
    "Epifánico": ["contacto@epifanico.com", "cedi@bukz.co"],
    "Estrategia en Ventas": ["soporte@estrategiaenventas.co", "cedi@bukz.co"],
    "FCE": ["camilo.hernandez@fce.com.co", "cedi@bukz.co"],
    "Fondo Cultural Iberoamericano (MED)": ["focui@outlook.com", "cedi@bukz.co"],
    "Fondo Cultural Iberoamericano (BOG)": ["vivianateresaluna15@gmail.com", "cedi@bukz.co"],
    "Frailejón Editores": ["frailejoneditores@gmail.com", "cedi@bukz.co"],
    "Huracán Distribución": ["huracandistribucion@gmail.com", "cedi@bukz.co"],
    "Icaro Libros": ["ventas@icarolibros.com"],
    "La Editora - Ana Meza": ["ana@analaeditora.com", "cedi@bukz.co"],
    "Libro Arte S.A.S": ["Ventas@tarangoplay.com", "cedi@bukz.co"],
    "Lobolunar": ["lobolunarcolombia@gmail.com", "cedi@bukz.co"],
    "Mandalas para el alma": ["direccion@andreagudelo.com", "cedi@bukz.co"],
    "Marco Polo": ["marcopolo.encuadernacion.art@gmail.com", "cedi@bukz.co"],
    "Mesaestandar": ["contacto@mesaestandar.com", "cedi@bukz.co"],
    "No Apto": ["marianavasquez90@hotmail.com", "cedi@bukz.co"],
    "Plaza & Janes": ["diego.ospina@plazayjanescolombia.com", "cedi@bukz.co"],
    "Poster Colombia": ["postercolombia@gmail.com", "cedi@bukz.co"],
    "Raya Editores": ["rayaeditorial@gmail.com", "cedi@bukz.co"],
    "Rey Naranjo": ["administrativo@reynaranjo.net", "cedi@bukz.co"],
    "Silaba Editores": ["asistentesilaba@gmail.com", "cedi@bukz.co"],
    "SITRA Mundo Creativo": ["basalmobiliario@gmail.com", "cedi@bukz.co"],
    "Taller de edición Rocca": ["correotallerdeedicionrocca@gmail.com", "cedi@bukz.co"],
    "Ingenio": ["comercial@ingeniodestrezamental.com", "pperez@ingeniodestrezamental.com", "cedi@bukz.co"],
    "Tool-be": ["alejandra.zuluaga@tool-be.com", "maria.velez@tool-be.com", "cedi@bukz.co"],
    "Tragaluz Editores": ["ventas@tragaluzeditores.com", "cedi@bukz.co"],
    "Travesía Juglar": ["travesiajuglar@gmail.com", "cedi@bukz.co"],
    "Universidad CES": ["ndurangor@ces.edu.co", "cedi@bukz.co"],
    "Vasquez Editores": ["vasquezeditores@gmail.com", "cedi@bukz.co"],
    "Viiel": ["solarber2010@gmail.com", "cedi@bukz.co"],
    "Policefalo": ["policefaloediciones@gmail.com", "cedi@bukz.co"],
    "Asociación de Editoriales Independientes de Chile": ["andresfberdugo@gmail.com", "cedi@bukz.co"],
    "La Valija de Fuego Editorial": ["lavalijadefuegoeditorial@gmail.com", "cedi@bukz.co"],
    "Arbitraria": ["arbitrariaeditorial@gmail.com", "cedi@bukz.co"],
    "Libros del Motín": ["david7g@gmail.com", "cedi@bukz.co"],
    "Lazo Libros": ["hola@lazolibros.com", "cedi@bukz.co"],
    "Axioma Editores": ["axiomaeditores@gmail.com", "cedi@bukz.co"],
    "Grammata - Vazquez": ["vasquezeditores@gmail.com", "cedi@bukz.co"],
    "Saga Libros": ["ventas@saga.com.co", "cedi@bukz.co"],
    "Mo Ediciones": ["monica.montes@moediciones.com", "cedi@bukz.co"],
    "Cain Press": ["info@cainpress.com", "cedi@bukz.co"],
    "Libros del Fuego": ["rodcasares@gmail.com", "cedi@bukz.co"],
    "Verso Libre": ["versolibre@comunycorriente.org", "cedi@bukz.co"],
    "Artimaña Editorial": ["artimanaeditorial@gmail.com", "cedi@bukz.co"],
    "McMullan Birding": ["ensiferaeditores@gmail.com", "cedi@bukz.co"],
    "Club Editores S.A.": ["dianapaezm@yahoo.com", "cedi@bukz.co"],
    "As Ediciones": ["gerencia@asediciones.com", "cedi@bukz.co"],
    "Amelia Amortegui": ["holavengaledigo@gmail.com", "cedi@bukz.co"],
    "Dos Gatos Editores": ["xtinawilhelm@gmail.com", "cedi@bukz.co"],
    "Cypres": ["cypreslibrerias@gmail.com", "cedi@bukz.co"],
    "Kocodio": ["info@kocodio.com", "comercial@kocodio.com", "cedi@bukz.co"],
    "Astropuerta": ["astropuerta@gmail.com", "cedi@bukz.co"],
    "Ediciones el Silencio": ["logisticaedicioneselsilencio@gmail.com", "auxiliardeventas@edicioneselsilencio.com.co", "cedi@bukz.co"],
    "Ediciones de la U": ["comercial1@edicionesdelau.com", "cedi@bukz.co"],
    "Fera": ["ventas.fera@gmail.com", "cedi@bukz.co"],
    "Poiema Publicaciones": ["celis@poiema.co", "cedi@bukz.co"],
    "Ediciones Gamma": ["comercial@revistadiners.com.co", "cedi@bukz.co"],
    "Union Editorial Colombia": ["gilberto.ramirez@unioneditorial.net", "freddyjosecarrillo@gmail.com", "cedi@bukz.co"],
    "Lavanda Editoras": ["claudiaivonne09@gmail.com", "cedi@bukz.co"],
    "Germán Puerta": ["astropuerta@gmail.com", "cedi@bukz.co"],
    "Villegas Editores": ["comercial@villegaseditores.com", "cedi@bukz.co"],
    "La Diligencia": ["ladiligenciacolombia@gmail.com", "cedi@bukz.co"],
    "Babel": ["libros.babel@gmail.com", "cedi@bukz.co"],
    "Luz Karime Saleme Correa": ["lksaleme@leonardonino.com", "cedi@bukz.co"],
    "Cangrejo Editores": ["camilo.aljure@cangrejoeditores.com", "cedi@bukz.co"],
    "Testigo Directo": ["produccion@testigodirectoeditorial.com", "cedi@bukz.co"],
    "Panamericana": ["panamericanaeditorial.pedidos@panamericana.com.co", "adriana.tovar@panamericana.com.co", "cedi@bukz.co"],
    "Hipertexto": ["lider.supplychain@hipertexto.com.co", "cedi@bukz.co"],
    "Unilat": ["ventas@unilat.com.co", "cedi@bukz.co"],
    "Ojos de tus Ojos": ["carojimet@gmail.com", "cedi@bukz.co"],
    "Secretos para Contar": ["yeny.castrillon@secretosparacontar.org", "cedi@bukz.co"],
    "SOFIA EDITORES SAS": ["sofiaeditores@gmail.com", "moniquillar@gmail.com", "cedi@bukz.co"],
    "Proyectos Sin Limites": ["ventas@proyectossinlimites.com", "cedi@bukz.co"],
    "Catherine Villota": ["catyvillota@fashionradicals.com", "cedi@bukz.co"],
    "Jaime Botero": ["lasagabotero@gmail.com", "cedi@bukz.co"],
    "Empoderados SAS": ["diana@antu.com.co", "cedi@bukz.co"],
    "The Black Bean": ["hola@theblackbean.net", "cedi@bukz.co"],
    "Harry Marin": ["marinvahos@hotmail.com", "cedi@bukz.co"],
    "Holz Haus": ["xilostech@gmail.com", "cechavarriasoto@gmail.com", "cedi@bukz.co"],
    "Ediciones La Pluma del Águila": ["jarredondo@aguiladescalza.com.co", "cedi@bukz.co"],
    "Maria Pulido Alvarez": ["laura.alvarezlopez83@gmail.com", "cedi@bukz.co"],
    "Nelly Giraldo Gil": ["wonderwiseeod@gmail.com", "cedi@bukz.co"],
    "Fundación Casa Arcoíris": ["casaarcoiris7@gmail.com", "cedi@bukz.co"],
    "Valeria Marín Pineda": ["gatosmaestrosdevida@gmail.com", "cedi@bukz.co"],
    "Aguila Descalza": ["contabilidad@aguiladescalza.com.co", "asisadministrativo@aguiladescalza.com.co", "cedi@bukz.co"],
    "Acuarell": ["zalamt@hotmail.com", "cedi@bukz.co"],
    "Happy Kiddo": ["lorena@happykiddobooks.com", "cedi@bukz.co"],
    "Feliciano Escobar": ["felicianoescobar@yahoo.com", "medellinupclose@gmail.com", "cedi@bukz.co"],
    "Booktique": ["booktiquecol@gmail.com", "medellinupclose@gmail.com", "cedi@bukz.co"],
    "Idealo Pez": ["lestrada@idealopez.com", "cedi@bukz.co"],
    "Alejandro Salazar": ["administrativa@tbreakthrough.com", "cedi@bukz.co"],
    "Toy": ["comercial@toystyle.co", "cedi@bukz.co"],
    "Sin Ocasión": ["sinocasion@outlook.com", "cedi@bukz.co"],
    "Arpegio Cool": ["arpegio.cool@gmail.com", "cedi@bukz.co"],
    "Norma": ["imontoya@edicionesnorma.com", "cedi@bukz.co"],
}

MOTIVOS_PROVEEDORES = ["Devolución", "Devolución Descatalogados", "Devolución Baja Rotación"]

CIUDADES = ["Medellín", "Bogotá"]

INFO_CIUDAD: dict[str, dict[str, str]] = {
    "Bogotá": {
        "direccion": "Librería Bukz Bogotá 109 Cl. 109 # 18-39 3148614162 Bogotá",
        "contacto": "Carlos Carrillo",
        "cel": "3023796177",
    },
    "Medellín": {
        "direccion": "Cra 30a # 10D- 52, entre las 8 am y las 5pm",
        "contacto": "Pablo Jiménez",
        "cel": "3045322442",
    },
}


def _get_suppliers_from_firestore() -> dict[str, list[str]]:
    """Load active suppliers from Firestore 'directory' collection.

    Falls back to the hardcoded PROVEEDORES_EMAIL if Firestore is unavailable.
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
        print(f"[devoluciones] Firestore error, using fallback: {e}")
        return PROVEEDORES_EMAIL


def _build_sedes_html(proveedor_nombre: str) -> str:
    return (
        "<p>Buen día compañeros, espero que todo marche bien.</p>"
        f"<p>Por favor, nos apoyan con la recolección de la devolución correspondiente al proveedor "
        f"<b>{proveedor_nombre}</b> y su envío al CEDI para el respectivo proceso.</p>"
        "<p>Quedamos atentos a la confirmación de la gestión.</p>"
        "<p>Muchas gracias.</p>"
        "<p>Saludos,</p>"
    )


def _build_proveedores_html(num_cajas: int, ciudad: str, info: dict[str, str]) -> str:
    return (
        "<p>Buenas tardes, espero que todo marche bien.</p>"
        "<p>La devolución correspondiente de la consignación se encuentra lista para ser recogida; "
        "por favor tener en cuenta la información para la recogida del producto:</p>"
        f'<p><b>Cajas y/o Paquetes:</b> <b>{num_cajas}</b></p>'
        f'<p><b>Dirección de recogida:</b> <b>{ciudad} {info["direccion"]}</b></p>'
        f'<p><b>Contacto:</b> <b>{info["contacto"]}</b></p>'
        f'<p><b>Cel:</b> <b>{info["cel"]}</b></p>'
        "<p>Adjunto archivo de la devolución, por favor nos envían la nota de descargue "
        "de la consignación vigente.</p>"
        "<p>Saludos,</p>"
    )


@router.get("/config")
async def get_config():
    """Retorna listas de configuración para los formularios del frontend."""
    suppliers = await asyncio.to_thread(_get_suppliers_from_firestore)
    return {
        "sedes": list(SEDES.keys()),
        "motivos_sedes": MOTIVOS_SEDES,
        "proveedores": sorted(suppliers.keys()),
        "motivos_proveedores": MOTIVOS_PROVEEDORES,
        "ciudades": CIUDADES,
    }


@router.post("/sedes")
async def enviar_devolucion_sede(
    sede: str = Form(...),
    motivo: str = Form(...),
    proveedor_nombre: str = Form(...),
    remitente: str = Form(...),
    archivo: UploadFile = File(...),
):
    """Envía email de recolección a una sede."""
    if sede not in SEDES:
        raise HTTPException(404, detail=f"Sede '{sede}' no encontrada")

    fecha_str = datetime.now().strftime("%d %b %Y")
    asunto = f'{motivo} "{proveedor_nombre}" - {sede} - {fecha_str}'
    html_body = _build_sedes_html(proveedor_nombre)
    correo_sede = SEDES[sede]

    archivo_bytes = await archivo.read()
    nombre_archivo = archivo.filename or "devolucion.xlsx"

    try:
        send_email(
            to=[correo_sede],
            subject=asunto,
            html_body=html_body,
            sender_name=remitente,
            attachments=[(nombre_archivo, archivo_bytes)],
        )
    except Exception as e:
        raise HTTPException(502, detail=f"Error al enviar email: {e}")

    return {
        "success": True,
        "destinatario": sede,
        "correos": [correo_sede],
        "asunto": asunto,
    }


@router.post("/proveedores")
async def enviar_devolucion_proveedor(
    proveedor: str = Form(...),
    motivo: str = Form(...),
    ciudad: str = Form(...),
    num_cajas: int = Form(...),
    remitente: str = Form(...),
    archivo: UploadFile = File(...),
):
    """Envía email de devolución lista a un proveedor."""
    suppliers = await asyncio.to_thread(_get_suppliers_from_firestore)
    if proveedor not in suppliers:
        raise HTTPException(404, detail=f"Proveedor '{proveedor}' no encontrado")
    if ciudad not in INFO_CIUDAD:
        raise HTTPException(400, detail=f"Ciudad '{ciudad}' no válida. Opciones: {', '.join(CIUDADES)}")

    info = INFO_CIUDAD[ciudad]
    fecha_str = datetime.now().strftime("%d %b %Y")
    asunto = f'{motivo} "{proveedor}" - {ciudad} - {fecha_str}'
    html_body = _build_proveedores_html(num_cajas, ciudad, info)
    correos = suppliers[proveedor]

    archivo_bytes = await archivo.read()
    nombre_archivo = archivo.filename or "devolucion.xlsx"

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
        "destinatario": proveedor,
        "correos": correos,
        "asunto": asunto,
    }
