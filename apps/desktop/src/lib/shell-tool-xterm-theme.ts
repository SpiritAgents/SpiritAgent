import type { ITheme } from "@xterm/xterm";

/** SGR (sequences ending in m): covers 16-color / 256-color / truecolor. */
const ANSI_SGR_RE = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*m`, "g");

/** Strips color-setting SGR while keeping non-m CSI (clear line/cursor etc.), so truecolor cannot bypass ITheme. */
export function stripAnsiSgrSequences(text: string): string {
  return text.replace(ANSI_SGR_RE, "");
}

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

/** Builds a monochrome theme from a foreground color (all ANSI slots share the same color). */
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

/** Monochrome xterm theme aligned with the tool card's `text-muted-foreground`: consumes ANSI without applying colors. */
export function readShellToolMonochromeTheme(element?: Element | null): ITheme {
  const styles = getComputedStyle(element ?? document.documentElement);
  const foreground =
    styles.getPropertyValue("--muted-foreground").trim() || styles.color.trim() || "#a1a1a1";
  const selectionBackground =
    styles.getPropertyValue("--terminal-selection-bg").trim() || undefined;
  return buildShellToolMonochromeTheme(foreground, selectionBackground);
}
