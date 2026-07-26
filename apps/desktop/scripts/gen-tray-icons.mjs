/**
 * Bake monochrome Spirit cursor glyphs for menu bar / tray.
 * Source path matches `SPIRIT_GLASS_LOGO_PATH` in spirit-glass-logo.tsx.
 *
 * Outputs (transparent + black fill; macOS Template naming):
 * - build/tray/iconTemplate.png (22)
 * - build/tray/iconTemplate@2x.png (44, macOS Retina)
 * - build/tray/iconTemplate-32.png (32, Windows tray)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const outDir = path.join(desktopRoot, 'build', 'tray');

/** Keep in sync with apps/desktop/src/components/spirit-glass-logo.tsx */
const SPIRIT_GLASS_LOGO_PATH =
  'M0 0L141.409 69.4512L70.7825 78.2408C61.5778 79.3863 53.5378 85.016 49.3132 93.2737L16.8979 156.635L0 0Z';
const VIEWBOX = { width: 142, height: 157 };

function buildSquareSvg(size) {
  const padRatio = 0.82;
  const scale = (size * padRatio) / Math.max(VIEWBOX.width, VIEWBOX.height);
  const drawnW = VIEWBOX.width * scale;
  const drawnH = VIEWBOX.height * scale;
  const offsetX = (size - drawnW) / 2;
  const offsetY = (size - drawnH) / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${offsetX.toFixed(3)},${offsetY.toFixed(3)}) scale(${scale.toFixed(6)})">
    <path d="${SPIRIT_GLASS_LOGO_PATH}" fill="#000000"/>
  </g>
</svg>`;
}

async function writePng(fileName, size) {
  const svg = Buffer.from(buildSquareSvg(size), 'utf8');
  const outPath = path.join(outDir, fileName);
  await sharp(svg).png().toFile(outPath);
  console.log(`Wrote ${path.relative(desktopRoot, outPath)} (${size}x${size})`);
}

fs.mkdirSync(outDir, { recursive: true });
await writePng('iconTemplate.png', 22);
await writePng('iconTemplate@2x.png', 44);
await writePng('iconTemplate-32.png', 32);
