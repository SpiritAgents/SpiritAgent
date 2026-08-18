import { FONT_WEIGHT_NORMAL } from "@/lib/desktop-typography";

// Must not add select-none: it would suppress native selection painting in the chip subtree
// Must be inline (not inline-flex): the label text merges into the outer line box so the selection band matches plain text in height and color
// whitespace-nowrap: the chip never wraps internally, preserving atomic-unit behavior
// --chip-pad must equal the root px, --chip-mx must equal the root mx: lets the two spacers extend to cover the
// padding and margin selection band (see chip-shell.tsx)
const INLINE_CHIP_LAYOUT = `inline whitespace-nowrap px-0.5 py-0.5 text-xs ${FONT_WEIGHT_NORMAL} leading-none mx-0.5 [--chip-pad:2px] [--chip-mx:2px]`;

export const COMPOSER_INLINE_CHIP_TEXT_CLASS = "text-blue-500 dark:text-blue-400";

export const COMPOSER_INLINE_CHIP_ICON_CLASS = "text-blue-500 dark:text-blue-400";

export const COMPOSER_INLINE_CHIP_CLASS = `${INLINE_CHIP_LAYOUT} ${COMPOSER_INLINE_CHIP_TEXT_CLASS}`;

/**
 * Read-only chip for message bubbles. The Composer must use {@link COMPOSER_INLINE_CHIP_CLASS} (inline + spacer).
 * Bubbles have no selection constraints; reusing inline there would let Tailwind Preflight's svg{display:block} split the icon and file name onto separate lines.
 */
export const MESSAGE_BUBBLE_CHIP_CLASS = `inline-flex items-center gap-1 whitespace-nowrap px-0.5 py-0.5 text-xs ${FONT_WEIGHT_NORMAL} leading-none mx-0.5 ${COMPOSER_INLINE_CHIP_TEXT_CLASS}`;
