import glyphBlackUrl from "@spiritagent/brand/assets/glyph-black.svg?url";
import glyphWhiteUrl from "@spiritagent/brand/assets/glyph-white.svg?url";
import logoDarkUrl from "@spiritagent/brand/assets/logo-dark.svg?url";

/** 深色 UI：透明底白色图案（`@spiritagent/brand/assets/glyph-white.svg`） */
export const SPIRIT_AGENT_ICON_DARK_SRC = glyphWhiteUrl;

/** 浅色 UI：透明底黑色图案（`@spiritagent/brand/assets/glyph-black.svg`） */
export const SPIRIT_AGENT_ICON_LIGHT_SRC = glyphBlackUrl;

/** translucency 顶栏：黑底品牌标（`@spiritagent/brand/assets/logo-dark.svg`，图案占画布比例小于透明标） */
export const SPIRIT_AGENT_ICON_TRANSLUCENCY_SRC = logoDarkUrl;

export function spiritAgentBrandIconSrc(dark: boolean): string {
  return dark ? SPIRIT_AGENT_ICON_DARK_SRC : SPIRIT_AGENT_ICON_LIGHT_SRC;
}

export function spiritAgentTitleBarIconSrc(dark: boolean, useTranslucency: boolean): string {
  return useTranslucency ? SPIRIT_AGENT_ICON_TRANSLUCENCY_SRC : spiritAgentBrandIconSrc(dark);
}
