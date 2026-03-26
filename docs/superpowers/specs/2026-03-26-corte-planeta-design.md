# Corte Planeta — Spec de Diseño

## Resumen

Módulo de 3 fases para procesar el corte mensual de ventas de Grupo Editorial Planeta. Reemplaza el placeholder actual en `CortePlaneta.tsx`.

- **Fase 1 — Bodegas:** Limpieza de POS locations en el Excel de Shopify (frontend only)
- **Fase 2 — Descuentos:** Procesamiento de descuentos reutilizando backend existente
- **Fase 3 — Enviar Correo:** Envío del archivo final por email vía SMTP

## Arquitectura

**Enfoque híbrido (A):**
- Fase 1: 100% frontend — parseo y manipulación de Excel en el navegador
- Fase 2: Reutiliza endpoints existentes (`POST /api/cortes/process` y `POST /api/cortes/descuento`)
- Fase 3: Nuevo endpoint backend para envío de correo

**Estado:** Vive en el componente padre `CortePlaneta.tsx`. No hay persistencia en Firestore ni backend. El flujo de descargar/revisar/subir entre fases actúa como persistencia natural.

## Estructura de Archivos

### Frontend

```
src/pages/CortePlaneta.tsx                        → Página principal con stepper
src/pages/corte-planeta/
  PlanetaPhase1Bodegas.tsx                        → Fase 1: upload + mapeo
  PlanetaPhase2Descuentos.tsx                     → Fase 2: tipo descuento + procesamiento
  PlanetaPhase3Correo.tsx                         → Fase 3: configurar y enviar correo
  PlanetaStepIndicator.tsx                        → Indicador visual de pasos
  types.ts                                         → Tipos compartidos
  constants.ts                                     → Mapeos de bodegas, correos default
```

### Backend

```
backend/routers/corte_planeta.py                  → Router con endpoint de envío de correo
```

## Fase 1 — Bodegas

### Flujo

1. Usuario sube Excel (.xlsx) de ventas Shopify
2. Se parsea en el navegador (librería xlsx/SheetJS)
3. Se aplican mapeos automáticos de POS location name:

| POS Location Original       | Mapeado a          |
|-----------------------------|---------------------|
| Bukz Las Lomas              | Bukz Medellín       |
| Bukz Museo de Antioquia     | Bukz Medellín       |
| Bukz Viva Envigado          | Bukz Medellín       |
| Bukz Bogota 109             | Bukz Bogotá         |
| Reserva B2B                 | Bukz B2B Medellín   |

4. Locations no reconocidas se muestran en pantalla con un select por cada una (opciones: Bukz Medellín, Bukz Bogotá, Bukz B2B Medellín)
5. Se muestra resumen (filas procesadas, bodegas asignadas)
6. Botón para descargar Excel limpio

### Configuración de Mapeos

- Panel colapsable en la misma página para ver/agregar/eliminar mapeos permanentes
- Los mapeos custom se guardan en `localStorage` (key: `planeta-bodega-mappings`)
- Los mapeos de `constants.ts` son los defaults, los de `localStorage` se fusionan con prioridad

### Columnas del Excel

| Columna               | Tipo    |
|------------------------|---------|
| Order name             | string  |
| Product variant SKU    | number  |
| Product title          | string  |
| Product vendor         | string  |
| POS location name      | string  |
| Sales channel          | string  |
| Discount name          | string  |
| Net items sold         | number  |

## Fase 2 — Descuentos

### Flujo

1. Usuario sube el Excel limpio (descargado y revisado de Fase 1)
2. Elige tipo de descuento:
   - **3x2** → Envía a `POST /api/cortes/process`
   - **% Descuento** → Envía a `POST /api/cortes/descuento` con el % esperado
   - **Sin descuento este mes** → Salta directo a Fase 3
3. Si eligió 3x2 o %, se muestran resultados en tabla (reutilizando componentes `CortesResultTable` / `DescuentoResultTable` existentes)
4. Botón para descargar Excel procesado
5. Botón para avanzar a Fase 3

### Reutilización

- Endpoints backend: sin cambios, se usan tal cual
- Componentes de tabla: se importan directamente de `src/pages/operations/cortes/`
- API calls: se reutilizan de `src/pages/operations/cortes/api.ts`

## Fase 3 — Enviar Correo

### Flujo

1. Usuario sube el archivo final (Excel definitivo)
2. Configura destinatarios (lista editable):
   - Default: `mromero@planeta.com.co`, `ovargas@planeta.com.co`
   - Puede agregar, eliminar o editar correos
3. Configura fechas del período (date pickers):
   - Fecha inicio: default 25 del mes anterior (auto-calculado)
   - Fecha fin: default 24 del mes actual (auto-calculado)
   - Editables para períodos no estándar
4. Asunto auto-generado (no editable):
   - Formato: `Corte [Mes inicio] a [Mes fin] - [Año] - Grupo Editorial Planeta`
   - Ejemplo: `Corte Enero a Febrero - 2026 - Grupo Editorial Planeta`
5. Vista previa del cuerpo del correo con las fechas seleccionadas
6. Botón de enviar

### Cuerpo del Correo (plantilla)

```
Buenas tardes, espero que se encuentren muy bien.

Adjunto envío el corte correspondiente al período comprendido entre el [fecha inicio] y el [fecha fin].

En el archivo podrán encontrar el detalle de:

Títulos vendidos por ciudad
Cantidades correspondientes

Quedo atento a cualquier inquietud, comentario o solicitud de información adicional.

Cordial saludo,
```

La firma será la del correo operaciones@bukz.co (configurada en Gmail).

### Backend — Nuevo Endpoint

**Router:** `backend/routers/corte_planeta.py`

**Endpoint:** `POST /api/corte-planeta/enviar-correo`

**Recibe (multipart/form-data):**
- `file`: Archivo Excel adjunto
- `destinatarios`: JSON string con lista de emails
- `fecha_inicio`: String con fecha de inicio del período (ej: "25 de enero")
- `fecha_fin`: String con fecha de fin del período (ej: "24 de febrero")
- `anio`: Año del corte

**Usa:** `send_email()` de `email_service.py` existente

**Responde:** `{ "success": true, "message": "Correo enviado exitosamente" }` o error

### Registro del Router

Agregar en `backend/main.py`:
```python
from routers import corte_planeta
app.include_router(corte_planeta.router)
```

## Componente Stepper

`PlanetaStepIndicator.tsx` muestra 3 pasos con estado visual:
- **Completado** (check verde)
- **Activo** (resaltado con color primario)
- **Pendiente** (gris)

El usuario puede hacer clic en un paso completado para retroceder. No puede avanzar sin completar el paso actual.

## Dependencias

- **xlsx (SheetJS):** Para parsear/generar Excel en frontend. Verificar si ya está instalada; si no, pedir confirmación antes de agregar.
- **Backend:** No requiere dependencias nuevas.

## Soporte Dark/Light Mode

Todos los componentes nuevos deben usar clases de Tailwind/shadcn que respetan el tema (ej: `text-foreground`, `bg-card`, `border-border`).
