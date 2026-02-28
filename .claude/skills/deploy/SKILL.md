---
name: deploy
description: Build y deploy de BukzBrainv2 a GitHub Pages
disable-model-invocation: true
---

Ejecuta el proceso completo de deploy a GitHub Pages:

1. Corre `npm run lint` para verificar que no haya errores de linting
2. Corre `npm run build` para generar el build de producción
3. Verifica que el directorio `dist/` se generó correctamente
4. Verifica que `dist/404.html` existe (necesario para SPA routing en GitHub Pages)
5. Corre `npm run deploy` para publicar a GitHub Pages
6. Confirma que el deploy fue exitoso
7. Informa la URL: https://OperacionesBukz.github.io/BukzBrainv2/
