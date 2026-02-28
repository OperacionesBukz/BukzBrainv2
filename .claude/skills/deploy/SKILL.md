---
name: deploy
description: Build y deploy de BukzBrainv2 a GitHub Pages
disable-model-invocation: true
---

Ejecuta el proceso completo de commit, push y deploy a GitHub Pages:

1. Corre `git status` y `git diff --stat` para ver los cambios pendientes
2. Si hay cambios, corre `git add` con los archivos relevantes (nunca .env ni archivos sensibles)
3. Crea un commit con un mensaje descriptivo siguiendo el estilo del proyecto (feat/fix/refactor) y añadiendo `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
4. Corre `git push origin main` para subir los cambios al repositorio
5. Corre `npm run lint` para verificar que no haya errores de linting
6. Corre `npm run build` para generar el build de producción
7. Verifica que el directorio `dist/` se generó correctamente
8. Verifica que `dist/404.html` existe (necesario para SPA routing en GitHub Pages)
9. Corre `npm run deploy` para publicar a GitHub Pages
10. Confirma que el deploy fue exitoso
11. Informa la URL: https://OperacionesBukz.github.io/BukzBrainv2/
