/**
 * Packager / window icons live in git and are edited intentionally:
 * - build/icon.png   — macOS + mica title bar (opaque black canvas)
 * - build/icon.ico   — Windows/Linux electron-builder
 * - public/favicon.ico — renderer + Windows taskbar
 *
 * public/spirit-agent-icon.png is the transparent UI brand mark; do NOT derive
 * packager icons from it during release — that strips the black background.
 *
 * Default (no flags): verify the three files exist.
 * --force: regenerate from spirit-agent-icon.png (dev only; needs review).
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

const PACKAGER_ICONS = [
  { label: 'macOS packager PNG', path: iconPngPath },
  { label: 'Windows/Linux ICO', path: iconIcoPath },
  { label: 'favicon.ico', path: faviconIcoPath },
];

const ICO_SIZES = [16, 32, 48, 256];
const force = process.argv.includes('--force');

function verifyPackagerIcons() {
  const missing = PACKAGER_ICONS.filter(({ path: filePath }) => !fs.existsSync(filePath));
  if (missing.length > 0) {
    const list = missing.map(({ label, path: filePath }) => `- ${label}: ${path.relative(desktopRoot, filePath)}`).join('\n');
    throw new Error(
      `Missing packager icon(s). Commit or restore these files under apps/desktop/:\n${list}\n`
      + 'To intentionally regenerate from public/spirit-agent-icon.png, run: npm run gen:icons -- --force',
    );
  }
  for (const { label, path: filePath } of PACKAGER_ICONS) {
    console.log(`OK ${label}: ${path.relative(desktopRoot, filePath)}`);
  }
}

async function regenerateFromUiSource() {
  if (!fs.existsSync(sourcePng)) {
    throw new Error(`Missing source PNG: ${sourcePng}`);
  }

  fs.mkdirSync(buildDir, { recursive: true });

  await sharp(sourcePng)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 255 } })
    .png()
    .toFile(iconPngPath);

  const source = await readPNG(iconPngPath);
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
  console.warn('Regenerated packager icons from UI source — review black canvas / logo sizing before commit.');
}

if (force) {
  await regenerateFromUiSource();
} else {
  verifyPackagerIcons();
}
