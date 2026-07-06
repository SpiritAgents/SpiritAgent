import { FONT_WEIGHT_NORMAL } from "@/lib/desktop-typography";

const INLINE_CHIP_LAYOUT =
  `inline-flex items-center gap-1 px-0.5 py-0.5 text-xs ${FONT_WEIGHT_NORMAL} leading-none select-none align-middle mx-0.5`;

export const COMPOSER_INLINE_CHIP_TEXT_CLASS =
  "text-blue-500 dark:text-blue-400";

export const COMPOSER_INLINE_CHIP_ICON_CLASS =
  "text-blue-500 dark:text-blue-400";

export const COMPOSER_INLINE_CHIP_CLASS =
  `${INLINE_CHIP_LAYOUT} ${COMPOSER_INLINE_CHIP_TEXT_CLASS}`;
