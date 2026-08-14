/** Marketing preview: use site favicon instead of desktop build assets. */
export const SPIRIT_AGENT_ICON_DARK_SRC = "/favicon.ico";
export const SPIRIT_AGENT_ICON_LIGHT_SRC = "/favicon.ico";
export const SPIRIT_AGENT_ICON_MICA_SRC = "/favicon.ico";

export function spiritAgentBrandIconSrc(_dark: boolean): string {
  return SPIRIT_AGENT_ICON_DARK_SRC;
}

export function spiritAgentTitleBarIconSrc(_dark: boolean, useMicaBackdrop: boolean): string {
  return useMicaBackdrop ? SPIRIT_AGENT_ICON_MICA_SRC : SPIRIT_AGENT_ICON_DARK_SRC;
}
