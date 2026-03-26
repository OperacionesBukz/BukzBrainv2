# Devoluciones Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Devoluciones module from Panel-Operaciones (Streamlit) to BukzBrainv2 (React + FastAPI) with a Firestore-based send history.

**Architecture:** Backend FastAPI router with 3 endpoints (config, sedes email, proveedores email) reusing existing `send_email` service. Frontend React page with tabs following the step-based pattern (config → processing → results) established by EnvioCortes. Firestore collection `devoluciones_log` for send history with real-time updates via `onSnapshot`.

**Tech Stack:** React 18, TypeScript, FastAPI, TanStack React Query, shadcn/ui, Firebase/Firestore, Tailwind CSS

---

## File Structure

### New files
- `backend/routers/devoluciones.py` — FastAPI router with constants + 3 endpoints
- `src/pages/Devoluciones.tsx` — Main page component with tabs
- `src/pages/devoluciones/types.ts` — TypeScript interfaces + API_BASE re-export
- `src/pages/devoluciones/api.ts` — API call functions using resilientFetch
- `src/pages/devoluciones/hooks.ts` — React Query hooks (queries + mutations)
- `src/pages/devoluciones/SedesTab.tsx` — Sedes email form (step-based)
- `src/pages/devoluciones/ProveedoresTab.tsx` — Proveedores email form (step-based)
- `src/pages/devoluciones/FileUploadField.tsx` — File upload component (accepts multiple types)
- `src/pages/devoluciones/HistorialTab.tsx` — Send history table with Firestore real-time

### Modified files
- `backend/main.py:9-35` — Import + register devoluciones router
- `src/App.tsx:28-74` — Add lazy import + route for Devoluciones
- `src/lib/pages.ts:1-42` — Add Undo2 import + PAGE_REGISTRY entry
- `src/components/Layout.tsx:5-61` — Add Undo2 import + workflowSubItems entry
- `src/hooks/useNavigationPermissions.ts:15` — Add "/devoluciones" to WORKFLOW_SUB_PATHS

---

## Wave 1A: Backend Router

### Task 1: Create backend/routers/devoluciones.py

**Files:**
- Create: `backend/routers/devoluciones.py`

- [ ] **Step 1: Create the router file with constants and all 3 endpoints**

```python
"""
Router de Devoluciones — envío de emails a sedes (recolección) y proveedores (devolución lista).
Migrado desde Panel-Operaciones/Modulos/Devoluciones.py.
"""
from datetime import datetime

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from services.email_service import send_email

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


# ---------------------------------------------------------------------------
# HTML templates
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# GET /api/devoluciones/config
# ---------------------------------------------------------------------------

@router.get("/config")
async def get_config():
    """Retorna listas de configuración para los formularios del frontend."""
    return {
        "sedes": list(SEDES.keys()),
        "motivos_sedes": MOTIVOS_SEDES,
        "proveedores": sorted(PROVEEDORES_EMAIL.keys()),
        "motivos_proveedores": MOTIVOS_PROVEEDORES,
        "ciudades": CIUDADES,
    }


# ---------------------------------------------------------------------------
# POST /api/devoluciones/sedes
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# POST /api/devoluciones/proveedores
# ---------------------------------------------------------------------------

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
    if proveedor not in PROVEEDORES_EMAIL:
        raise HTTPException(404, detail=f"Proveedor '{proveedor}' no encontrado")
    if ciudad not in INFO_CIUDAD:
        raise HTTPException(400, detail=f"Ciudad '{ciudad}' no válida. Opciones: {', '.join(CIUDADES)}")

    info = INFO_CIUDAD[ciudad]
    fecha_str = datetime.now().strftime("%d %b %Y")
    asunto = f'{motivo} "{proveedor}" - {ciudad} - {fecha_str}'
    html_body = _build_proveedores_html(num_cajas, ciudad, info)
    correos = PROVEEDORES_EMAIL[proveedor]

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
```

- [ ] **Step 2: Commit**

```bash
git add backend/routers/devoluciones.py
git commit -m "feat: add devoluciones backend router with sedes and proveedores endpoints"
```

### Task 2: Register router in backend/main.py

**Files:**
- Modify: `backend/main.py:9-35`

- [ ] **Step 1: Add import and router registration**

Add the import after line 13 (`from routers import envio_cortes`):

```python
from routers import devoluciones
```

Add the router registration after line 35 (`app.include_router(envio_cortes.router)`):

```python
app.include_router(devoluciones.router)
```

- [ ] **Step 2: Commit**

```bash
git add backend/main.py
git commit -m "feat: register devoluciones router in backend main"
```

---

## Wave 1B: Frontend (runs in parallel with Wave 1A)

### Task 3: Create types.ts

**Files:**
- Create: `src/pages/devoluciones/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
export { API_BASE } from "../ingreso/types";

export interface DevolucionesConfig {
  sedes: string[];
  motivos_sedes: string[];
  proveedores: string[];
  motivos_proveedores: string[];
  ciudades: string[];
}

export interface EnvioResponse {
  success: boolean;
  destinatario: string;
  correos: string[];
  asunto: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/devoluciones/types.ts
git commit -m "feat(devoluciones): add TypeScript types"
```

### Task 4: Create api.ts

**Files:**
- Create: `src/pages/devoluciones/api.ts`

- [ ] **Step 1: Create the API layer**

```typescript
import { resilientFetch } from "@/lib/resilient-fetch";
import { API_BASE } from "./types";
import type { DevolucionesConfig, EnvioResponse } from "./types";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body?.detail ?? `Error del servidor (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

export async function getConfig(): Promise<DevolucionesConfig> {
  return handleResponse(
    await resilientFetch(`${API_BASE}/api/devoluciones/config`),
  );
}

export async function enviarSedes(
  sede: string,
  motivo: string,
  proveedorNombre: string,
  archivo: File,
  remitente: string,
): Promise<EnvioResponse> {
  const form = new FormData();
  form.append("sede", sede);
  form.append("motivo", motivo);
  form.append("proveedor_nombre", proveedorNombre);
  form.append("archivo", archivo);
  form.append("remitente", remitente);

  return handleResponse(
    await resilientFetch(`${API_BASE}/api/devoluciones/sedes`, {
      method: "POST",
      body: form,
      timeout: 60_000,
    }),
  );
}

export async function enviarProveedores(
  proveedor: string,
  motivo: string,
  ciudad: string,
  numCajas: number,
  archivo: File,
  remitente: string,
): Promise<EnvioResponse> {
  const form = new FormData();
  form.append("proveedor", proveedor);
  form.append("motivo", motivo);
  form.append("ciudad", ciudad);
  form.append("num_cajas", String(numCajas));
  form.append("archivo", archivo);
  form.append("remitente", remitente);

  return handleResponse(
    await resilientFetch(`${API_BASE}/api/devoluciones/proveedores`, {
      method: "POST",
      body: form,
      timeout: 60_000,
    }),
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/devoluciones/api.ts
git commit -m "feat(devoluciones): add API layer"
```

### Task 5: Create hooks.ts

**Files:**
- Create: `src/pages/devoluciones/hooks.ts`

- [ ] **Step 1: Create React Query hooks**

```typescript
import { useQuery, useMutation } from "@tanstack/react-query";
import { getConfig, enviarSedes, enviarProveedores } from "./api";

export function useDevolucionesConfig() {
  return useQuery({
    queryKey: ["devoluciones", "config"],
    queryFn: getConfig,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useEnviarSedes() {
  return useMutation({
    mutationFn: (params: {
      sede: string;
      motivo: string;
      proveedorNombre: string;
      archivo: File;
      remitente: string;
    }) =>
      enviarSedes(
        params.sede,
        params.motivo,
        params.proveedorNombre,
        params.archivo,
        params.remitente,
      ),
  });
}

export function useEnviarProveedores() {
  return useMutation({
    mutationFn: (params: {
      proveedor: string;
      motivo: string;
      ciudad: string;
      numCajas: number;
      archivo: File;
      remitente: string;
    }) =>
      enviarProveedores(
        params.proveedor,
        params.motivo,
        params.ciudad,
        params.numCajas,
        params.archivo,
        params.remitente,
      ),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/devoluciones/hooks.ts
git commit -m "feat(devoluciones): add React Query hooks"
```

### Task 6: Create FileUploadField.tsx

**Files:**
- Create: `src/pages/devoluciones/FileUploadField.tsx`

- [ ] **Step 1: Create the file upload component**

This is a copy of `envio-cortes/FileUploadField.tsx` but with configurable accepted file types (devoluciones proveedores accepts images and PDFs too).

```typescript
import { useRef } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadFieldProps {
  label: string;
  description?: string;
  fileName: string | null;
  accept: string;
  onFileSelected: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function FileUploadField({
  label,
  description,
  fileName,
  accept,
  onFileSelected,
  onClear,
  disabled,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFileSelected(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    e.target.value = "";
  };

  if (fileName) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex items-center gap-3 rounded-lg border border-muted-foreground/25 p-3">
          <FileSpreadsheet className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium flex-1 truncate">{fileName}</span>
          <Button variant="ghost" size="sm" onClick={onClear} disabled={disabled}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors
          border-muted-foreground/25 hover:border-muted-foreground/50
          ${disabled ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Arrastra un archivo aquí o haz clic para seleccionar
        </p>
        {description && (
          <p className="text-xs text-muted-foreground/70">{description}</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/devoluciones/FileUploadField.tsx
git commit -m "feat(devoluciones): add FileUploadField component"
```

### Task 7: Create SedesTab.tsx

**Files:**
- Create: `src/pages/devoluciones/SedesTab.tsx`

- [ ] **Step 1: Create the Sedes tab component**

```typescript
import { useState, useCallback } from "react";
import { Loader2, RotateCcw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import FileUploadField from "./FileUploadField";
import { useDevolucionesConfig, useEnviarSedes } from "./hooks";
import type { EnvioResponse } from "./types";

type Step = "config" | "processing" | "results";

export default function SedesTab() {
  const [step, setStep] = useState<Step>("config");
  const [sede, setSede] = useState("");
  const [motivo, setMotivo] = useState("");
  const [proveedorNombre, setProveedorNombre] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [remitente, setRemitente] = useState("Sebastian Barrios - Bukz");
  const [response, setResponse] = useState<EnvioResponse | null>(null);

  const { data: config, isLoading: configLoading } = useDevolucionesConfig();
  const mutation = useEnviarSedes();

  const canSubmit =
    sede && motivo && proveedorNombre.trim() && archivo && remitente;

  const handleSubmit = useCallback(() => {
    if (!sede || !motivo || !proveedorNombre.trim() || !archivo || !remitente)
      return;

    setStep("processing");
    mutation.mutate(
      { sede, motivo, proveedorNombre: proveedorNombre.trim(), archivo, remitente },
      {
        onSuccess: (data) => {
          setResponse(data);
          toast.success(`Email enviado a ${data.destinatario}`);
          setStep("results");
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Error al enviar email",
          );
          setStep("config");
        },
      },
    );
  }, [sede, motivo, proveedorNombre, archivo, remitente, mutation]);

  const handleReset = useCallback(() => {
    setStep("config");
    setSede("");
    setMotivo("");
    setProveedorNombre("");
    setArchivo(null);
    setResponse(null);
  }, []);

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {step === "config" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Sede destino</Label>
              <Select value={sede} onValueChange={setSede}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sede" />
                </SelectTrigger>
                <SelectContent>
                  {config?.sedes.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar motivo" />
                </SelectTrigger>
                <SelectContent>
                  {config?.motivos_sedes.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="proveedor-nombre">Nombre del proveedor</Label>
              <Input
                id="proveedor-nombre"
                value={proveedorNombre}
                onChange={(e) => setProveedorNombre(e.target.value)}
                placeholder="Ej: Penguin RandomHouse"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="remitente-sedes">Remitente</Label>
              <Input
                id="remitente-sedes"
                value={remitente}
                onChange={(e) => setRemitente(e.target.value)}
              />
            </div>
          </div>

          <FileUploadField
            label="Archivo con los libros a devolver"
            description="Formatos aceptados: xlsx, xls, csv"
            accept=".xlsx,.xls,.csv"
            fileName={archivo?.name ?? null}
            onFileSelected={setArchivo}
            onClear={() => setArchivo(null)}
          />

          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Enviar correo a sede
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Enviando email a la sede...
          </p>
        </div>
      )}

      {step === "results" && response && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Email enviado correctamente</span>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p><span className="font-medium text-foreground">Destinatario:</span> {response.destinatario}</p>
              <p><span className="font-medium text-foreground">Correos:</span> {response.correos.join(", ")}</p>
              <p><span className="font-medium text-foreground">Asunto:</span> {response.asunto}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Nuevo envío
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/devoluciones/SedesTab.tsx
git commit -m "feat(devoluciones): add SedesTab component"
```

### Task 8: Create ProveedoresTab.tsx

**Files:**
- Create: `src/pages/devoluciones/ProveedoresTab.tsx`

- [ ] **Step 1: Create the Proveedores tab component**

This uses a Command-based combobox for the provider list (~130 options) to enable search/filtering.

```typescript
import { useState, useCallback } from "react";
import { Loader2, RotateCcw, CheckCircle2, ChevronsUpDown, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import FileUploadField from "./FileUploadField";
import { useDevolucionesConfig, useEnviarProveedores } from "./hooks";
import type { EnvioResponse } from "./types";

type Step = "config" | "processing" | "results";

export default function ProveedoresTab() {
  const [step, setStep] = useState<Step>("config");
  const [proveedor, setProveedor] = useState("");
  const [proveedorOpen, setProveedorOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [numCajas, setNumCajas] = useState(1);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [remitente, setRemitente] = useState("Sebastian Barrios - Bukz");
  const [response, setResponse] = useState<EnvioResponse | null>(null);

  const { data: config, isLoading: configLoading } = useDevolucionesConfig();
  const mutation = useEnviarProveedores();

  const canSubmit =
    proveedor && motivo && ciudad && numCajas > 0 && archivo && remitente;

  const handleSubmit = useCallback(() => {
    if (!proveedor || !motivo || !ciudad || !archivo || !remitente) return;

    setStep("processing");
    mutation.mutate(
      { proveedor, motivo, ciudad, numCajas, archivo, remitente },
      {
        onSuccess: (data) => {
          setResponse(data);
          toast.success(`Email enviado a ${data.destinatario}`);
          setStep("results");
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Error al enviar email",
          );
          setStep("config");
        },
      },
    );
  }, [proveedor, motivo, ciudad, numCajas, archivo, remitente, mutation]);

  const handleReset = useCallback(() => {
    setStep("config");
    setProveedor("");
    setMotivo("");
    setCiudad("");
    setNumCajas(1);
    setArchivo(null);
    setResponse(null);
  }, []);

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {step === "config" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Popover open={proveedorOpen} onOpenChange={setProveedorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={proveedorOpen}
                    className="w-full justify-between font-normal"
                  >
                    {proveedor || "Buscar proveedor..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar proveedor..." />
                    <CommandList>
                      <CommandEmpty>No se encontró proveedor.</CommandEmpty>
                      <CommandGroup>
                        {config?.proveedores.map((p) => (
                          <CommandItem
                            key={p}
                            value={p}
                            onSelect={(val) => {
                              setProveedor(val === proveedor ? "" : val);
                              setProveedorOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                proveedor === p ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {p}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar motivo" />
                </SelectTrigger>
                <SelectContent>
                  {config?.motivos_proveedores.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Ciudad</Label>
              <Select value={ciudad} onValueChange={setCiudad}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ciudad" />
                </SelectTrigger>
                <SelectContent>
                  {config?.ciudades.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="num-cajas">Cajas / Paquetes</Label>
              <Input
                id="num-cajas"
                type="number"
                min={1}
                value={numCajas}
                onChange={(e) => setNumCajas(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="remitente-prov">Remitente</Label>
              <Input
                id="remitente-prov"
                value={remitente}
                onChange={(e) => setRemitente(e.target.value)}
              />
            </div>
          </div>

          <FileUploadField
            label="Archivo de la devolución"
            description="Formatos aceptados: xlsx, xls, csv, png, jpg, pdf"
            accept=".xlsx,.xls,.csv,.png,.jpg,.jpeg,.pdf"
            fileName={archivo?.name ?? null}
            onFileSelected={setArchivo}
            onClear={() => setArchivo(null)}
          />

          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Enviar correo a proveedor
          </Button>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Enviando email al proveedor...
          </p>
        </div>
      )}

      {step === "results" && response && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Email enviado correctamente</span>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p><span className="font-medium text-foreground">Destinatario:</span> {response.destinatario}</p>
              <p><span className="font-medium text-foreground">Correos:</span> {response.correos.join(", ")}</p>
              <p><span className="font-medium text-foreground">Asunto:</span> {response.asunto}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Nuevo envío
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/devoluciones/ProveedoresTab.tsx
git commit -m "feat(devoluciones): add ProveedoresTab with searchable combobox"
```

### Task 9: Create Devoluciones.tsx main page

**Files:**
- Create: `src/pages/Devoluciones.tsx`

- [ ] **Step 1: Create the main page component**

```typescript
import SedesTab from "./devoluciones/SedesTab";
import ProveedoresTab from "./devoluciones/ProveedoresTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const Devoluciones = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
        Devoluciones
      </h1>
      <p className="mt-1 text-base text-muted-foreground">
        Envío de notificaciones de devolución a sedes y proveedores
      </p>
    </div>
    <Tabs defaultValue="sedes">
      <TabsList>
        <TabsTrigger value="sedes">Sedes</TabsTrigger>
        <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
      </TabsList>
      <TabsContent value="sedes">
        <SedesTab />
      </TabsContent>
      <TabsContent value="proveedores">
        <ProveedoresTab />
      </TabsContent>
    </Tabs>
  </div>
);

export default Devoluciones;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Devoluciones.tsx
git commit -m "feat(devoluciones): add main page with Sedes and Proveedores tabs"
```

### Task 10: Wire up routing and navigation

**Files:**
- Modify: `src/App.tsx:28-74`
- Modify: `src/lib/pages.ts:1-42`
- Modify: `src/components/Layout.tsx:5-61`
- Modify: `src/hooks/useNavigationPermissions.ts:15`

- [ ] **Step 1: Add lazy import and route in App.tsx**

After line 28 (`const EnvioCortes = ...`), add:

```typescript
const Devoluciones = lazyWithReload(() => import("./pages/Devoluciones"));
```

After line 74 (`<Route path="/envio-cortes" ...>`), add:

```typescript
<Route path="/devoluciones" element={<Devoluciones />} />
```

- [ ] **Step 2: Add to PAGE_REGISTRY in pages.ts**

Add `Undo2` to the lucide-react import at line 1:

```typescript
import {
  Home,
  ListChecks,
  ClipboardList,
  BookOpen,
  CalendarDays,
  Store,
  Package,
  Ship,
  ClipboardCheck,
  Calculator,
  PackageSearch,
  SearchCode,
  Scissors,
  ContactRound,
  GitBranchPlus,
  Undo2,
  type LucideIcon,
} from "lucide-react";
```

Add entry to PAGE_REGISTRY array (does NOT need its own top-level nav item since it's a workflow sub-path, but it needs to be in the registry for permission management). Add after the `/workflow` entry:

```typescript
  { path: "/devoluciones", label: "Devoluciones", description: "Envío de devoluciones a sedes y proveedores", icon: Undo2, workspace: "operaciones" },
```

- [ ] **Step 3: Add to workflowSubItems in Layout.tsx**

Add `Undo2` to the lucide-react import at line 5:

```typescript
import {
  Menu,
  LogOut,
  Users,
  Settings,
  ChevronDown,
  ChevronLeft,
  HelpCircle,
  PackageSearch,
  SearchCode,
  Scissors,
  GitBranchPlus,
  Mail,
  Undo2,
} from "lucide-react";
```

Add to `workflowSubItems` array after the Envío Cortes entry (after line 60):

```typescript
  { title: "Devoluciones", path: "/devoluciones", icon: Undo2 },
```

- [ ] **Step 4: Add to WORKFLOW_SUB_PATHS in useNavigationPermissions.ts**

Change line 15 from:

```typescript
const WORKFLOW_SUB_PATHS = ["/ingreso", "/scrap", "/cortes", "/envio-cortes"];
```

To:

```typescript
const WORKFLOW_SUB_PATHS = ["/ingreso", "/scrap", "/cortes", "/envio-cortes", "/devoluciones"];
```

- [ ] **Step 5: Run build to verify**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 6: Run lint to verify**

Run: `npm run lint`
Expected: No ESLint errors

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/lib/pages.ts src/components/Layout.tsx src/hooks/useNavigationPermissions.ts
git commit -m "feat(devoluciones): wire up routing, navigation, and permissions"
```

---

## Wave 1.5: Migration Review

### Task 11: Review and validate Wave 1 implementation

**Files:** All files created/modified in Tasks 1-10

This task is executed by a **reviewer agent**. The agent must:

- [ ] **Step 1: Verify backend endpoints**

Read `backend/routers/devoluciones.py` and verify:
- GET `/config` returns all 5 fields (sedes, motivos_sedes, proveedores, motivos_proveedores, ciudades)
- POST `/sedes` accepts Form fields (sede, motivo, proveedor_nombre, remitente) + File (archivo)
- POST `/proveedores` accepts Form fields (proveedor, motivo, ciudad, num_cajas, remitente) + File (archivo)
- All validation (404 for missing sede/proveedor, 400 for bad ciudad, 502 for SMTP)
- HTML templates match original from Panel-Operaciones/Modulos/Devoluciones.py

- [ ] **Step 2: Verify provider count**

Count the entries in PROVEEDORES_EMAIL dict. Compare with the source file `Panel-Operaciones/Modulos/proveedores_data.py` lines 317-447. There should be ~130 providers. Report if any are missing.

- [ ] **Step 3: Verify frontend types match backend responses**

Read `src/pages/devoluciones/types.ts` and verify:
- `DevolucionesConfig` fields match GET /config response
- `EnvioResponse` fields match POST /sedes and POST /proveedores responses

- [ ] **Step 4: Verify routing is complete**

Check that ALL 4 files have the `/devoluciones` entry:
- `src/App.tsx` — lazy import + `<Route>` element
- `src/lib/pages.ts` — PAGE_REGISTRY entry with Undo2 icon
- `src/components/Layout.tsx` — workflowSubItems entry with Undo2 icon
- `src/hooks/useNavigationPermissions.ts` — WORKFLOW_SUB_PATHS array

- [ ] **Step 5: Verify UI standards**

Read all `.tsx` files in `src/pages/devoluciones/` and verify:
- All visible text is in Spanish
- All components use Tailwind classes compatible with dark/light mode (text-foreground, text-muted-foreground, bg-card, etc.)
- Import order follows convention: React → external libs → @/components → @/hooks → @/lib → @/contexts

- [ ] **Step 6: Run build and lint**

Run: `npm run build && npm run lint`
Expected: Both pass with zero errors

- [ ] **Step 7: Fix any issues found**

If any issues were found in steps 1-6, fix them and commit:

```bash
git add -A
git commit -m "fix(devoluciones): address Wave 1 review findings"
```

---

## Wave 2: Firestore History

### Task 12: Add Firestore log writing to SedesTab and ProveedoresTab

**Files:**
- Modify: `src/pages/devoluciones/SedesTab.tsx`
- Modify: `src/pages/devoluciones/ProveedoresTab.tsx`
- Modify: `src/pages/devoluciones/types.ts`

- [ ] **Step 1: Add DevolucionLog interface to types.ts**

Append to `src/pages/devoluciones/types.ts`:

```typescript
import type { Timestamp } from "firebase/firestore";

export interface DevolucionLog {
  tipo: "sede" | "proveedor";
  destinatario: string;
  correos: string[];
  motivo: string;
  ciudad?: string;
  numCajas?: number;
  proveedorNombre?: string;
  nombreArchivo: string;
  asunto: string;
  enviadoPor: string;
  enviadoPorNombre: string;
  estado: "enviado" | "error";
  detalle?: string;
  creadoEn: Timestamp;
}
```

- [ ] **Step 2: Add logDevolucion helper to api.ts**

Append to `src/pages/devoluciones/api.ts`:

```typescript
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function logDevolucion(
  data: Omit<import("./types").DevolucionLog, "creadoEn">,
): Promise<void> {
  await addDoc(collection(db, "devoluciones_log"), {
    ...data,
    creadoEn: serverTimestamp(),
  });
}
```

- [ ] **Step 3: Add log writing to SedesTab.tsx**

In `SedesTab.tsx`, add import at the top:

```typescript
import { useAuth } from "@/contexts/AuthContext";
import { logDevolucion } from "./api";
```

Inside the component, add after the existing state declarations:

```typescript
const { user } = useAuth();
```

In the `onSuccess` callback of `mutation.mutate`, after `setStep("results")`, add:

```typescript
          logDevolucion({
            tipo: "sede",
            destinatario: data.destinatario,
            correos: data.correos,
            motivo,
            proveedorNombre: proveedorNombre.trim(),
            nombreArchivo: archivo.name,
            asunto: data.asunto,
            enviadoPor: user?.email ?? "",
            enviadoPorNombre: user?.displayName ?? user?.email ?? "",
            estado: "enviado",
          });
```

In the `onError` callback, after `setStep("config")`, add:

```typescript
          logDevolucion({
            tipo: "sede",
            destinatario: sede,
            correos: [],
            motivo,
            proveedorNombre: proveedorNombre.trim(),
            nombreArchivo: archivo.name,
            asunto: "",
            enviadoPor: user?.email ?? "",
            enviadoPorNombre: user?.displayName ?? user?.email ?? "",
            estado: "error",
            detalle: err instanceof Error ? err.message : "Error desconocido",
          });
```

- [ ] **Step 4: Add log writing to ProveedoresTab.tsx**

In `ProveedoresTab.tsx`, add import at the top:

```typescript
import { useAuth } from "@/contexts/AuthContext";
import { logDevolucion } from "./api";
```

Inside the component, add after the existing state declarations:

```typescript
const { user } = useAuth();
```

In the `onSuccess` callback of `mutation.mutate`, after `setStep("results")`, add:

```typescript
          logDevolucion({
            tipo: "proveedor",
            destinatario: data.destinatario,
            correos: data.correos,
            motivo,
            ciudad,
            numCajas,
            nombreArchivo: archivo.name,
            asunto: data.asunto,
            enviadoPor: user?.email ?? "",
            enviadoPorNombre: user?.displayName ?? user?.email ?? "",
            estado: "enviado",
          });
```

In the `onError` callback, after `setStep("config")`, add:

```typescript
          logDevolucion({
            tipo: "proveedor",
            destinatario: proveedor,
            correos: [],
            motivo,
            ciudad,
            numCajas,
            nombreArchivo: archivo.name,
            asunto: "",
            enviadoPor: user?.email ?? "",
            enviadoPorNombre: user?.displayName ?? user?.email ?? "",
            estado: "error",
            detalle: err instanceof Error ? err.message : "Error desconocido",
          });
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/devoluciones/types.ts src/pages/devoluciones/api.ts src/pages/devoluciones/SedesTab.tsx src/pages/devoluciones/ProveedoresTab.tsx
git commit -m "feat(devoluciones): add Firestore log writing on send success/error"
```

### Task 13: Create HistorialTab.tsx

**Files:**
- Create: `src/pages/devoluciones/HistorialTab.tsx`
- Modify: `src/pages/devoluciones/hooks.ts`

- [ ] **Step 1: Add useDevolucionesLog hook to hooks.ts**

Append to `src/pages/devoluciones/hooks.ts`:

```typescript
import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DevolucionLog } from "./types";

export function useDevolucionesLog(maxDocs = 50) {
  const [logs, setLogs] = useState<(DevolucionLog & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "devoluciones_log"),
      orderBy("creadoEn", "desc"),
      limit(maxDocs),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as DevolucionLog),
      }));
      setLogs(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [maxDocs]);

  return { logs, loading };
}
```

- [ ] **Step 2: Create HistorialTab.tsx**

```typescript
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDevolucionesLog } from "./hooks";

const TIPO_STYLES = {
  sede: { label: "Sede", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  proveedor: { label: "Proveedor", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
};

const ESTADO_STYLES = {
  enviado: { label: "Enviado", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  error: { label: "Error", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistorialTab() {
  const { logs, loading } = useDevolucionesLog();
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  const filtered = logs.filter((log) => {
    if (filtroTipo !== "todos" && log.tipo !== filtroTipo) return false;
    if (filtroEstado !== "todos" && log.estado !== filtroEstado) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Historial de envíos</CardTitle>
          <div className="flex gap-2">
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                <SelectItem value="sede">Sedes</SelectItem>
                <SelectItem value="proveedor">Proveedores</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="enviado">Enviados</SelectItem>
                <SelectItem value="error">Errores</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay registros de envío
          </p>
        ) : (
          <div className="rounded border overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Tipo</th>
                  <th className="text-left px-3 py-2">Destinatario</th>
                  <th className="text-left px-3 py-2">Motivo</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-left px-3 py-2">Enviado por</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => {
                  const tipoStyle = TIPO_STYLES[log.tipo];
                  const estadoStyle = ESTADO_STYLES[log.estado];
                  return (
                    <tr key={log.id} className="border-t">
                      <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.creadoEn as { seconds: number } | null)}
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge variant="secondary" className={tipoStyle.className}>
                          {tipoStyle.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5 font-medium">{log.destinatario}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{log.motivo}</td>
                      <td className="px-3 py-1.5">
                        <Badge variant="secondary" className={estadoStyle.className}>
                          {estadoStyle.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {log.enviadoPorNombre}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/devoluciones/hooks.ts src/pages/devoluciones/HistorialTab.tsx
git commit -m "feat(devoluciones): add HistorialTab with real-time Firestore log"
```

### Task 14: Add Historial tab to main page

**Files:**
- Modify: `src/pages/Devoluciones.tsx`

- [ ] **Step 1: Update Devoluciones.tsx to include the Historial tab**

Replace the full content of `src/pages/Devoluciones.tsx` with:

```typescript
import SedesTab from "./devoluciones/SedesTab";
import ProveedoresTab from "./devoluciones/ProveedoresTab";
import HistorialTab from "./devoluciones/HistorialTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const Devoluciones = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
        Devoluciones
      </h1>
      <p className="mt-1 text-base text-muted-foreground">
        Envío de notificaciones de devolución a sedes y proveedores
      </p>
    </div>
    <Tabs defaultValue="sedes">
      <TabsList>
        <TabsTrigger value="sedes">Sedes</TabsTrigger>
        <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
        <TabsTrigger value="historial">Historial</TabsTrigger>
      </TabsList>
      <TabsContent value="sedes">
        <SedesTab />
      </TabsContent>
      <TabsContent value="proveedores">
        <ProveedoresTab />
      </TabsContent>
      <TabsContent value="historial">
        <HistorialTab />
      </TabsContent>
    </Tabs>
  </div>
);

export default Devoluciones;
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/Devoluciones.tsx
git commit -m "feat(devoluciones): add Historial tab to main page"
```

---

## Wave 2.5: History Review

### Task 15: Review and validate Wave 2 implementation

**Files:** All files modified in Tasks 12-14

This task is executed by a **reviewer agent**. The agent must:

- [ ] **Step 1: Verify Firestore document structure**

Read `src/pages/devoluciones/types.ts` and verify `DevolucionLog` interface has all required fields: tipo, destinatario, correos, motivo, ciudad?, numCajas?, proveedorNombre?, nombreArchivo, asunto, enviadoPor, enviadoPorNombre, estado, detalle?, creadoEn.

- [ ] **Step 2: Verify log writing in both tabs**

Read `SedesTab.tsx` and `ProveedoresTab.tsx`. Verify:
- `logDevolucion()` is called in BOTH onSuccess AND onError callbacks
- SedesTab passes `tipo: "sede"` and includes `proveedorNombre`
- ProveedoresTab passes `tipo: "proveedor"` and includes `ciudad` and `numCajas`
- Both import `useAuth` and use `user?.email` and `user?.displayName`

- [ ] **Step 3: Verify onSnapshot cleanup**

Read `hooks.ts` and verify:
- `useDevolucionesLog` uses `onSnapshot` with `orderBy("creadoEn", "desc")` and `limit(50)`
- The `useEffect` returns the `unsubscribe` function for cleanup

- [ ] **Step 4: Verify HistorialTab filters**

Read `HistorialTab.tsx` and verify:
- Filters for tipo (todos/sede/proveedor) and estado (todos/enviado/error) exist
- `formatDate` correctly handles Firestore Timestamp objects
- Badge styles use dark mode compatible classes

- [ ] **Step 5: Run build and lint**

Run: `npm run build && npm run lint`
Expected: Both pass with zero errors

- [ ] **Step 6: Fix any issues found**

If any issues were found in steps 1-5, fix them and commit:

```bash
git add -A
git commit -m "fix(devoluciones): address Wave 2 review findings"
```

---

## Wave 3: Final Integral Review

### Task 16: Final comprehensive review

**Files:** ALL files created/modified across all waves

This task is executed by a **specialized reviewer agent**. The agent must perform an exhaustive review:

- [ ] **Step 1: Read all new/modified files**

Read every file that was created or modified:
- `backend/routers/devoluciones.py`
- `backend/main.py`
- `src/pages/Devoluciones.tsx`
- `src/pages/devoluciones/types.ts`
- `src/pages/devoluciones/api.ts`
- `src/pages/devoluciones/hooks.ts`
- `src/pages/devoluciones/SedesTab.tsx`
- `src/pages/devoluciones/ProveedoresTab.tsx`
- `src/pages/devoluciones/FileUploadField.tsx`
- `src/pages/devoluciones/HistorialTab.tsx`
- `src/App.tsx`
- `src/lib/pages.ts`
- `src/components/Layout.tsx`
- `src/hooks/useNavigationPermissions.ts`

- [ ] **Step 2: Verify no existing modules were broken**

Check that the modifications to shared files (App.tsx, pages.ts, Layout.tsx, useNavigationPermissions.ts) did not alter any existing entries — only added new ones.

- [ ] **Step 3: Run full build**

Run: `npm run build`
Expected: Zero errors, zero warnings (or only pre-existing warnings)

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: Zero errors

- [ ] **Step 5: Verify import order convention**

In every `.tsx`/`.ts` file in `src/pages/devoluciones/`, verify imports follow:
1. React and external libraries
2. Components (`@/components/...`)
3. Hooks (`@/hooks/...`)
4. Utilities and Firebase (`@/lib/...`)
5. Contexts (`@/contexts/...`)
6. Local imports (`./...`)

- [ ] **Step 6: Verify all UI text is in Spanish**

Grep all `.tsx` files in `src/pages/devoluciones/` for any English-only strings in user-visible text. Button labels, placeholders, messages — all must be in Spanish.

- [ ] **Step 7: Verify dark/light mode support**

Check that NO `.tsx` file uses hardcoded colors (like `text-gray-500` without a dark variant or `bg-white`). All should use semantic Tailwind tokens: `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-muted`, `border`, etc.

- [ ] **Step 8: Verify searchable provider select is usable**

Confirm `ProveedoresTab.tsx` uses the Command/Popover combobox pattern (not a plain Select) for the provider dropdown, since there are ~130 options.

- [ ] **Step 9: Security check**

Verify that HTML templates in `backend/routers/devoluciones.py` do not concatenate user input directly into HTML without awareness of XSS. Check that `proveedor_nombre` (free text from user) is used in the email body — this is acceptable since emails are sent server-side and not rendered in the browser as raw HTML. But verify no user input is used in `eval()`, `exec()`, or similar.

- [ ] **Step 10: Generate final report**

Output a structured report:

```
FINAL REVIEW REPORT — Devoluciones Module
==========================================

Build:    PASS / FAIL
Lint:     PASS / FAIL
Imports:  PASS / FAIL (list any violations)
Spanish:  PASS / FAIL (list any English strings)
Dark mode: PASS / FAIL (list any hardcoded colors)
Security: PASS / FAIL (list any concerns)
Providers: XX providers registered (expected ~130)

Overall:  READY / NEEDS FIXES
Issues:   [list any remaining issues]
```

- [ ] **Step 11: Fix any issues found**

If any issues were found, fix them and commit:

```bash
git add -A
git commit -m "fix(devoluciones): address final review findings"
```
