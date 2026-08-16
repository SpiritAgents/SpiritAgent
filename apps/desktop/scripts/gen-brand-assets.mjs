/**
 * 从 @spiritagent/brand 的 SVG 源生成全部打包/运行时图标（生成物不入库，见 .gitignore）：
 * - build/icon.png (512)          — macOS 打包标 + Windows 窗口/任务栏图标；源 logo-dark.svg，天然不透明黑画布
 * - build/icon.ico (16/32/48/256) — Windows/Linux electron-builder；源同上
 * - build/tray/iconTemplate.png (22) / @2x (44) / -32 (32) — macOS Template + Windows 托盘；源 glyph 常量
 * - build/background.png (540x408) / @2x (1080x816) — DMG 窗口背景；源 dmg-background.svg（540x380）
 *
 * DMG 窗口高度含 Finder 标题栏（约 28pt），背景图底部须补 28px 白边，
 * 与 electron-builder.yml 的 dmg 注释一致；改设计稿时同步调整 BG_BOTTOM_PAD。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SPIRIT_GLASS_LOGO_PATH, SPIRIT_GLASS_LOGO_VIEWBOX } from "@spiritagent/brand/src/constants.js";
import { imagesToIco } from "png-to-ico";
import { readPNG, resize } from "png-to-ico/lib/png.js";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const buildDir = path.join(desktopRoot, "build");
const trayDir = path.join(buildDir, "tray");

const brandAssetsDir = path.join(desktopRoot, "..", "..", "packages", "brand", "assets");
const logoDarkSvg = path.join(brandAssetsDir, "logo-dark.svg");
const dmgBackgroundSvg = path.join(brandAssetsDir, "dmg-background.svg");

const ICO_SIZES = [16, 32, 48, 256];
/** DMG 背景底部白边：内容区 380pt + 28pt = 窗口 408pt */
const BG_BOTTOM_PAD = 28;

/** 托盘标：图案按 0.82 内边距缩放居中（与原 gen-tray-icons 一致） */
function buildTraySquareSvg(size) {
  const padRatio = 0.82;
  const scale =
    (size * padRatio) / Math.max(SPIRIT_GLASS_LOGO_VIEWBOX.width, SPIRIT_GLASS_LOGO_VIEWBOX.height);
  const drawnW = SPIRIT_GLASS_LOGO_VIEWBOX.width * scale;
  const drawnH = SPIRIT_GLASS_LOGO_VIEWBOX.height * scale;
  const offsetX = (size - drawnW) / 2;
  const offsetY = (size - drawnH) / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${offsetX.toFixed(3)},${offsetY.toFixed(3)}) scale(${scale.toFixed(6)})">
    <path d="${SPIRIT_GLASS_LOGO_PATH}" fill="#000000"/>
  </g>
</svg>`;
}

async function genPackagerIcons() {
  const iconPngPath = path.join(buildDir, "icon.png");
  await sharp(logoDarkSvg).png().toFile(iconPngPath);
  console.log(`Wrote ${path.relative(desktopRoot, iconPngPath)} (512x512)`);

  const source = await readPNG(iconPngPath);
  const images = await Promise.all(ICO_SIZES.map((size) => resize(source, size, size)));
  const ico = await imagesToIco(images);
  const iconIcoPath = path.join(buildDir, "icon.ico");
  fs.writeFileSync(iconIcoPath, ico);
  console.log(`Wrote ${path.relative(desktopRoot, iconIcoPath)} (${ICO_SIZES.join("/")})`);
}

async function genTrayIcons() {
  fs.mkdirSync(trayDir, { recursive: true });
  for (const [fileName, size] of [
    ["iconTemplate.png", 22],
    ["iconTemplate@2x.png", 44],
    ["iconTemplate-32.png", 32],
  ]) {
    const outPath = path.join(trayDir, fileName);
    await sharp(Buffer.from(buildTraySquareSvg(size), "utf8")).png().toFile(outPath);
    console.log(`Wrote ${path.relative(desktopRoot, outPath)} (${size}x${size})`);
  }
}

async function genDmgBackground() {
  const svg = fs.readFileSync(dmgBackgroundSvg);
  for (const [fileName, scale] of [
    ["background.png", 1],
    ["background@2x.png", 2],
  ]) {
    const contentW = 540 * scale;
    const contentH = 380 * scale;
    const outPath = path.join(buildDir, fileName);
    // density 72 为 SVG 原生尺寸；乘 scale 直接高清渲染，避免先光栅化再放大
    const content = await sharp(svg, { density: 72 * scale }).png().toBuffer();
    await sharp({
      create: {
        width: contentW,
        height: contentH + BG_BOTTOM_PAD * scale,
        channels: 3,
        background: "#ffffff",
      },
    })
      .composite([{ input: content, top: 0, left: 0 }])
      .png()
      .toFile(outPath);
    console.log(
      `Wrote ${path.relative(desktopRoot, outPath)} (${contentW}x${contentH + BG_BOTTOM_PAD * scale})`,
    );
  }
}

fs.mkdirSync(buildDir, { recursive: true });
await genPackagerIcons();
await genTrayIcons();
await genDmgBackground();
