"""
Router de Pedidos — envío de pedidos por email a proveedores (por sede o por ciudad).
Migrado desde Panel-Operaciones/Modulos/Pedidos.py.
"""
from datetime import datetime

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from services.email_service import send_email
from services.firebase_service import get_firestore_db

router = APIRouter(prefix="/api/pedidos", tags=["pedidos"])

# ---------------------------------------------------------------------------
# Constantes (migradas desde Panel-Operaciones/Modulos/proveedores_data.py)
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

# Proveedores para pedidos por sede (proveedor -> lista de emails)
PROVEEDORES_SEDES: dict[str, list[str]] = {
    "Prueba": ["operaciones@bukz.co"],
    "Penguin RandomHouse (MED)": ["natalia.Hurtado@penguinrandomhouse.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Penguin RandomHouse (BOG)": ["fernanda.Herrera@penguinrandomhouse.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Grupo Editorial Planeta (MED)": ["mromero@planeta.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Grupo Editorial Planeta (BOG)": ["ovargas@planeta.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Oceano": ["alejandro.vargas@oceano.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Grupo Penta": ["zoraida.ojeda@grupopenta.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Siglo del Hombre (MED)": ["hjimenez@siglodelhombre.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Siglo del Hombre (BOG)": ["jbernal@somossiglo.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Grupo Monserrate": ["grupomonserratemedellin@hotmail.com", "artbooksmilenaleonel@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Sin Fronteras": ["comercial1@gruposinfronteras.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "ACLI": ["info.aclilibreros@gmail.com", "inventariosacli@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Alianza Editorial": ["alianzaeditorialmed@hotmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Alicia Mejia": ["administrativo@thinklicious.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Angosta Editores": ["auxiliar@angosta.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Arquine": ["camilo@agendarq.com", "andrea@arquine.com", "miquel@arquine.com", "distribucion@arquine.com", "operaciones@bukz.co"],
    "Artemis Libros": ["artemislibros@yahoo.es", "operaciones@bukz.co", "cedi@bukz.co"],
    "Caballito de Acero": ["editorial@caballitodeacero.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Calixta Editores": ["luis.izquierdo@calixtaeditores.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Carolina Giraldo García": ["hola@carogiraldogarcia.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Carolina Pérez Botero": ["carolina@amorescaprichosos.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Catalina Mayorga": ["gonzalez.saldarriaga@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Circulo de lectores": ["aremil@circulo.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Contenido": ["contenido.contenido@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Cubo Universo Creativo": ["gerencia@cubocultural.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Difusora Larousse de Colombia": ["francygonzalez@larousse.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Diseños Lalys": ["leamosliteraturayletras@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones Gaviota": ["ventas1@ediciones-gaviota.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones Urano (MED)": ["m.osorio@edicionesurano.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones Urano (BOG)": ["m.osorio@uranoworld.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones Vestigio": ["editor.vestigio@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Editorial Eafit": ["aherrerag@eafit.edu.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Editorial Quimbombó": ["editorialquimbombo@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Editorial Solar": ["nathalie.editorialsolar@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Elev8 Media S.A.S": ["gary@elev8.io", "elizabeth@elev8.io", "giraldo.anamaria@asesoriashg.com", "cedi@bukz.co"],
    "Epifánico": ["contacto@epifanico.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Estrategia en Ventas": ["soporte@estrategiaenventas.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "FCE": ["camilo.hernandez@fce.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Fondo Cultural Iberoamericano (MED)": ["focui@outlook.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Fondo Cultural Iberoamericano (BOG)": ["vivianateresaluna15@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Frailejón Editores": ["frailejoneditores@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Huracán Distribución": ["huracandistribucion@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Icaro Libros": ["ventas@icarolibros.com", "operaciones@bukz.co"],
    "La Editora - Ana Meza": ["ana@analaeditora.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Libro Arte S.A.S": ["Ventas@tarangoplay.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Lobolunar": ["lobolunarcolombia@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Mandalas para el alma": ["direccion@andreagudelo.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Marco Polo": ["marcopolo.encuadernacion.art@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Mesaestandar": ["contacto@mesaestandar.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "No Apto": ["marianavasquez90@hotmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Plaza & Janes": ["diego.ospina@plazayjanescolombia.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Poster Colombia": ["postercolombia@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Raya Editores": ["rayaeditorial@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Rey Naranjo": ["administrativo@reynaranjo.net", "operaciones@bukz.co", "cedi@bukz.co"],
    "Silaba Editores": ["asistentesilaba@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "SITRA Mundo Creativo": ["basalmobiliario@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Taller de edición Rocca": ["correotallerdeedicionrocca@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ingenio": ["comercial@ingeniodestrezamental.com", "pperez@ingeniodestrezamental.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Tool-be": ["alejandra.zuluaga@tool-be.com", "maria.velez@tool-be.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Tragaluz Editores": ["ventas@tragaluzeditores.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Travesía Juglar": ["travesiajuglar@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Universidad CES": ["ndurangor@ces.edu.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Vasquez Editores": ["vasquezeditores@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Viiel": ["solarber2010@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Policefalo": ["policefaloediciones@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Asociación de Editoriales Independientes de Chile": ["andresfberdugo@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "La Valija de Fuego Editorial": ["lavalijadefuegoeditorial@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Arbitraria": ["arbitrariaeditorial@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Libros del Motín": ["david7g@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Lazo Libros": ["hola@lazolibros.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Axioma Editores": ["axiomaeditores@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Grammata - Vazquez": ["vasquezeditores@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Saga Libros": ["ventas@saga.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Mo Ediciones": ["monica.montes@moediciones.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Cain Press": ["info@cainpress.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Libros del Fuego": ["rodcasares@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Verso Libre": ["versolibre@comunycorriente.org", "operaciones@bukz.co", "cedi@bukz.co"],
    "Artimaña Editorial": ["artimanaeditorial@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "McMullan Birding": ["ensiferaeditores@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Club Editores S.A.": ["dianapaezm@yahoo.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "As Ediciones": ["gerencia@asediciones.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Amelia Amortegui": ["holavengaledigo@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Dos Gatos Editores": ["xtinawilhelm@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Cypres": ["cypreslibrerias@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Kocodio": ["info@kocodio.com", "comercial@kocodio.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Astropuerta": ["astropuerta@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones el Silencio": ["logisticaedicioneselsilencio@gmail.com", "auxiliardeventas@edicioneselsilencio.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones de la U": ["comercial1@edicionesdelau.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Fera": ["ventas.fera@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Poiema Publicaciones": ["celis@poiema.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones Gamma": ["comercial@revistadiners.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Union Editorial Colombia": ["gilberto.ramirez@unioneditorial.net", "freddyjosecarrillo@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Lavanda Editoras": ["claudiaivonne09@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Germán Puerta": ["astropuerta@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Villegas Editores": ["comercial@villegaseditores.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "La Diligencia": ["ladiligenciacolombia@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Babel": ["libros.babel@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Luz Karime Saleme Correa": ["lksaleme@leonardonino.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Cangrejo Editores": ["camilo.aljure@cangrejoeditores.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Testigo Directo": ["produccion@testigodirectoeditorial.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Panamericana": ["panamericanaeditorial.pedidos@panamericana.com.co", "adriana.tovar@panamericana.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Hipertexto": ["lider.supplychain@hipertexto.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Unilat": ["ventas@unilat.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ojos de tus Ojos": ["carojimet@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Secretos para Contar": ["yeny.castrillon@secretosparacontar.org", "operaciones@bukz.co", "cedi@bukz.co"],
    "SOFIA EDITORES SAS": ["sofiaeditores@gmail.com", "moniquillar@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Proyectos Sin Limites": ["ventas@proyectossinlimites.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Catherine Villota": ["catyvillota@fashionradicals.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Jaime Botero": ["lasagabotero@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Empoderados SAS": ["diana@antu.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "The Black Bean": ["hola@theblackbean.net", "operaciones@bukz.co", "cedi@bukz.co"],
    "Harry Marin": ["marinvahos@hotmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Holz Haus": ["xilostech@gmail.com", "cechavarriasoto@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones La Pluma del Águila": ["jarredondo@aguiladescalza.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Maria Pulido Alvarez": ["laura.alvarezlopez83@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Nelly Giraldo Gil": ["wonderwiseeod@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Fundación Casa Arcoíris": ["casaarcoiris7@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Valeria Marín Pineda": ["gatosmaestrosdevida@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Aguila Descalza": ["contabilidad@aguiladescalza.com.co", "asisadministrativo@aguiladescalza.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Acuarell": ["zalamt@hotmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Happy Kiddo": ["lorena@happykiddobooks.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Feliciano Escobar": ["felicianoescobar@yahoo.com", "medellinupclose@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Booktique": ["booktiquecol@gmail.com", "medellinupclose@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Idealo Pez": ["lestrada@idealopez.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Alejandro Salazar": ["administrativa@tbreakthrough.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Toy": ["comercial@toystyle.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Sin Ocasión": ["sinocasion@outlook.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Arpegio Cool": ["arpegio.cool@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Norma": ["imontoya@edicionesnorma.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Alejandra Mesa": ["alejandramesag97@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
}

# Proveedores para pedidos por ciudad (proveedor -> lista de emails)
PROVEEDORES_CIUDAD: dict[str, list[str]] = {
    "Prueba": ["sebastianbarriosdiaz04@gmail.com"],
    "Penguin RandomHouse (MED)": ["natalia.Hurtado@penguinrandomhouse.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Penguin RandomHouse (BOG)": ["fernanda.Herrera@penguinrandomhouse.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Grupo Editorial Planeta (MED)": ["mromero@planeta.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Grupo Editorial Planeta (BOG)": ["ovargas@planeta.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Oceano": ["yexson.miranda@oceano.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Siglo del Hombre (MED)": ["hjimenez@siglodelhombre.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Siglo del Hombre (BOG)": ["jbernal@somossiglo.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Grupo Monserrate": ["grupomonserratemedellin@hotmail.com", "artbooksmilenaleonel@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Sin Fronteras": ["comercial1@gruposinfronteras.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Grupo Penta": ["zoraida.ojeda@grupopenta.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "ACLI": ["info.aclilibreros@gmail.com", "inventariosacli@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Alianza Editorial": ["alianzaeditorialmed@hotmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Alicia Mejia": ["administrativo@thinklicious.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Angosta Editores": ["auxiliar@angosta.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Arquine": ["camilo@agendarq.com", "andrea@arquine.com", "miquel@arquine.com", "distribucion@arquine.com", "operaciones@bukz.co"],
    "Artemis Libros": ["artemislibros@yahoo.es", "operaciones@bukz.co", "cedi@bukz.co"],
    "Caballito de Acero": ["editorial@caballitodeacero.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Calixta Editores": ["luis.izquierdo@calixtaeditores.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Carolina Giraldo García": ["hola@carogiraldogarcia.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Carolina Pérez Botero": ["carolina@amorescaprichosos.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Catalina Mayorga": ["gonzalez.saldarriaga@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Circulo de lectores": ["aremil@circulo.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Contenido": ["contenido.contenido@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Cubo Universo Creativo": ["gerencia@cubocultural.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Difusora Larousse de Colombia": ["francygonzalez@larousse.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Diseños Lalys": ["leamosliteraturayletras@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones Gaviota": ["ventas1@ediciones-gaviota.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones Urano (MED)": ["m.osorio@edicionesurano.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones Urano (BOG)": ["f.arevalo@uranoworld.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones Vestigio": ["editor.vestigio@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Editorial Eafit": ["aherrerag@eafit.edu.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Editorial Quimbombó": ["editorialquimbombo@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Editorial Solar": ["nathalie.editorialsolar@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Elev8 Media S.A.S": ["gary@elev8.io", "elizabeth@elev8.io", "giraldo.anamaria@asesoriashg.com", "cedi@bukz.co"],
    "Epifánico": ["contacto@epifanico.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Estrategia en Ventas": ["soporte@estrategiaenventas.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "FCE": ["camilo.hernandez@fce.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Fondo Cultural Iberoamericano (MED)": ["focui@outlook.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Fondo Cultural Iberoamericano (BOG)": ["vivianateresaluna15@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Frailejón Editores": ["frailejoneditores@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Huracán Distribución": ["huracandistribucion@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Icaro Libros": ["ventas@icarolibros.com", "operaciones@bukz.co"],
    "La Editora - Ana Meza": ["ana@analaeditora.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Libro Arte S.A.S": ["Ventas@tarangoplay.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Lobolunar": ["lobolunarcolombia@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Mandalas para el alma": ["direccion@andreagudelo.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Marco Polo": ["marcopolo.encuadernacion.art@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Mesaestandar": ["contacto@mesaestandar.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "No Apto": ["marianavasquez90@hotmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Plaza & Janes": ["diego.ospina@plazayjanescolombia.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Poster Colombia": ["postercolombia@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Raya Editores": ["rayaeditorial@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Rey Naranjo": ["administrativo@reynaranjo.net", "operaciones@bukz.co", "cedi@bukz.co"],
    "Silaba Editores": ["asistentesilaba@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "SITRA Mundo Creativo": ["basalmobiliario@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Taller de edición Rocca": ["correotallerdeedicionrocca@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ingenio": ["comercial@ingeniodestrezamental.com", "pperez@ingeniodestrezamental.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Tool-be": ["alejandra.zuluaga@tool-be.com", "maria.velez@tool-be.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Tragaluz Editores": ["ventas@tragaluzeditores.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Travesía Juglar": ["travesiajuglar@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Universidad CES": ["ndurangor@ces.edu.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Vasquez Editores": ["vasquezeditores@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Viiel": ["solarber2010@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Policefalo": ["policefaloediciones@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Asociación de Editoriales Independientes de Chile": ["andresfberdugo@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "La Valija de Fuego Editorial": ["lavalijadefuegoeditorial@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Arbitraria": ["arbitrariaeditorial@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Libros del Motín": ["david7g@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Lazo Libros": ["hola@lazolibros.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Axioma Editores": ["axiomaeditores@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Grammata - Vazquez": ["vasquezeditores@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Saga Libros": ["ventas@saga.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Mo Ediciones": ["monica.montes@moediciones.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Cain Press": ["info@cainpress.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Libros del Fuego": ["rodcasares@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Verso Libre": ["versolibre@comunycorriente.org", "operaciones@bukz.co", "cedi@bukz.co"],
    "Artimaña Editorial": ["artimanaeditorial@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "McMullan Birding": ["ensiferaeditores@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Club Editores S.A.": ["dianapaezm@yahoo.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "As Ediciones": ["gerencia@asediciones.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Amelia Amortegui": ["holavengaledigo@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Dos Gatos Editores": ["xtinawilhelm@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Cypres": ["cypreslibrerias@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Kocodio": ["info@kocodio.com", "comercial@kocodio.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Astropuerta": ["astropuerta@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones el Silencio": ["logisticaedicioneselsilencio@gmail.com", "auxiliardeventas@edicioneselsilencio.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones de la U": ["comercial1@edicionesdelau.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Fera": ["ventas.fera@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Poiema Publicaciones": ["celis@poiema.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones Gamma": ["comercial@revistadiners.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Union Editorial Colombia": ["gilberto.ramirez@unioneditorial.net", "freddyjosecarrillo@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Lavanda Editoras": ["claudiaivonne09@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Germán Puerta": ["astropuerta@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Villegas Editores": ["comercial@villegaseditores.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "La Diligencia": ["ladiligenciacolombia@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Babel": ["libros.babel@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Luz Karime Saleme Correa": ["lksaleme@leonardonino.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Cangrejo Editores": ["camilo.aljure@cangrejoeditores.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Testigo Directo": ["produccion@testigodirectoeditorial.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Panamericana": ["panamericanaeditorial.pedidos@panamericana.com.co", "adriana.tovar@panamericana.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Hipertexto": ["lider.supplychain@hipertexto.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Unilat": ["ventas@unilat.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ojos de tus Ojos": ["carojimet@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Secretos para Contar": ["yeny.castrillon@secretosparacontar.org", "operaciones@bukz.co", "cedi@bukz.co"],
    "SOFIA EDITORES SAS": ["sofiaeditores@gmail.com", "moniquillar@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Proyectos Sin Limites": ["ventas@proyectossinlimites.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Catherine Villota": ["catyvillota@fashionradicals.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Jaime Botero": ["lasagabotero@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Empoderados SAS": ["diana@antu.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "The Black Bean": ["hola@theblackbean.net", "operaciones@bukz.co", "cedi@bukz.co"],
    "Harry Marin": ["marinvahos@hotmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Holz Haus": ["xilostech@gmail.com", "cechavarriasoto@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Ediciones La Pluma del Águila": ["jarredondo@aguiladescalza.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Maria Pulido Alvarez": ["laura.alvarezlopez83@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Nelly Giraldo Gil": ["wonderwiseeod@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Fundación Casa Arcoíris": ["casaarcoiris7@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Valeria Marín Pineda": ["gatosmaestrosdevida@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Aguila Descalza": ["contabilidad@aguiladescalza.com.co", "asisadministrativo@aguiladescalza.com.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Acuarell": ["zalamt@hotmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Happy Kiddo": ["lorena@happykiddobooks.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Feliciano Escobar": ["felicianoescobar@yahoo.com", "medellinupclose@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Booktique": ["booktiquecol@gmail.com", "medellinupclose@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Idealo Pez": ["lestrada@idealopez.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Alejandro Salazar": ["administrativa@tbreakthrough.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Toy": ["comercial@toystyle.co", "operaciones@bukz.co", "cedi@bukz.co"],
    "Sin Ocasión": ["sinocasion@outlook.com", "operaciones@bukz.co", "cedi@bukz.co"],
    "Arpegio Cool": ["arpegio.cool@gmail.com", "operaciones@bukz.co", "cedi@bukz.co"],
}


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
    return {
        "sedes": list(SEDES.keys()),
        "sedes_info": SEDES,
        "proveedores_sedes": sorted(PROVEEDORES_SEDES.keys()),
        "proveedores_ciudad": sorted(PROVEEDORES_CIUDAD.keys()),
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
    if proveedor not in PROVEEDORES_SEDES:
        raise HTTPException(404, detail=f"Proveedor '{proveedor}' no encontrado")

    sede_info = SEDES[sede]
    fecha_str = datetime.now().strftime("%d %b %Y")
    asunto = f"Pedido BUKZ {tipo} - Sede: {sede} - {proveedor} - {fecha_str}"
    html_body = _build_sede_html(sede, sede_info)

    correos = list(PROVEEDORES_SEDES[proveedor])
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
    if proveedor not in PROVEEDORES_CIUDAD:
        raise HTTPException(404, detail=f"Proveedor '{proveedor}' no encontrado")

    # Construir asunto según tipo
    asunto = f"Pedido {mes} Bukz {ciudad} {anio} - {proveedor}"
    if tipo == "Novedad":
        asunto = f"Novedad - {asunto}"
    elif tipo == "B2B":
        asunto = f"PEDIDOS B2B - {asunto}"

    html_body = _build_ciudad_html(ciudad)

    correos = list(PROVEEDORES_CIUDAD[proveedor])
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
