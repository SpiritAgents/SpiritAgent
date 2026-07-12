import { createCodePlugin } from "@streamdown/code";

import { SPIRIT_SHIKI_PLUS_THEMES } from "@/lib/spirit-shiki-themes";

/** Streamdown 与工具卡等 UI 共用的 Shiki 高亮插件。 */
export const spiritShikiCodePlugin = createCodePlugin({
  themes: [...SPIRIT_SHIKI_PLUS_THEMES],
});
