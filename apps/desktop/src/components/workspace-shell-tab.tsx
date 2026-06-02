import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import "@xterm/xterm/css/xterm.css";

import { Button } from "@/components/ui/button";
import { createWorkspaceTerminalSession } from "@/lib/workspace-xterm";
import { cn } from "@/lib/utils";
import type { Terminal } from "@xterm/xterm";

export type WorkspaceShellTabProps = {
  workspaceRoot: string;
  /** 终端标题变化时通知父层（来自 OSC 0/2 序列）；无标题时传 undefined */
  onTitleChange?: (title: string | undefined) => void;
};

export function WorkspaceShellTab({ workspaceRoot, onTitleChange }: WorkspaceShellTabProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const bridge = typeof window !== "undefined" ? window.spiritDesktop : undefined;
  const canEmbed = Boolean(bridge?.ptyCreate);
  const trimmed = workspaceRoot.trim();
  const onTitleChangeRef = useRef(onTitleChange);
  useLayoutEffect(() => {
    onTitleChangeRef.current = onTitleChange;
  });

  useEffect(() => {
    setEmbedError(null);
    termRef.current = null;
    const b = typeof window !== "undefined" ? window.spiritDesktop : undefined;
    if (!trimmed || !b?.ptyCreate || !b.ptySubscribe) {
      return;
    }

    const el = containerRef.current;
    if (!el) {
      return;
    }

    const session = createWorkspaceTerminalSession({
      container: el,
      cwd: trimmed,
      bridge: b,
      onTitleChange: (title) => onTitleChangeRef.current?.(title),
      onEmbedError: setEmbedError,
      shellExitedMessage: (exitCode) => t("workspace.shellExited", { exitCode }),
    });
    termRef.current = session.terminal;

    return () => {
      session.dispose();
      termRef.current = null;
    };
  }, [trimmed, canEmbed, retryNonce, t]);

  const openExternal = (): void => {
    if (!bridge?.openSystemTerminal || !trimmed) {
      return;
    }
    void bridge.openSystemTerminal(trimmed);
  };

  if (!trimmed) {
    return <p className="text-muted-foreground">{t("workspace.openWorkspaceToUse")}</p>;
  }

  if (!canEmbed || !bridge?.openSystemTerminal) {
    return <p className="text-muted-foreground">{t("workspace.shellElectronOnly")}</p>;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
      {embedError ? (
        <div className="flex shrink-0 flex-col gap-2">
          <p className="text-xs text-destructive">{embedError}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEmbedError(null);
                setRetryNonce((n) => n + 1);
              }}
            >
              {t("common.retry")}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={openExternal}>
              {t("workspace.openSystemTerminal")}
            </Button>
          </div>
        </div>
      ) : null}
      <div
        ref={containerRef}
        className={cn(
          "workspace-shell-xterm min-h-0 min-w-0 flex-1 overflow-hidden rounded-md border border-border/40 bg-background",
          embedError ? "hidden" : "block",
        )}
      />
    </div>
  );
}
