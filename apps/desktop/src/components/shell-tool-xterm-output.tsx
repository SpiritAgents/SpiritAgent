import { useEffect, useLayoutEffect, useRef } from "react";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

import "@xterm/xterm/css/xterm.css";

import { readShellToolMonochromeTheme } from "@/lib/shell-tool-xterm-theme";
import { cn } from "@/lib/utils";

/** 对齐工具卡 `font-mono text-xs leading-relaxed`。 */
const SHELL_TOOL_XTERM_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
const SHELL_TOOL_XTERM_FONT_SIZE = 12;
const SHELL_TOOL_XTERM_LINE_HEIGHT = 1.625;
const SHELL_TOOL_XTERM_MAX_HEIGHT_PX = 384; // max-h-96
const SHELL_TOOL_XTERM_MIN_HEIGHT_PX = 48;
const SHELL_TOOL_XTERM_SCROLLBACK = 50_000;

export type ShellToolXtermOutputProps = {
  text: string;
  followTail?: boolean;
  className?: string;
};

function measureContentHeightPx(term: Terminal): number {
  const rows = Math.max(1, term.buffer.active.length);
  const cellHeight = term.rows > 0 ? term.element?.querySelector(".xterm-rows")?.clientHeight : 0;
  const rowHeight =
    cellHeight && term.rows > 0
      ? cellHeight / term.rows
      : SHELL_TOOL_XTERM_FONT_SIZE * SHELL_TOOL_XTERM_LINE_HEIGHT;
  return Math.min(
    SHELL_TOOL_XTERM_MAX_HEIGHT_PX,
    Math.max(SHELL_TOOL_XTERM_MIN_HEIGHT_PX, Math.ceil(rows * rowHeight)),
  );
}

/**
 * Shell 工具卡只读输出：用 xterm 消费 ANSI / CR，主题强制单色以匹配卡片字色。
 */
export function ShellToolXtermOutput({
  text,
  followTail = false,
  className,
}: ShellToolXtermOutputProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const writtenTextRef = useRef<string>("");
  const followTailRef = useRef(followTail);

  useLayoutEffect(() => {
    followTailRef.current = followTail;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const term = new Terminal({
      convertEol: true,
      disableStdin: true,
      cursorBlink: false,
      cursorStyle: "underline",
      fontSize: SHELL_TOOL_XTERM_FONT_SIZE,
      lineHeight: SHELL_TOOL_XTERM_LINE_HEIGHT,
      fontFamily: SHELL_TOOL_XTERM_FONT_FAMILY,
      fontWeight: "normal",
      scrollback: SHELL_TOOL_XTERM_SCROLLBACK,
      theme: readShellToolMonochromeTheme(host),
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(host);
    host.style.height = `${SHELL_TOOL_XTERM_MIN_HEIGHT_PX}px`;
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;
    writtenTextRef.current = "";

    const applyTheme = (): void => {
      term.options.theme = readShellToolMonochromeTheme(host);
    };
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const resizeObserver = new ResizeObserver(() => {
      if (!host.isConnected) {
        return;
      }
      fitAddon.fit();
    });
    resizeObserver.observe(host);

    return () => {
      themeObserver.disconnect();
      resizeObserver.disconnect();
      fitRef.current = null;
      termRef.current = null;
      writtenTextRef.current = "";
      term.dispose();
    };
  }, []);

  useEffect(() => {
    const term = termRef.current;
    const fitAddon = fitRef.current;
    const host = hostRef.current;
    if (!term || !fitAddon || !host) {
      return;
    }

    const previous = writtenTextRef.current;
    if (text === previous) {
      if (followTail) {
        term.scrollToBottom();
      }
      return;
    }

    if (text.startsWith(previous) && previous.length > 0) {
      term.write(text.slice(previous.length));
    } else {
      term.reset();
      if (text.length > 0) {
        term.write(text);
      }
    }
    writtenTextRef.current = text;

    host.style.height = `${measureContentHeightPx(term)}px`;
    fitAddon.fit();
    // 二次测量：fit 后行高更准
    host.style.height = `${measureContentHeightPx(term)}px`;
    fitAddon.fit();

    if (followTailRef.current) {
      term.scrollToBottom();
    }
  }, [text, followTail]);

  return (
    <div
      ref={hostRef}
      className={cn("max-h-96 w-full min-w-0 overflow-hidden", className)}
      aria-label="Shell output"
    />
  );
}
