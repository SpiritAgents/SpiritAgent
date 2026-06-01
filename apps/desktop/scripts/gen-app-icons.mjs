/**
 * Generate electron-builder icons under build/ from brand PNG sources.
 * - build/icon.png (512x512) for macOS packaging
 * - build/icon.ico (16–256) for Windows/Linux; avoids oversized 512 BMP entries
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { imagesToIco } from 'png-to-ico';
import { readPNG, resize } from 'png-to-ico/lib/png.js';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const buildDir = path.join(desktopRoot, 'build');
const sourcePng = path.join(desktopRoot, 'public', 'spirit-agent-icon.png');
const iconPngPath = path.join(buildDir, 'icon.png');
const iconIcoPath = path.join(buildDir, 'icon.ico');
const faviconIcoPath = path.join(desktopRoot, 'public', 'favicon.ico');

const ICO_SIZES = [16, 32, 48, 256];

async function main() {
  if (!fs.existsSync(sourcePng)) {
    throw new Error(`Missing source PNG: ${sourcePng}`);
  }

  fs.mkdirSync(buildDir, { recursive: true });

  await sharp(sourcePng)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(iconPngPath);

  const source = await readPNG(sourcePng);
  const images = await Promise.all(
    ICO_SIZES.map((size) => resize(source, size, size)),
  );
  const ico = await imagesToIco(images);
  fs.writeFileSync(iconIcoPath, ico);
  fs.writeFileSync(faviconIcoPath, ico);

  const meta = await sharp(iconPngPath).metadata();
  console.log(`Wrote ${path.relative(desktopRoot, iconPngPath)} (${meta.width}x${meta.height})`);
  console.log(`Wrote ${path.relative(desktopRoot, iconIcoPath)} (${ICO_SIZES.at(-1)}px max)`);
  console.log(`Synced ${path.relative(desktopRoot, faviconIcoPath)}`);
}

await main();
