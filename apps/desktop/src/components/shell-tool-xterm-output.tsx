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
/**
 * 展示缓冲上限（字符）：约等于 scrollback×宽列的量级，避免流式全量重扫与无界字符串驻留。
 * 宿主 stdout 收集另有 8MiB 封顶；流式 chunk 路径可能更长，UI 只保留尾部。
 */
const SHELL_TOOL_XTERM_DISPLAY_MAX_CHARS = 512 * 1024;

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

/** 只保留尾部展示窗口，防止长输出在 React/xterm 路径上无界增长。 */
function takeDisplayTail(text: string): string {
  if (text.length <= SHELL_TOOL_XTERM_DISPLAY_MAX_CHARS) {
    return text;
  }
  return text.slice(text.length - SHELL_TOOL_XTERM_DISPLAY_MAX_CHARS);
}

/** 按可见文本行数估算高度增量（只扫 delta，避免每次全量 split）。 */
function estimateHeightDeltaPx(deltaText: string, cols: number): number {
  if (deltaText.length === 0) {
    return 0;
  }
  const lines = deltaText.split(/\r\n|\n|\r/);
  const safeCols = Math.max(cols, 20);
  let rows = 0;
  for (const line of lines) {
    rows += Math.max(1, Math.ceil(Math.max(line.length, 1) / safeCols));
  }
  // split 在无尾换行时多计一段空行起点；纯增量用行数即可
  return rows * SHELL_TOOL_XTERM_FONT_SIZE * SHELL_TOOL_XTERM_LINE_HEIGHT;
}

function measureContentHeightPx(term: Terminal): number {
  const rows = Math.max(1, term.buffer.active.length);
  return clampHeightPx(rows * rowHeightPx(term));
}

function isXtermViewportAtBottom(term: Terminal): boolean {
  const { viewportY, baseY } = term.buffer.active;
  return viewportY >= baseY;
}

/**
 * Shell 工具卡只读输出：用 xterm 消费 ANSI / CR，主题强制单色以匹配卡片字色。
 *
 * followTail 为 sticky：仅在用户仍贴底时自动滚到最新；上滚后暂停，回到底部再恢复。
 */
export function ShellToolXtermOutput({
  text,
  followTail = false,
  className,
}: ShellToolXtermOutputProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  /** 已写入终端的展示窗口（可能是全量 text 的尾部）。 */
  const writtenDisplayRef = useRef<string>("");
  const followTailRef = useRef(followTail);
  const stickToBottomRef = useRef(true);
  const writeGenerationRef = useRef(0);
  const prevFollowTailRef = useRef(followTail);

  useLayoutEffect(() => {
    followTailRef.current = followTail;
    if (followTail && !prevFollowTailRef.current) {
      stickToBottomRef.current = true;
    }
    prevFollowTailRef.current = followTail;
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
    writtenDisplayRef.current = "";
    stickToBottomRef.current = true;

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

    // 解除 stick 只认用户输入（与会话流式定底同思路）：内容增长触发的 scroll 不解除。
    const onWheel = (event: WheelEvent): void => {
      if (event.deltaY < 0) {
        stickToBottomRef.current = false;
      }
    };
    const scrollDisposable = term.onScroll(() => {
      // 仅恢复，不解除：回到底部后继续跟尾
      if (isXtermViewportAtBottom(term)) {
        stickToBottomRef.current = true;
      }
    });
    host.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      writeGenerationRef.current += 1;
      host.removeEventListener("wheel", onWheel);
      scrollDisposable.dispose();
      themeObserver.disconnect();
      resizeObserver.disconnect();
      fitRef.current = null;
      termRef.current = null;
      writtenDisplayRef.current = "";
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

    const maybeScrollToBottom = (): void => {
      if (followTailRef.current && stickToBottomRef.current) {
        term.scrollToBottom();
      }
    };

    const nextDisplay = takeDisplayTail(text);
    const previousDisplay = writtenDisplayRef.current;
    if (nextDisplay === previousDisplay) {
      maybeScrollToBottom();
      return;
    }

    const generation = ++writeGenerationRef.current;
    const atMaxHeight =
      Number.parseFloat(host.style.height) >= SHELL_TOOL_XTERM_MAX_HEIGHT_PX - 0.5;

    const afterWrite = (): void => {
      if (generation !== writeGenerationRef.current || !host.isConnected) {
        return;
      }
      host.style.height = `${measureContentHeightPx(term)}px`;
      fitAddon.fit();
      maybeScrollToBottom();
    };

    const appendDelta = nextDisplay.startsWith(previousDisplay) && previousDisplay.length > 0;
    if (appendDelta) {
      const deltaRaw = nextDisplay.slice(previousDisplay.length);
      const deltaWrite = stripAnsiSgrSequences(deltaRaw);
      // write 异步：未达上限时按 delta 抬高，避免全量重估。
      if (!atMaxHeight && deltaWrite.length > 0) {
        const currentHeight =
          Number.parseFloat(host.style.height) || SHELL_TOOL_XTERM_MIN_HEIGHT_PX;
        host.style.height = `${clampHeightPx(
          currentHeight + estimateHeightDeltaPx(deltaWrite, term.cols),
        )}px`;
        fitAddon.fit();
      }
      term.write(deltaWrite, afterWrite);
    } else {
      const writeText = stripAnsiSgrSequences(nextDisplay);
      if (!atMaxHeight) {
        host.style.height = `${clampHeightPx(
          estimateHeightDeltaPx(writeText, term.cols) || SHELL_TOOL_XTERM_MIN_HEIGHT_PX,
        )}px`;
        fitAddon.fit();
      }
      term.reset();
      if (writeText.length > 0) {
        term.write(writeText, afterWrite);
      } else {
        afterWrite();
      }
    }
    writtenDisplayRef.current = nextDisplay;
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
