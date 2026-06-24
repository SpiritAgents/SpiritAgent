import { defaultSchema } from "hast-util-sanitize";
import rehypeSanitize from "rehype-sanitize";
import { defaultRehypePlugins } from "streamdown";
import type { Pluggable } from "unified";

/** hast-util-sanitize compares protocol names without the trailing colon. */
export const MANAGED_GENERATED_ASSET_SANITIZE_PROTOCOL = "spirit";

const streamdownExtraTagNames = ["video", "picture", "source", "sup", "sub"] as const;

/**
 * Streamdown's default sanitize schema only allows http/https src values.
 * Spirit-managed generated assets use spirit:// and must survive sanitization
 * before rehype-harden and our Markdown media resolvers run.
 */
export const streamdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...new Set([...(defaultSchema.tagNames ?? []), ...streamdownExtraTagNames])],
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), "tel"],
    src: [
      ...(defaultSchema.protocols?.src ?? ["http", "https"]),
      MANAGED_GENERATED_ASSET_SANITIZE_PROTOCOL,
    ],
    srcset: [...(defaultSchema.protocols?.srcset ?? ["http", "https"])],
  },
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), "metastring"],
    video: [...(defaultSchema.attributes?.video ?? []), "src", "controls"],
    source: [...(defaultSchema.attributes?.source ?? []), "media", "srcset"],
    img: [...(defaultSchema.attributes?.img ?? []), "alt", "width", "height", "src"],
  },
};

export const streamdownRehypePlugins: Pluggable[] = [
  defaultRehypePlugins.raw,
  [rehypeSanitize, streamdownSanitizeSchema],
  defaultRehypePlugins.harden,
];
