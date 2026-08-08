/** Mica 开启时主内容区背景不透明度（仅 tint，不叠加 CSS backdrop-blur）。 */
export const DESKTOP_MICA_CONTENT_TINT_CLASS = "bg-background/70";

/** Composer 输入框半透明底（暗色叠加 input 淡层）；非 Mica 浮层同源 */
export const DESKTOP_COMPOSER_SURFACE_BACKDROP =
  "bg-background/55 backdrop-blur-xl dark:bg-input/30 supports-[backdrop-filter]:bg-background/40 dark:supports-[backdrop-filter]:bg-input/25";

/**
 * Mica 开启时 Composer 半透明 tint（不叠 CSS blur，透出窗级系统材质）。
 * 消息叠穿由视口形状 mask 裁掉；深色用纯黑 background 带 alpha。
 */
export const DESKTOP_COMPOSER_SURFACE_MICA_TINT = "bg-background/30";

/** @deprecated 使用 {@link DESKTOP_COMPOSER_SURFACE_MICA_TINT} */
export const DESKTOP_COMPOSER_SURFACE_SOLID = DESKTOP_COMPOSER_SURFACE_MICA_TINT;

/** Mica 下半透明 tint；关闭时保持玻璃拟态 */
export function desktopComposerSurfaceBackdropClass(useMicaBackdrop: boolean): string {
  return useMicaBackdrop ? DESKTOP_COMPOSER_SURFACE_MICA_TINT : DESKTOP_COMPOSER_SURFACE_BACKDROP;
}

/** Composer 胶囊（Changes 等）底/边框：与输入框同源，随 Mica 切换实色/玻璃 */
export function desktopComposerChipSurfaceClass(useMicaBackdrop: boolean): string {
  return [
    "border border-border/50 dark:border-white/10",
    "hover:border-ring/60 dark:hover:border-white/12",
    desktopComposerSurfaceBackdropClass(useMicaBackdrop),
  ].join(" ");
}

/** 侧边栏：Mica 下轻 tint，比内容区更浅，保留系统 blur 可读性。 */
export const DESKTOP_MICA_SIDEBAR_TINT_CLASS = "bg-background/45";

/** Windows 自绘顶栏：Mica 下整栏 tint，与侧栏同不透明度；独立于侧栏宽度布局。 */
export const DESKTOP_MICA_TITLE_BAR_TINT_CLASS = DESKTOP_MICA_SIDEBAR_TINT_CLASS;

/** 工作区浏览器页槽：略高于主区，减轻 WebView 透底闪烁。 */
export const DESKTOP_MICA_BROWSER_TINT_CLASS = "bg-background/80";

/** 工作区终端：保留较高不透明度以保证 ANSI 可读性。 */
export const DESKTOP_MICA_TERMINAL_TINT_CLASS = "bg-background/87";

/** 工作区面板选中 tab：与面板底色衔接。 */
export const DESKTOP_MICA_WORKSPACE_TAB_SELECTED_TINT_CLASS = "bg-background/60";

/** 文件详情预览区（Blur 关）：轻 tint 与文件树区分。 */
export const DESKTOP_FILES_DETAIL_PREVIEW_TINT_CLASS = "bg-background/30";

const SOLID_BACKGROUND_CLASS = "bg-background";
const TRANSPARENT_BACKGROUND_CLASS = "bg-transparent";

/** 主内容区外层：Mica 下半透明主题底色，否则实心背景。 */
export function desktopMicaTintClass(useMicaBackdrop: boolean): string {
  return useMicaBackdrop ? DESKTOP_MICA_CONTENT_TINT_CLASS : SOLID_BACKGROUND_CLASS;
}

/**
 * LaunchSplash / OOBE 全屏覆盖层 tint。
 * 退场时整层（含背景 tint）随 opacity 淡出，背景本身参与渐隐，故 tint 全程保持，不做透明切换。
 */
export function desktopFullscreenOverlayTintClass(useMicaBackdrop: boolean): string {
  return desktopMicaTintClass(useMicaBackdrop);
}

/** 主内容区内层：Mica 下透明以避免多层 alpha 叠深，否则实心背景。 */
export function desktopMicaTintInnerClass(useMicaBackdrop: boolean): string {
  return useMicaBackdrop ? TRANSPARENT_BACKGROUND_CLASS : SOLID_BACKGROUND_CLASS;
}

/** 工作区浏览器全屏页槽。 */
export function desktopMicaBrowserTintClass(useMicaBackdrop: boolean): string {
  return useMicaBackdrop ? DESKTOP_MICA_BROWSER_TINT_CLASS : SOLID_BACKGROUND_CLASS;
}

/** 工作区集成终端容器。 */
export function desktopMicaTerminalTintClass(useMicaBackdrop: boolean): string {
  return useMicaBackdrop ? DESKTOP_MICA_TERMINAL_TINT_CLASS : SOLID_BACKGROUND_CLASS;
}

/** 工作区面板选中 tab：Mica 下轻 tint 以衔接面板底色。 */
export function desktopMicaWorkspaceTabSelectedClass(useMicaBackdrop: boolean): string {
  return useMicaBackdrop ? DESKTOP_MICA_WORKSPACE_TAB_SELECTED_TINT_CLASS : SOLID_BACKGROUND_CLASS;
}

/** 文件详情预览/编辑槽：Mica 下透明以避免与面板 tint 叠深，否则轻 tint。 */
export function desktopMicaFileDetailSurfaceClass(useMicaBackdrop: boolean): string {
  return useMicaBackdrop ? TRANSPARENT_BACKGROUND_CLASS : DESKTOP_FILES_DETAIL_PREVIEW_TINT_CLASS;
}

/** Windows 自绘顶栏：Mica 下整栏半透明底，否则实心侧栏色。 */
export function desktopMicaTitleBarTintClass(useMicaBackdrop: boolean): string {
  return useMicaBackdrop ? DESKTOP_MICA_TITLE_BAR_TINT_CLASS : "bg-sidebar";
}
