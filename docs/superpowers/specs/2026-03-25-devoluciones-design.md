# Devoluciones Module — Design Spec

**Fecha:** 2026-03-25
**Módulo fuente:** Panel-Operaciones/Modulos/Devoluciones.py
**Destino:** BukzBrainv2 — workspace operaciones, submenú workflow `/devoluciones`

---

## Resumen

Migración del módulo de Devoluciones desde el panel Streamlit a BukzBrainv2 (React + TypeScript + FastAPI). El módulo permite enviar emails de notificación para dos flujos de devolución de libros: recolección en sedes y aviso a proveedores. Se implementa en dos fases: migración fiel + historial de envíos en Firestore.

---

## Fase 1 — Migración fiel

### Backend

**Archivo:** `backend/routers/devoluciones.py`
**Prefix:** `/api/devoluciones`
**Registrar en:** `backend/main.py`

#### Constantes (dentro del router)

```python
SEDES = {
    "Bukz Las Lomas": "lomas@bukz.co",
    "Bukz Viva Envigado": "vivaenvigado@bukz.co",
    "Bukz Museo": "museo@bukz.co",
    "Bukz Bogotá": "bogota109@bukz.co",
    "Bukz Cedi": "cedi@bukz.co",
}

MOTIVOS_SEDES = ["Devolución", "Devolución Descatalogados", "Devolución Urgente"]

PROVEEDORES_EMAIL = {
    # ~130 proveedores migrados desde proveedores_data.py líneas 317-447
    # Cada key es nombre del proveedor, value es lista de emails
}

MOTIVOS_PROVEEDORES = ["Devolución", "Devolución Descatalogados", "Devolución Baja Rotación"]

CIUDADES = ["Medellín", "Bogotá"]

INFO_CIUDAD = {
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
```

#### Endpoints

**`GET /config`** — Retorna listas de configuración al frontend.
```json
{
  "sedes": ["Bukz Las Lomas", "Bukz Viva Envigado", ...],
  "motivos_sedes": ["Devolución", ...],
  "proveedores": ["Penguin RandomHouse (MED)", ...],
  "motivos_proveedores": ["Devolución", ...],
  "ciudades": ["Medellín", "Bogotá"]
}
```

**`POST /sedes`** — Envía email de recolección a una sede.

Parámetros (Form + File):
- `sede: str` — nombre de la sede
- `motivo: str` — motivo de devolución
- `proveedor_nombre: str` — nombre del proveedor (texto libre)
- `archivo: UploadFile` — archivo adjunto (xlsx/xls/csv)
- `remitente: str` — nombre visible del remitente

Lógica:
1. Validar que `sede` existe en SEDES
2. Construir asunto: `{motivo} "{proveedor_nombre}" - {sede} - {DD Mon YYYY}`
3. Construir HTML con template de recolección (pedir apoyo con recolección, envío al CEDI)
4. Enviar email via `send_email()` a `SEDES[sede]`
5. Retornar: `{ "success": true, "destinatario": sede, "correos": [email], "asunto": asunto }`

**`POST /proveedores`** — Envía email de devolución lista a un proveedor.

Parámetros (Form + File):
- `proveedor: str` — nombre del proveedor (del catálogo)
- `motivo: str` — motivo de devolución
- `ciudad: str` — Medellín o Bogotá
- `num_cajas: int` — número de cajas/paquetes
- `archivo: UploadFile` — archivo adjunto (xlsx/xls/csv/png/jpg/jpeg/pdf)
- `remitente: str` — nombre visible del remitente

Lógica:
1. Validar que `proveedor` existe en PROVEEDORES_EMAIL
2. Validar que `ciudad` existe en INFO_CIUDAD
3. Construir asunto: `{motivo} "{proveedor}" - {ciudad} - {DD Mon YYYY}`
4. Construir HTML con info logística (dirección, contacto, cel de la ciudad, num cajas, solicitud de nota de descargue)
5. Enviar email via `send_email()` a `PROVEEDORES_EMAIL[proveedor]`
6. Retornar: `{ "success": true, "destinatario": proveedor, "correos": [...], "asunto": asunto }`

#### Templates HTML

**Sedes:**
```html
<p>Buen día compañeros, espero que todo marche bien.</p>
<p>Por favor, nos apoyan con la recolección de la devolución correspondiente al proveedor
   <b>{proveedor_nombre}</b> y su envío al CEDI para el respectivo proceso.</p>
<p>Quedamos atentos a la confirmación de la gestión.</p>
<p>Muchas gracias.</p>
<p>Saludos,</p>
```

**Proveedores:**
```html
<p>Buenas tardes, espero que todo marche bien.</p>
<p>La devolución correspondiente de la consignación se encuentra lista para ser recogida;
   por favor tener en cuenta la información para la recogida del producto:</p>
<p><b>Cajas y/o Paquetes:</b> <b>{num_cajas}</b></p>
<p><b>Dirección de recogida:</b> <b>{ciudad} {info.direccion}</b></p>
<p><b>Contacto:</b> <b>{info.contacto}</b></p>
<p><b>Cel:</b> <b>{info.cel}</b></p>
<p>Adjunto archivo de la devolución, por favor nos envían la nota de descargue
   de la consignación vigente.</p>
<p>Saludos,</p>
```

#### Manejo de errores

- Sede/proveedor no encontrado → HTTP 404
- Ciudad no válida → HTTP 400
- Fallo SMTP → HTTP 502 con detalle del error
- Archivo faltante → HTTP 422 (FastAPI automático)

---

### Frontend

#### Estructura de archivos

```
src/pages/
  Devoluciones.tsx
  devoluciones/
    types.ts
    api.ts
    hooks.ts
    SedesTab.tsx
    ProveedoresTab.tsx
```

#### `types.ts`
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

#### `api.ts`
- `getConfig(): Promise<DevolucionesConfig>` — GET /config
- `enviarSedes(sede, motivo, proveedorNombre, archivo, remitente): Promise<EnvioResponse>` — POST /sedes con FormData
- `enviarProveedores(proveedor, motivo, ciudad, numCajas, archivo, remitente): Promise<EnvioResponse>` — POST /proveedores con FormData
- Helper `handleResponse<T>` reutilizado del patrón de envio-cortes

#### `hooks.ts`
- `useDevolucionesConfig()` — useQuery con queryKey `["devoluciones", "config"]`, staleTime 10min
- `useEnviarSedes()` — useMutation
- `useEnviarProveedores()` — useMutation

#### `Devoluciones.tsx`
Página principal con layout estándar:
- Header: título "Devoluciones" + descripción
- 2 tabs: "Sedes" y "Proveedores"

#### `SedesTab.tsx`
Patrón step-based (config → processing → results):
- **Config**: Select sede, Select motivo, Input proveedor (texto libre), FileUpload (xlsx/xls/csv), Input remitente, Botón enviar
- **Processing**: Spinner con mensaje
- **Results**: Confirmación con destinatario, correos enviados, asunto. Botón "Nuevo envío"

#### `ProveedoresTab.tsx`
Patrón step-based (config → processing → results):
- **Config**: Select proveedor (searchable/filtrable por la cantidad), Select motivo, Select ciudad, Input numérico cajas, FileUpload (xlsx/xls/csv/png/jpg/pdf), Input remitente, Botón enviar
- **Processing**: Spinner con mensaje
- **Results**: Confirmación con destinatario, correos enviados, asunto. Botón "Nuevo envío"

Nota: el select de proveedores debe soportar búsqueda dado que hay ~130 opciones.

#### Configuración (archivos a modificar)

**`App.tsx`:**
- Agregar lazy import: `const Devoluciones = lazyWithReload(() => import("./pages/Devoluciones"));`
- Agregar ruta: `<Route path="/devoluciones" element={<Devoluciones />} />`

**`src/lib/pages.ts`:**
- Agregar a PAGE_REGISTRY: `{ path: "/devoluciones", label: "Devoluciones", description: "Envío de devoluciones a sedes y proveedores", icon: Undo2, workspace: "operaciones" }`

**`src/components/Layout.tsx`:**
- Agregar a workflowSubItems: `{ title: "Devoluciones", path: "/devoluciones", icon: Undo2 }`
- Importar Undo2 de lucide-react

**`src/hooks/useNavigationPermissions.ts`:**
- Agregar "/devoluciones" al array WORKFLOW_SUB_PATHS

**`backend/main.py`:**
- Importar y registrar router de devoluciones

---

## Fase 2 — Historial de envíos

### Colección Firestore: `devoluciones_log`

Cada documento representa un envío realizado:

```typescript
interface DevolucionLog {
  tipo: "sede" | "proveedor";
  destinatario: string;           // nombre de sede o proveedor
  correos: string[];              // emails destinatarios
  motivo: string;
  ciudad?: string;                // solo proveedores
  numCajas?: number;              // solo proveedores
  proveedorNombre?: string;       // solo sedes (nombre libre del proveedor)
  nombreArchivo: string;
  asunto: string;                 // asunto del email enviado
  enviadoPor: string;             // email del usuario
  enviadoPorNombre: string;       // displayName del usuario
  estado: "enviado" | "error";
  detalle?: string;               // mensaje de error si falló
  creadoEn: Timestamp;            // serverTimestamp()
}
```

### Frontend — Tab "Historial"

**Ubicación:** Tercer tab en `Devoluciones.tsx`

**Archivo nuevo:** `devoluciones/HistorialTab.tsx`

**Funcionalidad:**
- Consulta en tiempo real con `onSnapshot` sobre `devoluciones_log` ordenado por `creadoEn` desc
- Tabla con columnas: Fecha, Tipo (badge sede/proveedor), Destinatario, Motivo, Estado (badge), Enviado por
- Filtros: por tipo (sede/proveedor), por estado (enviado/error)
- Límite inicial: últimos 50 registros

**Lógica de escritura:**
- Después de cada envío exitoso o fallido en SedesTab/ProveedoresTab, el frontend escribe un documento a `devoluciones_log` usando `addDoc` con `serverTimestamp()`
- Se usa el contexto de Auth para obtener email y displayName del usuario

**Archivos nuevos/modificados:**
- `devoluciones/HistorialTab.tsx` — nuevo componente
- `devoluciones/hooks.ts` — agregar `useDevolucionesLog()` hook con onSnapshot
- `Devoluciones.tsx` — agregar tercer tab "Historial"
- `SedesTab.tsx` — agregar escritura a Firestore en onSuccess/onError
- `ProveedoresTab.tsx` — agregar escritura a Firestore en onSuccess/onError

---

## Plan de ejecución con agentes

### Ola 1 — Migración base (2 agentes en paralelo)

**Agente Backend:**
1. Crear `backend/routers/devoluciones.py` con constantes + 3 endpoints
2. Registrar router en `backend/main.py`

**Agente Frontend:**
1. Crear `src/pages/devoluciones/types.ts`
2. Crear `src/pages/devoluciones/api.ts`
3. Crear `src/pages/devoluciones/hooks.ts`
4. Crear `src/pages/devoluciones/SedesTab.tsx`
5. Crear `src/pages/devoluciones/ProveedoresTab.tsx`
6. Crear `src/pages/Devoluciones.tsx`
7. Modificar `App.tsx` — lazy import + ruta
8. Modificar `src/lib/pages.ts` — PAGE_REGISTRY
9. Modificar `src/components/Layout.tsx` — workflowSubItems + import icon
10. Modificar `src/hooks/useNavigationPermissions.ts` — WORKFLOW_SUB_PATHS

### Ola 1.5 — Revisión de migración base (1 agente revisor)

**Agente Revisor Migración:**
1. Verificar que el backend tiene los 3 endpoints correctos con validaciones
2. Verificar que todos los imports frontend son correctos y no hay ciclos
3. Verificar que los tipos coinciden entre frontend y backend
4. Verificar que la ruta `/devoluciones` está en App.tsx, pages.ts, Layout.tsx y WORKFLOW_SUB_PATHS
5. Verificar que los templates HTML son idénticos al original
6. Verificar que los ~130 proveedores están completos en el backend
7. Verificar textos en español, soporte dark/light mode
8. Ejecutar `npm run build` para confirmar que compila sin errores
9. Ejecutar `npm run lint` para verificar que no hay errores de ESLint
10. Reportar lista de issues encontrados y corregirlos

### Ola 2 — Historial de envíos (1 agente)

**Agente Historial:**
1. Crear `src/pages/devoluciones/HistorialTab.tsx` con tabla + filtros + onSnapshot
2. Modificar `src/pages/devoluciones/hooks.ts` — agregar useDevolucionesLog
3. Modificar `src/pages/Devoluciones.tsx` — agregar tab Historial
4. Modificar `SedesTab.tsx` — escritura a Firestore post-envío
5. Modificar `ProveedoresTab.tsx` — escritura a Firestore post-envío

### Ola 2.5 — Revisión de historial (1 agente revisor)

**Agente Revisor Historial:**
1. Verificar que la estructura del documento Firestore es correcta
2. Verificar que onSnapshot se desuscribe correctamente en cleanup
3. Verificar que la escritura ocurre tanto en éxito como en error
4. Verificar que los filtros funcionan correctamente
5. Ejecutar `npm run build` + `npm run lint`
6. Reportar y corregir issues

### Ola 3 — Revisión final integral (1 agente especializado)

**Agente Revisor Final:**
1. Leer TODOS los archivos creados/modificados y verificar consistencia
2. Verificar que NO se rompió ningún módulo existente (imports de Layout, App, pages, permissions)
3. Ejecutar `npm run build` — debe compilar limpio
4. Ejecutar `npm run lint` — debe pasar sin errores
5. Verificar orden de imports según convención del proyecto
6. Verificar que no hay hardcoded strings en inglés en la UI
7. Verificar soporte dark/light mode en todos los componentes nuevos
8. Verificar que el select de proveedores es usable con ~130 opciones
9. Verificar que no se introdujeron vulnerabilidades (XSS en templates HTML, etc.)
10. Generar reporte final de estado: OK o lista de issues pendientes
