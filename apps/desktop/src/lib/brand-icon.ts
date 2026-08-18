import glyphBlackUrl from "@spiritagent/brand/assets/glyph-black.svg?url";
import glyphWhiteUrl from "@spiritagent/brand/assets/glyph-white.svg?url";
import logoDarkUrl from "@spiritagent/brand/assets/logo-dark.svg?url";

/** Dark UI: white glyph on transparent background (`@spiritagent/brand/assets/glyph-white.svg`) */
export const SPIRIT_AGENT_ICON_DARK_SRC = glyphWhiteUrl;

/** Light UI: black glyph on transparent background (`@spiritagent/brand/assets/glyph-black.svg`) */
export const SPIRIT_AGENT_ICON_LIGHT_SRC = glyphBlackUrl;

/** Translucency title bar: brand logo on black background (`@spiritagent/brand/assets/logo-dark.svg`; the glyph occupies a smaller fraction of the canvas than the transparent variants) */
export const SPIRIT_AGENT_ICON_TRANSLUCENCY_SRC = logoDarkUrl;

export function spiritAgentBrandIconSrc(dark: boolean): string {
  return dark ? SPIRIT_AGENT_ICON_DARK_SRC : SPIRIT_AGENT_ICON_LIGHT_SRC;
}

export function spiritAgentTitleBarIconSrc(dark: boolean, useTranslucency: boolean): string {
  return useTranslucency ? SPIRIT_AGENT_ICON_TRANSLUCENCY_SRC : spiritAgentBrandIconSrc(dark);
}
