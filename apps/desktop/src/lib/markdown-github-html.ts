import { defaultSchema } from "hast-util-sanitize";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import type { Pluggable } from "unified";

export const githubHtmlRehypePlugins: Pluggable[] = [
  rehypeRaw,
  [rehypeSanitize, defaultSchema],
];
