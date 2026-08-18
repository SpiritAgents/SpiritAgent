/** Main content background opacity when translucency is on (tint only; no extra CSS backdrop-blur). */
export const DESKTOP_TRANSLUCENCY_CONTENT_TINT_CLASS = "bg-background/70";

/** Composer input translucent backdrop (dark mode adds a faint input layer); same source as non-translucency overlays */
export const DESKTOP_COMPOSER_SURFACE_BACKDROP =
  "bg-background/55 backdrop-blur-xl dark:bg-input/30 supports-[backdrop-filter]:bg-background/40 dark:supports-[backdrop-filter]:bg-input/25";

/** Diffuse shadow for light-mode overlays / elevated surfaces; do not enlarge in dark mode — callers add dark:shadow-* */
export const DESKTOP_OVERLAY_LIGHT_SHADOW = "shadow-[0_2px_20px_-4px_rgb(0_0_0/0.06)]";

/** Elevated surface shadow: light diffuse + dark keeps sm (Composer / message bubbles etc.) */
export const DESKTOP_ELEVATION_SHADOW_SM = `${DESKTOP_OVERLAY_LIGHT_SHADOW} dark:shadow-sm`;

/** Workspace browser page slot: slightly more opaque than the main area to reduce WebView show-through flicker. */
export const DESKTOP_TRANSLUCENCY_BROWSER_TINT_CLASS = "bg-background/80";

/** Workspace terminal: keeps higher opacity for ANSI readability. */
export const DESKTOP_TRANSLUCENCY_TERMINAL_TINT_CLASS = "bg-background/87";

/** Workspace panel selected tab: blends into the panel background. */
export const DESKTOP_TRANSLUCENCY_WORKSPACE_TAB_SELECTED_TINT_CLASS = "bg-background/60";

const SOLID_BACKGROUND_CLASS = "bg-background";
const TRANSPARENT_BACKGROUND_CLASS = "bg-transparent";

/** Main content outer layer: translucent theme tint under translucency, otherwise a solid background. */
export function desktopTranslucencyTintClass(useTranslucency: boolean): string {
  return useTranslucency ? DESKTOP_TRANSLUCENCY_CONTENT_TINT_CLASS : SOLID_BACKGROUND_CLASS;
}

/** Main content inner layer: transparent under translucency to avoid stacked alpha darkening, otherwise a solid background. */
export function desktopTranslucencyTintInnerClass(useTranslucency: boolean): string {
  return useTranslucency ? TRANSPARENT_BACKGROUND_CLASS : SOLID_BACKGROUND_CLASS;
}

/** Workspace browser fullscreen page slot. */
export function desktopTranslucencyBrowserTintClass(useTranslucency: boolean): string {
  return useTranslucency ? DESKTOP_TRANSLUCENCY_BROWSER_TINT_CLASS : SOLID_BACKGROUND_CLASS;
}

/** Workspace integrated terminal container. */
export function desktopTranslucencyTerminalTintClass(useTranslucency: boolean): string {
  return useTranslucency ? DESKTOP_TRANSLUCENCY_TERMINAL_TINT_CLASS : SOLID_BACKGROUND_CLASS;
}

/** Workspace panel selected tab: light tint under translucency to blend into the panel background. */
export function desktopTranslucencyWorkspaceTabSelectedClass(useTranslucency: boolean): string {
  return useTranslucency
    ? DESKTOP_TRANSLUCENCY_WORKSPACE_TAB_SELECTED_TINT_CLASS
    : SOLID_BACKGROUND_CLASS;
}
