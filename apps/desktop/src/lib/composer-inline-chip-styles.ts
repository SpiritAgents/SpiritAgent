import { FONT_WEIGHT_NORMAL } from "@/lib/desktop-typography";

// 不得加 select-none：会抑制 chip 子树的原生选区绘制
// 必须为 inline（非 inline-flex）：label 文本才能并入外层行盒，选区带与 plain text 同高同色
// whitespace-nowrap：chip 不在内部断行，保持原子单元行为
// --chip-pad 须等于根 px、--chip-mx 须等于根 mx：供两个 spacer 伸出覆盖 padding 与
// margin 的选区带（见 chip-shell.tsx）
const INLINE_CHIP_LAYOUT = `inline whitespace-nowrap px-0.5 py-0.5 text-xs ${FONT_WEIGHT_NORMAL} leading-none mx-0.5 [--chip-pad:2px] [--chip-mx:2px]`;

export const COMPOSER_INLINE_CHIP_TEXT_CLASS = "text-blue-500 dark:text-blue-400";

export const COMPOSER_INLINE_CHIP_ICON_CLASS = "text-blue-500 dark:text-blue-400";

export const COMPOSER_INLINE_CHIP_CLASS = `${INLINE_CHIP_LAYOUT} ${COMPOSER_INLINE_CHIP_TEXT_CLASS}`;

/**
 * 消息气泡只读 Chip。Composer 必须用 {@link COMPOSER_INLINE_CHIP_CLASS}（inline + spacer）。
 * 气泡无选区约束；若复用 inline，Tailwind Preflight 的 svg{display:block} 会让图标与文件名拆行。
 */
export const MESSAGE_BUBBLE_CHIP_CLASS = `inline-flex items-center gap-1 whitespace-nowrap px-0.5 py-0.5 text-xs ${FONT_WEIGHT_NORMAL} leading-none mx-0.5 ${COMPOSER_INLINE_CHIP_TEXT_CLASS}`;
