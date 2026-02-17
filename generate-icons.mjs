// Script para generar iconos PWA
// Ejecutar con: node generate-icons.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función para crear un SVG básico con el logo de Bukz
function createSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <!-- Fondo negro -->
  <rect width="${size}" height="${size}" fill="#000000"/>

  <!-- Texto BukzBrain -->
  <text
    x="50%"
    y="50%"
    dominant-baseline="middle"
    text-anchor="middle"
    fill="#FFFFFF"
    font-family="Arial, sans-serif"
    font-weight="bold"
    font-size="${size * 0.15}">
    BUKZ
  </text>
  <text
    x="50%"
    y="70%"
    dominant-baseline="middle"
    text-anchor="middle"
    fill="#FFFFFF"
    font-family="Arial, sans-serif"
    font-size="${size * 0.1}">
    BRAIN
  </text>
</svg>`;
}

// Tamaños de iconos necesarios
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const iconsDir = path.join(__dirname, 'public', 'icons');

// Crear directorio si no existe
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generar SVGs
sizes.forEach(size => {
  const svg = createSVG(size);
  const filename = `icon-${size}x${size}.svg`;
  fs.writeFileSync(path.join(iconsDir, filename), svg);
  console.log(`✓ Creado ${filename}`);
});

console.log('\n✅ SVGs creados exitosamente!');
console.log('\n📝 IMPORTANTE: Para tener iconos PNG optimizados para iOS:');
console.log('1. Visita: https://realfavicongenerator.net/');
console.log('2. Sube tu logo o usa los SVG generados');
console.log('3. Descarga el paquete completo de iconos');
console.log('4. Reemplaza los archivos en la carpeta public/icons/');
console.log('\nAlternativamente, puedes usar https://www.pwabuilder.com/ para generar iconos.');
