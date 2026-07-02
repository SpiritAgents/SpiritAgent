import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { LoaderCircle, PanelRightClose, PanelRightOpen, Pencil, Plus, MoreHorizontal, SquareSplitHorizontal, SquareSplitVertical, Trash2, X } from "lucide-react";

import {
  NewSessionShortcutKbd,
  WorkspaceToolsShortcutKbd,
} from "@/components/layout/desktop-shortcut-kbds";
import { SessionSidebarToggleButton } from "@/components/layout/session-sidebar-toggle-button";
import { SessionChromeBreadcrumb } from "@/components/session-chrome-breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogFooterActions,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSessionSidebarChrome } from "@/contexts/session-sidebar-chrome-context";
import { useWorkspaceToolsChrome } from "@/contexts/workspace-tools-chrome-context";
import {
  DESKTOP_CHROME_TOGGLE_ICON_BTN,
  DESKTOP_OVERLAY_SHORT_LIST_PADDING,
  DESKTOP_OVERLAY_SHORT_MENU_MIN_WIDTH,
  DESKTOP_SHELL_LAYOUT_TRANSITION,
} from "@/lib/desktop-chrome";
import { desktopMicaTintClass } from "@/lib/desktop-mica-surface";
import { isDarwinElectronShell } from "@/lib/desktop-shell";
import { runAfterRadixOverlayClose } from "@/lib/overlay-motion";
import { useDarwinWindowFullscreen } from "@/hooks/useDarwinWindowFullscreen";
import { cn } from "@/lib/utils";

function isPaneDragBlockedTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element
    && Boolean(target.closest('button, a, input, textarea, select, [role="menuitem"], [data-no-pane-drag]'))
  );
}

export function DesktopLayoutChromeBar({
  useMicaBackdrop,
  showSessionSidebarToggle = true,
  showWorkspaceToggle,
  showSplitMenu = false,
  showClosePane = false,
  sessionTitle,
  subagentPromptText,
  onExitSubagentViewer,
  onNewSession,
  newSessionBusy = false,
  onSplit,
  onSplitVertical,
  onClosePane,
  paneId,
  onPaneDragStart,
  onPaneDragEnter,
  onPaneDragLeave,
  onPaneDrop,
  showDeleteSession = false,
  deleteSessionDisplayName,
  deleteSessionPath,
  deleteSessionBusy = false,
  conversationBusy = false,
  onDeleteSession,
  onDeleteSessionOverlayClosed,
  showRenameSession = false,
  renameSessionPath,
  renameSessionDisplayName,
  renameSessionBusy = false,
  onRenameSession,
}: {
  useMicaBackdrop: boolean;
  showSessionSidebarToggle?: boolean;
  showWorkspaceToggle: boolean;
  showSplitMenu?: boolean;
  showClosePane?: boolean;
  sessionTitle?: string | null;
  subagentPromptText?: string | null;
  onExitSubagentViewer?: () => void;
  onNewSession?: () => void;
  newSessionBusy?: boolean;
  onSplit?: () => void;
  onSplitVertical?: () => void;
  onClosePane?: () => void;
  paneId?: string;
  onPaneDragStart?: (paneId: string) => void;
  onPaneDragEnter?: (paneId: string, zone: import("@/lib/conversation-split-layout").PaneRepositionZone) => void;
  onPaneDragLeave?: () => void;
  onPaneDrop?: (paneId: string, zone: import("@/lib/conversation-split-layout").PaneRepositionZone) => void;
  showDeleteSession?: boolean;
  deleteSessionDisplayName?: string | null;
  deleteSessionPath?: string | null;
  deleteSessionBusy?: boolean;
  conversationBusy?: boolean;
  onDeleteSession?: (path: string) => void | Promise<void>;
  onDeleteSessionOverlayClosed?: () => void | Promise<void>;
  showRenameSession?: boolean;
  renameSessionPath?: string | null;
  renameSessionDisplayName?: string | null;
  renameSessionBusy?: boolean;
  onRenameSession?: (path: string, displayName: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const { open: sessionSidebarOpen } = useSessionSidebarChrome();
  const { open: workspaceToolsOpen, toggle: onToggleWorkspaceTools } = useWorkspaceToolsChrome();
  const darwinElectron = isDarwinElectronShell();
  const darwinFullScreen = useDarwinWindowFullscreen(darwinElectron);
  const pinSidebarToggleOnDarwin = darwinElectron && !darwinFullScreen;
  const showTrailingActions = showWorkspaceToggle || showSplitMenu;
  const trimmedSessionTitle = sessionTitle?.trim() ?? "";
  const paneDragEnabled = Boolean(paneId && onPaneDragStart);
  const [deleteSessionDialogOpen, setDeleteSessionDialogOpen] = useState(false);
  const [renamingTitle, setRenamingTitle] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renameCommitInFlightRef = useRef(false);
  const pendingRenameFocusRef = useRef(false);
  const trimmedDeleteSessionPath = deleteSessionPath?.trim() ?? "";
  const trimmedDeleteSessionDisplayName = deleteSessionDisplayName?.trim() ?? "";
  const trimmedRenameSessionPath = renameSessionPath?.trim() ?? "";
  const trimmedRenameSessionDisplayName = renameSessionDisplayName?.trim() ?? "";
  const trimmedSubagentPromptText = subagentPromptText?.trim() ?? "";
  const canRenameTitle =
    showRenameSession
    && Boolean(onRenameSession)
    && Boolean(trimmedRenameSessionPath)
    && !trimmedSubagentPromptText;

  const handleRenameCancel = useCallback(() => {
    setRenamingTitle(false);
    setRenameValue("");
  }, []);

  const handleRenameStart = useCallback(() => {
    if (renameSessionBusy || conversationBusy || !canRenameTitle) {
      return;
    }
    setRenamingTitle(true);
    setRenameValue(trimmedSessionTitle || trimmedRenameSessionDisplayName);
  }, [
    canRenameTitle,
    conversationBusy,
    renameSessionBusy,
    trimmedRenameSessionDisplayName,
    trimmedSessionTitle,
  ]);

  const handleRenameCommit = useCallback(async () => {
    if (renameCommitInFlightRef.current) {
      return;
    }
    if (!renamingTitle || !onRenameSession || !trimmedRenameSessionPath) {
      handleRenameCancel();
      return;
    }
    const trimmed = renameValue.trim();
    const currentName = trimmedSessionTitle || trimmedRenameSessionDisplayName;
    if (!trimmed || trimmed === currentName) {
      handleRenameCancel();
      return;
    }
    renameCommitInFlightRef.current = true;
    try {
      await onRenameSession(trimmedRenameSessionPath, trimmed);
      handleRenameCancel();
    } catch {
      // Runtime error banner handles host failures.
    } finally {
      renameCommitInFlightRef.current = false;
    }
  }, [
    handleRenameCancel,
    onRenameSession,
    renameValue,
    renamingTitle,
    trimmedRenameSessionDisplayName,
    trimmedRenameSessionPath,
    trimmedSessionTitle,
  ]);

  useEffect(() => {
    handleRenameCancel();
  }, [handleRenameCancel, trimmedRenameSessionPath]);

  const dismissDeleteSessionDialog = useCallback((afterClose?: () => void) => {
    setDeleteSessionDialogOpen(false);
    runAfterRadixOverlayClose(() => {
      afterClose?.();
    });
  }, []);

  return (
    <div
      role="toolbar"
      aria-label={t('app.sidebarAndTools')}
      data-spirit-surface="layout-chrome"
      data-session-sidebar-open={sessionSidebarOpen ? "true" : "false"}
      data-pane-id={paneId}
      draggable={paneDragEnabled}
      onDragStart={(event) => {
        if (!paneDragEnabled || !paneId || !onPaneDragStart) {
          return;
        }
        if (isPaneDragBlockedTarget(event.target)) {
          event.preventDefault();
          return;
        }
        onPaneDragStart(paneId);
      }}
      onDragEnd={() => onPaneDragLeave?.()}
      className={cn(
        "flex h-8 shrink-0 items-center gap-2 px-2",
        showTrailingActions ? "justify-between" : "justify-start",
        desktopMicaTintClass(useMicaBackdrop),
        paneDragEnabled && "cursor-grab active:cursor-grabbing",
      )}
      onDragOver={(event) => {
        if (!paneId || !onPaneDrop) {
          return;
        }
        event.preventDefault();
      }}
    >
      <div className="flex min-w-0 flex-1 items-center">
        {showSessionSidebarToggle ? (
          pinSidebarToggleOnDarwin ? (
            <div data-darwin-pinned-sidebar-toggle>
              <SessionSidebarToggleButton />
            </div>
          ) : (
            <SessionSidebarToggleButton className="mr-1" />
          )
        ) : null}
        {showSessionSidebarToggle && pinSidebarToggleOnDarwin ? (
          <div
            className={cn(
              "shrink-0 overflow-hidden",
              DESKTOP_SHELL_LAYOUT_TRANSITION,
              sessionSidebarOpen ? "mr-0 w-0" : "mr-1 w-7",
            )}
            aria-hidden
          />
        ) : null}
        {onNewSession && showSessionSidebarToggle ? (
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
        {trimmedSessionTitle || renamingTitle ? (
          <SessionChromeBreadcrumb
            sessionTitle={trimmedSessionTitle || trimmedRenameSessionDisplayName}
            subagentPromptText={subagentPromptText}
            onExitSubagentViewer={onExitSubagentViewer}
            renaming={renamingTitle}
            renameValue={renameValue}
            onRenameValueChange={setRenameValue}
            onRenameCommit={() => void handleRenameCommit()}
            onRenameCancel={handleRenameCancel}
            onRenameStart={canRenameTitle ? handleRenameStart : undefined}
          />
        ) : null}
      </div>
      {showTrailingActions ? (
        <div className="flex shrink-0 items-center gap-1" data-no-pane-drag>
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
              <DropdownMenuContent
                align="end"
                className={cn(DESKTOP_OVERLAY_SHORT_MENU_MIN_WIDTH, "p-0")}
                onCloseAutoFocus={(event) => {
                  if (!pendingRenameFocusRef.current) {
                    return;
                  }
                  event.preventDefault();
                  pendingRenameFocusRef.current = false;
                }}
              >
                <div className={DESKTOP_OVERLAY_SHORT_LIST_PADDING}>
                  <DropdownMenuItem
                    className="gap-1.5"
                    onSelect={() => onSplit?.()}
                  >
                    <SquareSplitHorizontal className="size-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
                    <span>{t("app.splitRight")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-1.5"
                    onSelect={() => onSplitVertical?.()}
                  >
                    <SquareSplitVertical className="size-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
                    <span>{t("app.splitDown")}</span>
                  </DropdownMenuItem>
                  {showClosePane ? (
                    <DropdownMenuItem
                      className="gap-1.5"
                      onSelect={() => onClosePane?.()}
                    >
                      <X className="size-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
                      <span>{t("app.closePane")}</span>
                    </DropdownMenuItem>
                  ) : null}
                </div>
                {canRenameTitle ? (
                  <>
                    <DropdownMenuSeparator />
                    <div className={DESKTOP_OVERLAY_SHORT_LIST_PADDING}>
                      <DropdownMenuItem
                        className="gap-1.5"
                        disabled={renameSessionBusy || conversationBusy}
                        title={conversationBusy ? t("sidebar.cannotRenameBusySession") : undefined}
                        onSelect={() => {
                          pendingRenameFocusRef.current = true;
                          handleRenameStart();
                        }}
                      >
                        <Pencil className="size-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
                        <span>{t("sidebar.renameSession")}</span>
                      </DropdownMenuItem>
                    </div>
                  </>
                ) : null}
                {showDeleteSession && onDeleteSession && trimmedDeleteSessionPath ? (
                  <>
                    <DropdownMenuSeparator />
                    <div className={DESKTOP_OVERLAY_SHORT_LIST_PADDING}>
                      <DropdownMenuItem
                        variant="destructive"
                        className="gap-1.5"
                        disabled={deleteSessionBusy || conversationBusy}
                        title={conversationBusy ? t("sidebar.cannotDeleteBusySession") : undefined}
                        onSelect={() => {
                          setDeleteSessionDialogOpen(true);
                        }}
                      >
                        <Trash2 className="size-3.5 shrink-0" aria-hidden />
                        <span>{t("common.delete")}</span>
                      </DropdownMenuItem>
                    </div>
                  </>
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
      <Dialog
        open={deleteSessionDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setDeleteSessionDialogOpen(true);
          } else if (!deleteSessionBusy) {
            dismissDeleteSessionDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!deleteSessionBusy}>
          <DialogHeader>
            <DialogTitle>{t("sidebar.deleteSession")}</DialogTitle>
            <DialogDescription>
              {t("sidebar.deleteSessionConfirm", { name: trimmedDeleteSessionDisplayName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogFooterActions>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!deleteSessionBusy) {
                    dismissDeleteSessionDialog();
                  }
                }}
                disabled={deleteSessionBusy}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleteSessionBusy || !trimmedDeleteSessionPath || !onDeleteSession}
                onClick={() => {
                  if (!onDeleteSession) {
                    return;
                  }
                  void (async () => {
                    try {
                      await onDeleteSession(trimmedDeleteSessionPath);
                      dismissDeleteSessionDialog(() => {
                        void onDeleteSessionOverlayClosed?.();
                      });
                    } catch {
                      // Keep dialog open; runtime surfaces the error.
                    }
                  })();
                }}
              >
                {deleteSessionBusy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
                {t("common.delete")}
              </Button>
            </DialogFooterActions>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
