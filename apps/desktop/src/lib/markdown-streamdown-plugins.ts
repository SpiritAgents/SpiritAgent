import { defaultSchema } from "hast-util-sanitize";
import rehypeSanitize from "rehype-sanitize";
import { defaultRehypePlugins } from "streamdown";
import type { Pluggable } from "unified";

/** hast-util-sanitize compares protocol names without the trailing colon. */
export const MANAGED_GENERATED_IMAGE_SANITIZE_PROTOCOL = "spirit-image";

/**
 * Streamdown's default sanitize schema only allows http/https image src values.
 * Spirit-managed generated images use spirit-image:// and must survive sanitization
 * before rehype-harden and our MarkdownImage resolver run.
 */
export const streamdownSanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), "tel"],
    src: [
      ...(defaultSchema.protocols?.src ?? ["http", "https"]),
      MANAGED_GENERATED_IMAGE_SANITIZE_PROTOCOL,
    ],
  },
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), "metastring"],
  },
};

export const streamdownRehypePlugins: Pluggable[] = [
  defaultRehypePlugins.raw,
  [rehypeSanitize, streamdownSanitizeSchema],
  defaultRehypePlugins.harden,
];
