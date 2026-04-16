# BukzBrainv2

Sistema operativo interno de Bukz. SPA en React + TypeScript desplegada en GitHub Pages con Firebase como backend.

## Stack

- React 18 + TypeScript + Vite (SWC)
- UI: shadcn/ui + Tailwind CSS + Lucide icons
- State: React Context (auth), TanStack React Query (server state)
- Routing: React Router v6 (basename: `/BukzBrainv2`)
- Backend: Firebase (Auth, Firestore, Storage)
- Idioma de la UI: **Español** (todo texto visible debe estar en español)

## Estructura del proyecto

```
src/
  components/ui/   → shadcn/ui (NO modificar directamente, usar shadcn CLI)
  components/      → Layout, GlobalSearch, ThemeProvider, ThemeToggle, NavLink
  contexts/        → AuthContext (user, role, isAdmin)
  hooks/           → useNavigationPermissions, use-mobile, use-toast
  lib/firebase.ts  → Inicialización Firebase
  lib/utils.ts     → cn() para clases Tailwind
  pages/           → Páginas de la app (Dashboard, Tasks, Operations, etc.)
  test/            → Tests con Vitest
```

## Comandos

```bash
npm run dev        # Dev server (puerto 8080)
npm run build      # Build producción
npm run deploy     # Build + deploy a GitHub Pages
npm run lint       # ESLint
npm run test       # Vitest (single run)
```

## Patrones de código

### Componentes
- Funcionales con hooks, nunca clases
- Props tipadas con `interface` al inicio del archivo
- Importar UI de `@/components/ui/...`
- Usar `cn()` de `@/lib/utils` para clases condicionales

### Firebase / Firestore
- Importar `db` desde `@/lib/firebase`
- Usar `onSnapshot()` para datos en tiempo real
- Usar `serverTimestamp()` en creación/actualización
- Colecciones: `users`, `tasks`, `user_tasks`, `leave_requests`, `products`, `product_categories`, `bookstore_requests`, `navigation_permissions`

### Orden de imports
1. React y librerías externas
2. Componentes (`@/components/...`)
3. Hooks (`@/hooks/...`)
4. Utilidades y Firebase (`@/lib/...`)
5. Contexts (`@/contexts/...`)

### Naming
- Componentes/Páginas: `PascalCase.tsx`
- Hooks: `use-kebab-case.ts` o `useCamelCase.ts`
- Funciones: `camelCase`

## Reglas de negocio

- **Roles**: `admin` y usuario regular. Se determina por campo `role` en colección `users`
- **Auth**: Email/password con Firebase Auth. Sesiones expiran a los 30 días
- **Permisos de navegación**: Colección `navigation_permissions` controla qué páginas ve cada usuario
- **Temas**: Light y dark mode via `next-themes`. Colores primarios: amarillo `#FFED4E`

## Reglas importantes

- NUNCA cambiar el idioma de la UI a inglés
- NUNCA modificar archivos en `src/components/ui/` directamente (son de shadcn)
- NUNCA commitear archivos `.env`
- NO modificar `firestore.rules` sin confirmación explícita del usuario
- NO agregar dependencias nuevas sin confirmar primero
- Al crear páginas nuevas, registrar la ruta en `App.tsx` y agregar a `navigation_permissions`
- Mantener soporte para dark/light mode en todo componente nuevo
- Base path de GitHub Pages: `/BukzBrainv2/`

## Testing

- Framework: Vitest + React Testing Library
- Comando para un test: `npx vitest run src/test/example.test.ts`
- Siempre correr tests después de cambios significativos

## Deploy

- GitHub Pages via `gh-pages` package
- `npm run deploy` ejecuta build + push a branch `gh-pages`
- El plugin `ghPages404Plugin` copia `index.html` a `404.html` para SPA routing

---

## Arquitectura general

```
GitHub Pages (React SPA)  ←→  EasyPanel/FastAPI (backend)  ←→  Firebase (Auth, Firestore, Storage)
                                      ↕
                               Shopify Admin API
```

**Regla de decisión — qué va dónde:**
- Shopify, scraping, AI proxy, Excel, email → backend FastAPI
- Users, tasks, permisos, solicitudes, datos internos → Firebase directo desde frontend

**URLs:**
- Frontend: `https://operacionesbukz.github.io/BukzBrainv2/`
- Backend: `https://operaciones-bkz-panel-operaciones.lyr10r.easypanel.host`
- `API_BASE` definido en `src/pages/ingreso/types.ts` (source of truth)

## Backend (FastAPI)

- Ubicación: `backend/` — Python 3.12, Uvicorn, Docker en EasyPanel
- Entry point: `backend/main.py` (app + CORS + registro de routers)
- Config: `backend/config.py` — lee env vars (NUNCA hardcodear credenciales)
- Auth: `verify_firebase_token` como dependencia global (excepto webhooks y transfers)
- Startup: `lifespan` inicializa PostgreSQL + scheduler automático

### Mapa de routers (24)

| Prefijo | Archivo | Función |
|---|---|---|
| `/api/ingreso` | `ingreso.py` | Búsqueda productos Shopify, inventario, Excel upload/download |
| `/api/scrap` | `scrap.py` | Enriquecimiento metadata libros (job async + polling) |
| `/api/reposiciones` | `reposiciones.py` | Bulk Ops Shopify: inventario y ventas |
| `/api/dead-stock` | `dead_stock.py` | Stock muerto vía Bulk Operations |
| `/api/inventory-turnover` | `inventory_turnover.py` | Análisis de rotación |
| `/api/cortes` | `cortes.py` | Reportes de corte editoriales |
| `/api/envio-cortes` | `envio_cortes.py` | Envío de cortes por email |
| `/api/corte-planeta` | `corte_planeta.py` | Corte Planeta |
| `/api/corte-museo` | `corte_museo.py` | Corte Museo |
| `/api/devoluciones` | `devoluciones.py` | Emails de devolución a sedes/proveedores |
| `/api/pedidos` | `pedidos.py` | Gestión de pedidos |
| `/api/celesa` | `celesa.py` | Sync dropshipping con Azeta/Matrixify |
| `/api/celesa-sync` | `celesa_sync.py` | Sync órdenes Celesa |
| `/api/conciliacion-ferias` | `conciliacion_ferias.py` | Conciliación inventario ferias |
| `/api/gift-cards` | `gift_cards.py` | Gift cards |
| `/api/suppliers` | `suppliers.py` | Catálogo de proveedores |
| `/api/email` | `email.py` | Utilidad de email |
| `/api/search` | `search.py` | Búsqueda cross-module |
| `/agent/chat` | `agent.py` | Proxy LLM (Gemini→Groq→OpenRouter→Cerebras) |
| `/api/commands` | `agent_commands.py` | Slash commands para chat |
| `/api/transfers` | `transfers.py` | Transferencias Shopify (SIN auth) |
| `/api/webhooks` | `webhooks.py` | Webhooks Shopify (HMAC, SIN auth Firebase) |

### Servicios compartidos (`backend/services/`)

| Archivo | Función |
|---|---|
| `shopify_service.py` | Cliente Shopify con `ShopifyThrottler`, batching, GraphQL helpers |
| `firebase_service.py` | Firebase Admin SDK — `get_firestore_db()` para escrituras server-side |
| `database.py` | PostgreSQL — cache de inventario/ventas |
| `email_service.py` | SMTP Gmail para envío de reportes |
| `orders_service.py` | Lógica de pedidos |
| `reposicion_service.py` | Lógica de reposición |
| `scheduler_service.py` | APScheduler — refresca inventario cada 4h, ventas cada ~20h |
| `celesa_common.py` | Utilidades compartidas Celesa |
| `scrap/` | Motor de scraping (9 scrapers, cache SQLite, merger) |

### Patrones backend

- **Jobs async**: `threading.Lock()` + `dict` en memoria + `threading.Thread(daemon=True)`. Estados: `processing → completed | error`. TTL 1h con auto-cleanup
- **Error handling**: siempre `raise HTTPException(status_code=N, detail="mensaje en español")`
- **Shopify**: siempre vía `shopify_service.py` (nunca llamar API directo desde routers)
- **Config**: `from config import settings` para env vars
- **Excel**: `pd.read_excel(BytesIO(content))` entrada, `StreamingResponse(BytesIO)` salida

## Contratos frontend ↔ backend

**Upload Excel:**
```
Frontend: FormData { file } → resilientFetch POST
Backend:  UploadFile = File(...) → await file.read() → pd.read_excel(BytesIO(content))
Retorno:  StreamingResponse(BytesIO, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
Frontend: response.blob() → downloadBlob(blob, "nombre.xlsx")
```

**Job async (scrap, dead stock, celesa):**
```
POST /start → { job_id }
Poll GET /status/{job_id} cada 2s (refetchInterval en React Query)
→ { status: "processing"|"completed"|"error", processed, total }
GET /download/{job_id} → blob
```

**Error propagation:**
```
Backend:  raise HTTPException(status_code=422, detail="mensaje")
Frontend: handleResponse<T>() → throw Error(body.detail) → toast/Alert
```

**CORS**: `CORS_ORIGINS` env var en EasyPanel (comma-separated)

## Sistema de navegación

**Agregar página nueva — checklist:**
1. Lazy import + `<Route>` en `src/App.tsx`
2. Agregar a `PAGE_REGISTRY` en `src/lib/pages.ts` (path, label, description, icon, workspace)
3. NO tocar `Layout.tsx` — el menú se genera automáticamente desde el registry

**Para páginas bajo Workflow**, 3 pasos adicionales:
1. Agregar ruta a `WORKFLOW_SUB_PATHS` en `src/hooks/useNavigationPermissions.ts`
2. Agregar con `true` en Firestore `navigation_permissions/_default`
3. Agregar con `true` en Firestore `navigation_permissions/operaciones@bukz.co`

**Sub-rutas agrupadas:**
- Workflow: `/ingreso`, `/crear-productos`, `/actualizar-productos`, `/scrap`, `/cortes`, `/envio-cortes`, `/devoluciones`, `/gift-cards`, `/conciliacion-ferias`, `/stock-muerto`
- Reposiciones: `/reposiciones`, `/reposicion`, `/pedidos`, `/novedades`, `/rotacion`
- Celesa: `/celesa-seguimiento`, `/celesa-actualizacion`

## Reglas no negociables

### Deploy
- Frontend: `npm run deploy`. Siempre `commit + push` ANTES de deploy
- Backend: push al repo → redeploy manual en EasyPanel
- **NUNCA** usar branches ni PRs — commit directo a `main`
- **Leer TODOS los archivos modificados** antes de declarar listo — `tsc`/`build` no detectan bugs de runtime

### UI/UX
- Todo texto de UI en español, siempre
- **Sin animaciones decorativas** (breathing, pulsing en elementos estáticos) — solo feedback funcional
- **Toda tabla** debe tener contenedor con overflow: `<div className="overflow-x-auto"><Table /></div>` o `<ScrollArea>` con `<ScrollBar orientation="horizontal" />`
- Dark/light mode obligatorio en todo componente nuevo

### Datos
- NUNCA modificar `firestore.rules` sin confirmación explícita del usuario
- NUNCA commitear archivos `.env`
- Resolver errores de permisos Firestore ANTES de deploy — fallan silenciosamente en runtime

### Post-implementación
- Siempre preguntar: **"¿Desplegar o hay más cambios?"**
- Verificar que backend retorna la shape que frontend espera (y viceversa) antes de cerrar
