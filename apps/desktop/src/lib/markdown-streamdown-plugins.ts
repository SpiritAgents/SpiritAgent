import { defaultSchema } from "hast-util-sanitize";
import rehypeSanitize from "rehype-sanitize";
import { defaultRehypePlugins } from "streamdown";
import type { Pluggable } from "unified";

/** hast-util-sanitize compares protocol names without the trailing colon. */
export const MANAGED_GENERATED_ASSET_SANITIZE_PROTOCOL = "spirit";

const streamdownExtraTagNames = ["video", "picture", "source", "sup", "sub"] as const;

/**
 * Markdown media must not load remote http(s) resources from the renderer.
 * Only Spirit-managed spirit:// assets keep a protocol allowlist entry; relative
 * and absolute local paths have no scheme and still pass through for local IPC.
 */
export const streamdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...new Set([...(defaultSchema.tagNames ?? []), ...streamdownExtraTagNames])],
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), "tel"],
    src: [MANAGED_GENERATED_ASSET_SANITIZE_PROTOCOL],
    srcset: [MANAGED_GENERATED_ASSET_SANITIZE_PROTOCOL],
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
