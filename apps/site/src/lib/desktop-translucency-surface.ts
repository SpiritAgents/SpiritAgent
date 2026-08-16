/** translucency 开启时主内容区背景不透明度（仅 tint，不叠加 CSS backdrop-blur）。 */
export const DESKTOP_TRANSLUCENCY_CONTENT_TINT_CLASS = "bg-background/70";

/** Composer 输入框半透明底（暗色叠加 input 淡层）；非 translucency 浮层同源 */
export const DESKTOP_COMPOSER_SURFACE_BACKDROP =
  "bg-background/55 backdrop-blur-xl dark:bg-input/30 supports-[backdrop-filter]:bg-background/40 dark:supports-[backdrop-filter]:bg-input/25";

/** 浅色模式浮层 / 抬起表面扩散阴影；深色勿放大，由调用方配 dark:shadow-* */
export const DESKTOP_OVERLAY_LIGHT_SHADOW = "shadow-[0_2px_20px_-4px_rgb(0_0_0/0.06)]";

/** 抬起表面阴影：浅色扩散 + 深色沿用 sm（Composer / 消息气泡等） */
export const DESKTOP_ELEVATION_SHADOW_SM = `${DESKTOP_OVERLAY_LIGHT_SHADOW} dark:shadow-sm`;

/** 工作区浏览器页槽：略高于主区，减轻 WebView 透底闪烁。 */
export const DESKTOP_TRANSLUCENCY_BROWSER_TINT_CLASS = "bg-background/80";

/** 工作区终端：保留较高不透明度以保证 ANSI 可读性。 */
export const DESKTOP_TRANSLUCENCY_TERMINAL_TINT_CLASS = "bg-background/87";

/** 工作区面板选中 tab：与面板底色衔接。 */
export const DESKTOP_TRANSLUCENCY_WORKSPACE_TAB_SELECTED_TINT_CLASS = "bg-background/60";

const SOLID_BACKGROUND_CLASS = "bg-background";
const TRANSPARENT_BACKGROUND_CLASS = "bg-transparent";

/** 主内容区外层：translucency 下半透明主题底色，否则实心背景。 */
export function desktopTranslucencyTintClass(useTranslucency: boolean): string {
  return useTranslucency ? DESKTOP_TRANSLUCENCY_CONTENT_TINT_CLASS : SOLID_BACKGROUND_CLASS;
}

/** 主内容区内层：translucency 下透明以避免多层 alpha 叠深，否则实心背景。 */
export function desktopTranslucencyTintInnerClass(useTranslucency: boolean): string {
  return useTranslucency ? TRANSPARENT_BACKGROUND_CLASS : SOLID_BACKGROUND_CLASS;
}

/** 工作区浏览器全屏页槽。 */
export function desktopTranslucencyBrowserTintClass(useTranslucency: boolean): string {
  return useTranslucency ? DESKTOP_TRANSLUCENCY_BROWSER_TINT_CLASS : SOLID_BACKGROUND_CLASS;
}

/** 工作区集成终端容器。 */
export function desktopTranslucencyTerminalTintClass(useTranslucency: boolean): string {
  return useTranslucency ? DESKTOP_TRANSLUCENCY_TERMINAL_TINT_CLASS : SOLID_BACKGROUND_CLASS;
}

/** 工作区面板选中 tab：translucency 下轻 tint 以衔接面板底色。 */
export function desktopTranslucencyWorkspaceTabSelectedClass(useTranslucency: boolean): string {
  return useTranslucency
    ? DESKTOP_TRANSLUCENCY_WORKSPACE_TAB_SELECTED_TINT_CLASS
    : SOLID_BACKGROUND_CLASS;
}
