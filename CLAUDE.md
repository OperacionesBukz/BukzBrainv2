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
