# Guía de Despliegue en GitHub Pages

Sigue estos pasos para subir tu proyecto a GitHub y desplegarlo gratuitamente usando GitHub Pages.

## 1. Preparar el Repositorio en GitHub

1.  Ve a [github.com](https://github.com) e inicia sesión.
2.  Haz clic en el botón **"New"** (o "Nuevo") para crear un nuevo repositorio.
3.  Ponle un nombre a tu repositorio (ej: `bukz-app`).
4.  Mantalo como **Público** (o Privado, pero Pages en privado requiere cuenta Pro).
5.  **NO** inicialices con README, .gitignore o License (ya los tienes).
6.  Haz clic en **"Create repository"**.

## 2. Instalar la herramienta de despliegue

Abre tu terminal en la carpeta del proyecto y ejecuta:

```bash
npm install gh-pages --save-dev
```

## 3. Configurar el proyecto

### Editar `package.json`

Abre el archivo `package.json` y agrega lo siguiente:

1.  Al principio del archivo, agrega la propiedad `homepage`:
    *   Reemplaza `TU_USUARIO` con tu usuario de GitHub.
    *   Reemplaza `NOMBRE_DEL_REPO` con el nombre que le diste a tu repositorio.

    ```json
    "homepage": "https://TU_USUARIO.github.io/NOMBRE_DEL_REPO",
    ```

2.  En la sección `"scripts"`, agrega los comandos `predeploy` y `deploy`:

    ```json
    "scripts": {
      // ... otros scripts existentes
      "predeploy": "npm run build",
      "deploy": "gh-pages -d dist"
    }
    ```

### Editar `vite.config.ts`

Abre `vite.config.ts` y agrega la propiedad `base`. Esto es crucial para que los enlaces funcionen bien.

```typescript
import { defineConfig } from "vite";
// ... otras importaciones

export default defineConfig(({ mode }) => ({
  // Agrega esto:
  base: "/NOMBRE_DEL_REPO/", 
  
  server: {
    // ... tu configuración actual
  },
  // ... resto de la configuración
}));
```
*Asegúrate de cambiar `/NOMBRE_DEL_REPO/` por el nombre real de tu repositorio, conservando las barras `/` al inicio y al final.*

## 4. Subir el código a GitHub

En tu terminal, ejecuta los siguientes comandos uno por uno:

```bash
# Inicializa git si no lo has hecho (si ya tienes git, omite este paso)
git init

# Agrega todos los archivos
git add .

# Haz el commit inicial
git commit -m "Primer commit: APLICACION BUKZ"

# Cambia la rama a main (recomendado)
git branch -M main

# Conecta tu repositorio local con el de GitHub
# REEMPLAZA LA URL con la de tu repositorio nuevo (la que te dio GitHub en el paso 1)
git remote add origin https://github.com/TU_USUARIO/NOMBRE_DEL_REPO.git

#ube los archivos
git push -u origin main
```

## 5. Desplegar la aplicación

Una vez subido el código, ejecuta el comando de despliegue que configuramos:

```bash
npm run deploy
```

Este comando creará una rama llamada `gh-pages` en tu repositorio y subirá allí la versión optimizada de tu aplicación.

## 6. Configurar GitHub Pages

1.  Ve a tu repositorio en GitHub.
2.  Haz clic en la pestaña **Settings** (Configuración).
3.  En el menú de la izquierda, busca y haz clic en **Pages**.
4.  En "Build and deployment" > "Source", asegúrate de que esté seleccionado **Deploy from a branch**.
5.  En "Branch", selecciona `gh-pages` y la carpeta `/ (root)`. (Normalmente esto se configura solo tras el `npm run deploy`, pero verifica).
6.  ¡Listo! En unos minutos verás un enlace en la parte superior de esa página (algo como `https://tu-usuario.github.io/nombre-repo/`) donde podrás ver tu aplicación funcionando.

---

## Solución de Problemas Comunes

*   **Página en blanco:** Verificar que la propiedad `base` en `vite.config.ts` coincida exactamente con el nombre de tu repositorio entre barras `/`.
*   **Imágenes rotas:** Asegúrate de importar las imágenes en tus archivos `.tsx` o referenciarlas correctamente desde la carpeta `public` usando la ruta base.
*   **Error 404 al recargar página:** GitHub Pages no soporta nativamente el enrutamiento de React (SPA) para rutas anidadas. Si te pasa esto, simplemente navega siempre desde la página de inicio.
