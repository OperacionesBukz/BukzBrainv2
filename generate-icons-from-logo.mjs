// Script para generar iconos PWA desde el logo de BUKZ
// Ejecutar con: node generate-icons-from-logo.mjs

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, 'public', 'icons');
const logoPath = path.join(__dirname, 'src', 'assets', 'LOGO_BUKZ.png');

async function generateIcons() {
  console.log('🔄 Generando iconos desde el logo de BUKZ...\n');

  // Verificar que el logo existe
  if (!fs.existsSync(logoPath)) {
    console.error('❌ Logo no encontrado en:', logoPath);
    return;
  }

  // Crear directorio si no existe
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  for (const size of sizes) {
    try {
      // Leer el logo original
      const logoBuffer = fs.readFileSync(logoPath);

      // Crear canvas cuadrado con fondo negro
      const canvas = await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 1 }
        }
      }).png().toBuffer();

      // Calcular dimensiones del logo (80% del tamaño total para dejar margen)
      const logoSize = Math.floor(size * 0.8);
      const offset = Math.floor((size - logoSize) / 2);

      // Redimensionar y superponer el logo centrado
      const icon = await sharp(canvas)
        .composite([
          {
            input: await sharp(logoBuffer)
              .resize(logoSize, logoSize, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
              })
              .toBuffer(),
            top: offset,
            left: offset
          }
        ])
        .png()
        .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));

      console.log(`✓ Creado icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`✗ Error creando icon-${size}x${size}.png:`, error.message);
    }
  }

  console.log('\n✅ Iconos generados exitosamente con el logo de BUKZ!');
}

generateIcons();
