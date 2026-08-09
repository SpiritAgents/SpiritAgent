import { useEffect, useLayoutEffect, useRef } from "react";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

import "@xterm/xterm/css/xterm.css";

import { readShellToolMonochromeTheme, stripAnsiSgrSequences } from "@/lib/shell-tool-xterm-theme";
import { cn } from "@/lib/utils";

/** 对齐工具卡 `font-mono text-xs leading-relaxed`。 */
const SHELL_TOOL_XTERM_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
const SHELL_TOOL_XTERM_FONT_SIZE = 12;
const SHELL_TOOL_XTERM_LINE_HEIGHT = 1.625;
/** max-h-96 */
const SHELL_TOOL_XTERM_MAX_HEIGHT_PX = 384;
const SHELL_TOOL_XTERM_MIN_HEIGHT_PX = 96;
const SHELL_TOOL_XTERM_SCROLLBACK = 50_000;
const ANSI_CSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

export type ShellToolXtermOutputProps = {
  text: string;
  followTail?: boolean;
  className?: string;
};

function rowHeightPx(term: Terminal): number {
  const rowsEl = term.element?.querySelector(".xterm-rows");
  const cellHeight = rowsEl instanceof HTMLElement ? rowsEl.clientHeight : 0;
  if (cellHeight > 0 && term.rows > 0) {
    return cellHeight / term.rows;
  }
  return SHELL_TOOL_XTERM_FONT_SIZE * SHELL_TOOL_XTERM_LINE_HEIGHT;
}

function clampHeightPx(height: number): number {
  return Math.min(
    SHELL_TOOL_XTERM_MAX_HEIGHT_PX,
    Math.max(SHELL_TOOL_XTERM_MIN_HEIGHT_PX, Math.ceil(height)),
  );
}

/** 按可见文本行数估算高度（write 完成前也能抬高容器，避免卡在 2 行）。 */
function estimateHeightFromTextPx(text: string, cols: number): number {
  const visible = text.replace(ANSI_CSI_RE, "");
  const lines = visible.length > 0 ? visible.split(/\r\n|\n|\r/) : [""];
  const safeCols = Math.max(cols, 20);
  let rows = 0;
  for (const line of lines) {
    rows += Math.max(1, Math.ceil(Math.max(line.length, 1) / safeCols));
  }
  return clampHeightPx(rows * SHELL_TOOL_XTERM_FONT_SIZE * SHELL_TOOL_XTERM_LINE_HEIGHT);
}

function measureContentHeightPx(term: Terminal): number {
  const rows = Math.max(1, term.buffer.active.length);
  return clampHeightPx(rows * rowHeightPx(term));
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
  const writeGenerationRef = useRef(0);

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
      writeGenerationRef.current += 1;
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

    const generation = ++writeGenerationRef.current;
    const writeText = stripAnsiSgrSequences(text);
    // write 异步：先按文本估算抬高，避免量高时 buffer 仍为空而卡在约 2 行。
    host.style.height = `${estimateHeightFromTextPx(writeText, term.cols)}px`;
    fitAddon.fit();

    const afterWrite = (): void => {
      if (generation !== writeGenerationRef.current || !host.isConnected) {
        return;
      }
      host.style.height = `${measureContentHeightPx(term)}px`;
      fitAddon.fit();
      if (followTailRef.current) {
        term.scrollToBottom();
      }
    };

    const previousWrite = stripAnsiSgrSequences(previous);
    if (writeText.startsWith(previousWrite) && previousWrite.length > 0) {
      term.write(writeText.slice(previousWrite.length), afterWrite);
    } else {
      term.reset();
      if (writeText.length > 0) {
        term.write(writeText, afterWrite);
      } else {
        afterWrite();
      }
    }
    writtenTextRef.current = text;
  }, [text, followTail]);

  return (
    <div
      ref={hostRef}
      className={cn("shell-tool-xterm w-full min-w-0 overflow-hidden", className)}
      style={{ maxHeight: SHELL_TOOL_XTERM_MAX_HEIGHT_PX }}
      aria-label="Shell output"
    />
  );
}
