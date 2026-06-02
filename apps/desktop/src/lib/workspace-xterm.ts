import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";

import { configureWorkspaceTerminalLinks } from "@/lib/workspace-terminal-links";
import {
  readTerminalThemeFromDocument,
  trackTerminalTheme,
} from "@/lib/workspace-terminal-theme";

/** Windows 上优先系统 Cascadia / Consolas；不把 webfont 置于栈首，以免覆盖已安装的系统等宽字体。 */
export const WORKSPACE_TERMINAL_FONT_FAMILY =
  '"Cascadia Code", "Cascadia Mono", Consolas, "Lucida Console", "Courier New", monospace';

const WORKSPACE_TERMINAL_FONT_SIZE = 14;
const WORKSPACE_TERMINAL_LINE_HEIGHT = 1;
const WORKSPACE_TERMINAL_LETTER_SPACING = 0;

/** 在 open + fit 之后加载 WebGL；失败或上下文丢失时回退默认渲染器。 */
export function loadWorkspaceTerminalWebgl(term: Terminal): void {
  try {
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => {
      console.warn("[workspace-xterm] WebGL context lost; falling back to default renderer.");
      webgl.dispose();
    });
    term.loadAddon(webgl);
  } catch (error) {
    console.warn("[workspace-xterm] WebGL addon failed to load; using default renderer.", error);
  }
}

/** 有选区：复制；无选区：粘贴（与常见集成终端一致，不弹出菜单）。 */
function writeClipboard(text: string): void {
  const b = window.spiritDesktop;
  if (b?.writeClipboardText) {
    b.writeClipboardText(text);
    return;
  }
  void navigator.clipboard.writeText(text);
}

function readClipboardSync(): string | null {
  const b = window.spiritDesktop;
  if (b?.readClipboardText) {
    try {
      return b.readClipboardText();
    } catch {
      return null;
    }
  }
  return null;
}

export type WorkspaceTerminalPtyBridge = Pick<
  NonNullable<typeof window.spiritDesktop>,
  "ptyCreate" | "ptyWrite" | "ptyResize" | "ptyKill" | "ptySubscribe"
>;

export type CreateWorkspaceTerminalOptions = {
  container: HTMLElement;
  cwd: string;
  bridge: WorkspaceTerminalPtyBridge;
  onTitleChange?: (title: string | undefined) => void;
  onEmbedError: (message: string) => void;
  shellExitedMessage: (exitCode: number) => string;
};

export type WorkspaceTerminalSession = {
  terminal: Terminal;
  fitAddon: FitAddon;
  dispose: () => void;
};

export function createWorkspaceTerminalSession(
  options: CreateWorkspaceTerminalOptions,
): WorkspaceTerminalSession {
  const { container, cwd, bridge, onTitleChange, onEmbedError, shellExitedMessage } = options;

  let termDisposed = false;
  let ptyId: string | undefined;
  let ro: ResizeObserver | undefined;
  let unsubPty: (() => void) | undefined;
  let sessionAlive = true;
  let activePtyId: string | null = null;
  let untrackTheme: (() => void) | undefined;

  const term = new Terminal({
    cursorBlink: true,
    fontSize: WORKSPACE_TERMINAL_FONT_SIZE,
    lineHeight: WORKSPACE_TERMINAL_LINE_HEIGHT,
    letterSpacing: WORKSPACE_TERMINAL_LETTER_SPACING,
    fontFamily: WORKSPACE_TERMINAL_FONT_FAMILY,
    fontWeight: "normal",
    theme: readTerminalThemeFromDocument(),
    scrollback: 8000,
  });
  untrackTheme = trackTerminalTheme(term);
  configureWorkspaceTerminalLinks(term);

  term.onTitleChange((title) => {
    onTitleChange?.(title || undefined);
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(container);
  fitAddon.fit();
  loadWorkspaceTerminalWebgl(term);

  const onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const sel = term.getSelection();
    if (sel.length > 0) {
      writeClipboard(sel);
      term.clearSelection();
      return;
    }
    const sync = readClipboardSync();
    if (sync != null) {
      term.paste(sync);
      return;
    }
    void navigator.clipboard.readText().then((text) => {
      if (text) {
        term.paste(text);
      }
    });
  };
  container.addEventListener("contextmenu", onContextMenu, true);

  unsubPty = bridge.ptySubscribe({
    onData: (payload) => {
      if (payload.id === activePtyId) {
        term.write(payload.data);
      }
    },
    onExit: (payload) => {
      if (payload.id === activePtyId) {
        term.write(`\r\n\x1b[90m[${shellExitedMessage(payload.exitCode)}]\x1b[0m\r\n`);
        activePtyId = null;
      }
    },
  });

  const disposeTerminal = (): void => {
    if (termDisposed) {
      return;
    }
    termDisposed = true;
    untrackTheme?.();
    untrackTheme = undefined;
    term.dispose();
  };

  const teardown = (): void => {
    sessionAlive = false;
    container.removeEventListener("contextmenu", onContextMenu, true);
    unsubPty?.();
    unsubPty = undefined;
    ro?.disconnect();
    ro = undefined;
    if (ptyId) {
      void bridge.ptyKill(ptyId);
      ptyId = undefined;
    }
    disposeTerminal();
    activePtyId = null;
  };

  void (async () => {
    const created = await bridge.ptyCreate({
      cwd,
      cols: term.cols,
      rows: term.rows,
    });

    if (!sessionAlive) {
      if (created.ok) {
        void bridge.ptyKill(created.id);
      }
      container.removeEventListener("contextmenu", onContextMenu, true);
      unsubPty?.();
      ro?.disconnect();
      disposeTerminal();
      activePtyId = null;
      return;
    }

    if (!created.ok) {
      onEmbedError(created.error);
      teardown();
      return;
    }

    ptyId = created.id;
    activePtyId = created.id;
    term.onData((data) => {
      bridge.ptyWrite(created.id, data);
    });

    ro = new ResizeObserver(() => {
      fitAddon.fit();
      bridge.ptyResize(created.id, term.cols, term.rows);
    });
    ro.observe(container);

    queueMicrotask(() => {
      if (sessionAlive) {
        term.focus();
      }
    });
  })();

  return {
    terminal: term,
    fitAddon,
    dispose: teardown,
  };
}
