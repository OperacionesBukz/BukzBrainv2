---
name: new-collection
description: Agregar una nueva colección de Firestore con reglas de seguridad
disable-model-invocation: true
---

Agrega una nueva colección de Firestore llamada $ARGUMENTS.

Sigue estos pasos:

1. **Definir la interfaz TypeScript** para los documentos de la colección en el archivo donde se va a usar

2. **Crear el hook de acceso a datos** en `src/hooks/`:
   - Usar `onSnapshot()` para lectura en tiempo real
   - Usar `addDoc()`, `updateDoc()`, `deleteDoc()` para mutaciones
   - Usar `serverTimestamp()` en campos de fecha
   - Importar `db` desde `@/lib/firebase`

3. **Actualizar reglas de Firestore** en `firestore.rules`:
   - IMPORTANTE: Mostrar las reglas propuestas al usuario y esperar confirmación antes de modificar
   - Seguir el patrón existente usando las funciones helper: `isAuthenticated()`, `isAdmin()`, `isOwner()`
   - Definir permisos de read/write apropiados

4. **Verificar**:
   - Correr `npm run build` para verificar que compila
   - Validar las reglas con Firebase si está disponible
