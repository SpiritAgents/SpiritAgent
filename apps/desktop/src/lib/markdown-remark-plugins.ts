import remarkBreaks from "remark-breaks";
import { defaultRemarkPlugins } from "streamdown";
import type { Pluggable } from "unified";

/** Streamdown：保留默认 remark 插件并追加 remark-breaks。 */
export const spiritRemarkPluginsForStreamdown: Pluggable[] = [
  ...Object.values(defaultRemarkPlugins),
  remarkBreaks,
];
