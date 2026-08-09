import type { ITheme } from "@xterm/xterm";

const ANSI_COLOR_KEYS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightMagenta",
  "brightCyan",
  "brightWhite",
] as const;

/** 由前景色构造单色主题（全部 ANSI 槽同色）。 */
export function buildShellToolMonochromeTheme(
  foreground: string,
  selectionBackground?: string,
): ITheme {
  const theme: ITheme = {
    foreground,
    background: "#00000000",
    cursor: "#00000000",
    cursorAccent: "#00000000",
    ...(selectionBackground ? { selectionBackground } : {}),
  };
  for (const key of ANSI_COLOR_KEYS) {
    theme[key] = foreground;
  }
  return theme;
}

/** 与工具卡 `text-muted-foreground` 对齐的单色 xterm 主题：消费 ANSI，不染色。 */
export function readShellToolMonochromeTheme(element?: Element | null): ITheme {
  const styles = getComputedStyle(element ?? document.documentElement);
  const foreground =
    styles.getPropertyValue("--muted-foreground").trim() ||
    styles.color.trim() ||
    "#a1a1a1";
  const selectionBackground =
    styles.getPropertyValue("--terminal-selection-bg").trim() || undefined;
  return buildShellToolMonochromeTheme(foreground, selectionBackground);
}
