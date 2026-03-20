# Scrap Bukz — Design Spec

## Resumen

Nuevo modulo "Scrap Bukz" en BukzBrain que migra la funcionalidad de `bukz-metadata-scraper` (Streamlit) a la arquitectura existente: backend FastAPI en Hostinger + frontend React.

Dado un Excel/CSV con ISBNs, consulta 5 librerias en paralelo, fusiona los mejores metadatos y exporta un Excel enriquecido.

## Arquitectura

```
BukzBrain (React)                    Backend FastAPI (Hostinger/EasyPanel)
─────────────────                    ────────────────────────────────────
src/pages/scrap/                     /api/scrap/
  api.ts          ──── fetch ────►     health, enrich, status, download,
  hooks.ts                             cache/stats, cache/clear
  types.ts
  ScrapBukz.tsx                      scrapers/ engine/ utils/ cache/
  (componentes)                      (migrados desde bukz-metadata-scraper)
```

- Frontend y backend se comunican via HTTP (fetch nativo)
- Mismo API_BASE que Ingreso Mercancia
- Estado del servidor manejado con React Query (polling)

## Backend — Endpoints

| Endpoint | Metodo | Descripcion | Request | Response |
|----------|--------|-------------|---------|----------|
| `/api/scrap/health` | GET | Health check | — | `{status: "ok"}` |
| `/api/scrap/enrich` | POST | Sube archivo e inicia job | `multipart/form-data: file` + query: `delay` | `{job_id, total_isbns, invalid_isbns[], valid_count}` |
| `/api/scrap/status/{job_id}` | GET | Progreso del job | — | `{status, processed, total, logs[], error?}` |
| `/api/scrap/download/{job_id}` | GET | Descarga Excel resultado | — | Blob (xlsx) |
| `/api/scrap/cache/stats` | GET | Stats del cache | — | `{total_cached}` |
| `/api/scrap/cache/clear` | DELETE | Limpia cache | — | `{success: true}` |

### Gestion de Jobs

- Diccionario en memoria: `jobs: dict[str, ScrapJob]`
- Cada job: `{status: "processing"|"completed"|"error", total, processed, logs[], result_path, created_at}`
- Jobs se limpian automaticamente despues de 1 hora
- Se usa `BackgroundTasks` de FastAPI para ejecutar el scraping

### Flujo de enrich

1. Recibe archivo multipart
2. Lee con pandas, detecta columna ISBN (por nombre o patron 13 digitos)
3. Valida ISBNs (checksum ISBN-10/ISBN-13), separa validos de invalidos
4. Genera UUID como `job_id`, crea entrada en `jobs`
5. Responde inmediatamente con `{job_id, total_isbns, invalid_isbns, valid_count}`
6. En background: ejecuta `runner.run()` con callback que actualiza `jobs[job_id]`
7. Al completar: genera Excel en memoria, guarda en `/tmp/{job_id}.xlsx`, marca completed

### Scraping (migrado sin cambios funcionales)

**5 fuentes:**

| Fuente | Tipo | Prioridad |
|--------|------|-----------|
| Casa del Libro | REST API (Empathy) | 1 |
| Panamericana | VTEX API | 2 |
| Lerner | VTEX API | 3 |
| Tornamesa | HTML (BeautifulSoup) | 4 |
| Exlibris | HTML (BeautifulSoup) | 5 |

**Campos extraidos:** titulo, autor, editorial, anio, descripcion, categoria, portada_url, paginas, idioma, encuadernacion

**Merge:** Por campo — longest string (titulo, descripcion), priority-based (editorial, categoria, idioma, encuadernacion, portada_url), median (paginas), first valid (anio)

**Cache:** JSON en disco (`cache/isbn_cache.json`), mismo formato actual. ISBNs cacheados se saltan.

**Threading:** `ThreadPoolExecutor` con 10 workers, 5 requests paralelas por ISBN.

## Frontend — Modulo React

### Estructura de archivos

```
src/pages/scrap/
  api.ts                  → Fetch wrappers (mismo patron que ingreso/api.ts)
  types.ts                → API_BASE, interfaces, constantes
  hooks.ts                → React Query hooks (useEnrich, useJobStatus, etc.)
  ScrapBukz.tsx           → Pagina principal con el flujo completo
  FileUploadZone.tsx      → Zona de upload (reutiliza patron de ingreso)
  IsbnValidationSummary.tsx → Muestra validos/invalidos
  EnrichmentProgress.tsx  → Barra de progreso + logs en tiempo real
  ResultsTable.tsx        → Tabla de resultados con filtro
```

### Flujo de UI

1. **Upload:** Usuario sube CSV/Excel. Se muestra nombre del archivo y preview
2. **Validacion:** `POST /enrich` → muestra resumen de ISBNs validos/invalidos
3. **Progreso:** Polling cada 2s a `/status/{job_id}` → barra de progreso + logs
4. **Resultados:** Tabla con iconos de estado (completo/parcial/no encontrado) + stats
5. **Descarga:** Boton para descargar Excel enriquecido + CSV de no encontrados

### Estado (React Query)

| Hook | Endpoint | Config |
|------|----------|--------|
| `useEnrich()` | POST `/enrich` | mutation |
| `useJobStatus(jobId)` | GET `/status/{job_id}` | polling 2s, se detiene cuando status != "processing" |
| `useCacheStats()` | GET `/cache/stats` | staleTime: 5min |
| `useClearCache()` | DELETE `/cache/clear` | mutation, invalida cacheStats |

### Componentes UI

- shadcn/ui: Card, Button, Progress, Badge, Table, Alert
- Lucide icons para estados
- Soporte dark/light mode
- Textos en espanol

## Integracion con BukzBrain

- Ruta: `/scrap` en `App.tsx`
- Agregar a `navigation_permissions` en Firestore
- Icono en sidebar/navegacion

## Dependencias nuevas

- **Backend:** Ninguna nueva (requests, beautifulsoup4, pandas, openpyxl ya estan)
- **Frontend:** Ninguna nueva (usa shadcn/ui + React Query existentes)

## Fuera de alcance

- Agregar nuevas fuentes de scraping (futuro)
- Scraping por titulo (solo ISBN)
- Persistencia de jobs en base de datos (en memoria es suficiente)
- Autenticacion especifica para estos endpoints (usa la misma del backend)
