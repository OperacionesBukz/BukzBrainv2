// Script para convertir SVGs a PNGs
// Ejecutar con: node convert-svg-to-png.mjs

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, 'public', 'icons');

async function convertSvgToPng() {
  console.log('🔄 Convirtiendo SVGs a PNGs...\n');

  for (const size of sizes) {
    const svgPath = path.join(iconsDir, `icon-${size}x${size}.svg`);
    const pngPath = path.join(iconsDir, `icon-${size}x${size}.png`);

    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(pngPath);

      console.log(`✓ Convertido icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`✗ Error convirtiendo icon-${size}x${size}.png:`, error.message);
    }
  }

  console.log('\n✅ Conversión completada!');
}

convertSvgToPng();
