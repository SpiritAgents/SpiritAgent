import { useTranslation } from "react-i18next";

import { PanelRightClose, PanelRightOpen, Plus, MoreHorizontal } from "lucide-react";

import {
  NewSessionShortcutKbd,
  WorkspaceToolsShortcutKbd,
} from "@/components/layout/desktop-shortcut-kbds";
import { SessionSidebarToggleButton } from "@/components/layout/session-sidebar-toggle-button";
import { SessionChromeBreadcrumb } from "@/components/session-chrome-breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSessionSidebarChrome } from "@/contexts/session-sidebar-chrome-context";
import { useWorkspaceToolsChrome } from "@/contexts/workspace-tools-chrome-context";
import {
  DESKTOP_CHROME_TOGGLE_ICON_BTN,
  DESKTOP_SHELL_LAYOUT_TRANSITION,
} from "@/lib/desktop-chrome";
import { desktopMicaTintClass } from "@/lib/desktop-mica-surface";
import { isDarwinElectronShell } from "@/lib/desktop-shell";
import { useDarwinWindowFullscreen } from "@/hooks/useDarwinWindowFullscreen";
import { cn } from "@/lib/utils";

export function DesktopLayoutChromeBar({
  useMicaBackdrop,
  showWorkspaceToggle,
  showSplitMenu = false,
  showClosePane = false,
  sessionTitle,
  subagentPromptText,
  onExitSubagentViewer,
  onNewSession,
  newSessionBusy = false,
  onSplit,
  onClosePane,
  paneId,
  onPaneDragStart,
  onPaneDragEnter,
  onPaneDragLeave,
  onPaneDrop,
}: {
  useMicaBackdrop: boolean;
  showWorkspaceToggle: boolean;
  showSplitMenu?: boolean;
  showClosePane?: boolean;
  sessionTitle?: string | null;
  subagentPromptText?: string | null;
  onExitSubagentViewer?: () => void;
  onNewSession?: () => void;
  newSessionBusy?: boolean;
  onSplit?: () => void;
  onClosePane?: () => void;
  paneId?: string;
  onPaneDragStart?: (paneId: string) => void;
  onPaneDragEnter?: (paneId: string, zone: import("@/lib/conversation-split-layout").PaneRepositionZone) => void;
  onPaneDragLeave?: () => void;
  onPaneDrop?: (paneId: string, zone: import("@/lib/conversation-split-layout").PaneRepositionZone) => void;
}) {
  const { t } = useTranslation();
  const { open: sessionSidebarOpen } = useSessionSidebarChrome();
  const { open: workspaceToolsOpen, toggle: onToggleWorkspaceTools } = useWorkspaceToolsChrome();
  const darwinElectron = isDarwinElectronShell();
  const darwinFullScreen = useDarwinWindowFullscreen(darwinElectron);
  const pinSidebarToggleOnDarwin = darwinElectron && !darwinFullScreen;
  const showTrailingActions = showWorkspaceToggle || showSplitMenu;
  const trimmedSessionTitle = sessionTitle?.trim() ?? "";
  return (
    <div
      role="toolbar"
      aria-label={t('app.sidebarAndTools')}
      data-spirit-surface="layout-chrome"
      data-session-sidebar-open={sessionSidebarOpen ? "true" : "false"}
      data-pane-id={paneId}
      className={cn(
        "flex h-8 shrink-0 items-center gap-2 px-1.5",
        showTrailingActions ? "justify-between" : "justify-start",
        desktopMicaTintClass(useMicaBackdrop),
      )}
      onDragOver={(event) => {
        if (!paneId || !onPaneDrop) {
          return;
        }
        event.preventDefault();
      }}
    >
      <div
        className="flex min-w-0 items-center"
        draggable={Boolean(paneId && onPaneDragStart)}
        onDragStart={() => {
          if (paneId && onPaneDragStart) {
            onPaneDragStart(paneId);
          }
        }}
        onDragEnd={() => onPaneDragLeave?.()}
      >
        {pinSidebarToggleOnDarwin ? (
          <div data-darwin-pinned-sidebar-toggle>
            <SessionSidebarToggleButton />
          </div>
        ) : (
          <SessionSidebarToggleButton className="mr-1" />
        )}
        {pinSidebarToggleOnDarwin ? (
          <div
            className={cn(
              "shrink-0 overflow-hidden",
              DESKTOP_SHELL_LAYOUT_TRANSITION,
              sessionSidebarOpen ? "mr-0 w-0" : "mr-1 w-7",
            )}
            aria-hidden
          />
        ) : null}
        {onNewSession ? (
          <div
            className={cn(
              "shrink-0 overflow-hidden",
              DESKTOP_SHELL_LAYOUT_TRANSITION,
              sessionSidebarOpen
                ? "pointer-events-none mr-0 w-0 opacity-0"
                : "mr-1 w-7 opacity-100",
            )}
            aria-hidden={sessionSidebarOpen}
          >
            <Tooltip delayDuration={300} disableHoverableContent>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={DESKTOP_CHROME_TOGGLE_ICON_BTN}
                  onClick={onNewSession}
                  disabled={newSessionBusy}
                  tabIndex={sessionSidebarOpen ? -1 : undefined}
                  aria-label={t("sidebar.newSession")}
                >
                  <Plus className="size-3.5" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                {t("sidebar.newSession")}{" "}
                <NewSessionShortcutKbd />
              </TooltipContent>
            </Tooltip>
          </div>
        ) : null}
        {trimmedSessionTitle ? (
          <SessionChromeBreadcrumb
            sessionTitle={trimmedSessionTitle}
            subagentPromptText={subagentPromptText}
            onExitSubagentViewer={onExitSubagentViewer}
          />
        ) : null}
      </div>
      {showTrailingActions ? (
        <div className="flex items-center gap-1">
          {showSplitMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={DESKTOP_CHROME_TOGGLE_ICON_BTN}
                  aria-label={t("app.conversationPaneMenu")}
                >
                  <MoreHorizontal className="size-3.5 text-muted-foreground" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40 p-0">
                <DropdownMenuItem
                  className="cursor-pointer rounded-none px-3 py-2 text-sm"
                  onSelect={() => onSplit?.()}
                >
                  {t("app.split")}
                </DropdownMenuItem>
                {showClosePane ? (
                  <DropdownMenuItem
                    className="cursor-pointer rounded-none px-3 py-2 text-sm"
                    onSelect={() => onClosePane?.()}
                  >
                    {t("app.closePane")}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {showWorkspaceToggle ? (
            <Tooltip delayDuration={300} disableHoverableContent>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={DESKTOP_CHROME_TOGGLE_ICON_BTN}
                  onClick={onToggleWorkspaceTools}
                  aria-label={workspaceToolsOpen ? t('app.collapseTools') : t('app.expandTools')}
                  aria-expanded={workspaceToolsOpen}
                  {...(workspaceToolsOpen ? { "aria-controls": "workspace-tools-panel" } : {})}
                >
                  {workspaceToolsOpen ? (
                    <PanelRightClose className="size-3.5" aria-hidden />
                  ) : (
                    <PanelRightOpen className="size-3.5" aria-hidden />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={4}>
                {workspaceToolsOpen ? t("app.collapseTools") : t("app.expandTools")}{" "}
                <WorkspaceToolsShortcutKbd />
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
