---
name: new-page
description: Crear una nueva página siguiendo los patrones del proyecto
---

Crea una nueva página para BukzBrainv2 llamada $ARGUMENTS.

Sigue estos pasos:

1. **Crear el componente de página** en `src/pages/NombrePagina.tsx`:
   - Componente funcional con TypeScript
   - Usar shadcn/ui para elementos de UI (`@/components/ui/...`)
   - Usar `cn()` de `@/lib/utils` para clases condicionales
   - Usar `useAuth()` de `@/contexts/AuthContext` si necesita datos del usuario
   - Soportar dark/light mode con clases de Tailwind
   - Todo texto en español

2. **Registrar la ruta** en `src/App.tsx`:
   - Agregar import del componente
   - Agregar `<Route>` dentro del layout protegido
   - Seguir el patrón de rutas existente

3. **Agregar navegación** en `src/components/Layout.tsx`:
   - Agregar entrada en el array de navegación con icono de Lucide
   - Usar el componente `NavLink` existente

4. **Verificar**:
   - Correr `npm run build` para verificar que compila
   - Confirmar que la página es accesible en la ruta configurada
