import { useEffect, type MutableRefObject } from "react";

import type { SessionSidebarChromeApi } from "@/contexts/session-sidebar-chrome-context";
import type { useDesktopRuntime } from "@/hooks/useDesktopRuntime";
import { resolveModelPickerToOpen } from "@/lib/model-picker-shortcut-bridge";
import {
  desktopShellPlatform,
  isModAltShortcutPressed,
  isModShortcutPressed,
} from "@/lib/desktop-shell";
import type { AppSurface } from "@/hooks/useAppSurfaceNavigation";

type DesktopRuntime = ReturnType<typeof useDesktopRuntime>;

export type UseDesktopKeyboardShortcutsOptions = {
  runtime: DesktopRuntime;
  activeSurfaceRef: MutableRefObject<AppSurface>;
  conversationAbortShortcutEligibleRef: MutableRefObject<boolean>;
  sessionSidebarChromeApiRef: MutableRefObject<SessionSidebarChromeApi | null>;
  setWorkspaceToolsOpen: (updater: boolean | ((current: boolean) => boolean)) => void;
  handleNewSession: () => void;
  setActionPickerOpen: (open: boolean) => void;
  setFilePickerOpen: (open: boolean) => void;
};

export function useDesktopKeyboardShortcuts({
  runtime,
  activeSurfaceRef,
  conversationAbortShortcutEligibleRef,
  sessionSidebarChromeApiRef,
  setWorkspaceToolsOpen,
  handleNewSession,
  setActionPickerOpen,
  setFilePickerOpen,
}: UseDesktopKeyboardShortcutsOptions) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (!isModShortcutPressed(event) || event.key !== "/") {
        return;
      }
      const picker = resolveModelPickerToOpen();
      if (!picker) {
        return;
      }
      event.preventDefault();
      picker.open();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.altKey) {
        return;
      }
      if (!isModShortcutPressed(event) || event.key.toLowerCase() !== "b") {
        return;
      }
      event.preventDefault();
      sessionSidebarChromeApiRef.current?.toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sessionSidebarChromeApiRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (!isModAltShortcutPressed(event)) {
        return;
      }
      if (event.code !== "KeyB") {
        return;
      }
      if (activeSurfaceRef.current !== "conversation") {
        return;
      }
      event.preventDefault();
      setWorkspaceToolsOpen((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSurfaceRef, setWorkspaceToolsOpen]);

  // Physical Ctrl+C — abort the in-flight turn; composer may still have draft text.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return;
      }
      if (event.code !== "KeyC") {
        return;
      }
      if (activeSurfaceRef.current !== "conversation") {
        return;
      }
      if (!conversationAbortShortcutEligibleRef.current) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest(".workspace-shell-xterm, .xterm, .monaco-editor")) {
        return;
      }
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          (target.isContentEditable &&
            !target.closest("[data-spirit-surface='composer-surface']")))
      ) {
        return;
      }
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        return;
      }
      event.preventDefault();
      void runtime.abortConversation();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSurfaceRef, conversationAbortShortcutEligibleRef, runtime.abortConversation]);

  // Cmd/Ctrl+N — global new session (macOS menu accelerator handles this; skip here).
  useEffect(() => {
    if (desktopShellPlatform() === "darwin") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (!isModShortcutPressed(event) || event.key.toLowerCase() !== "n") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      event.preventDefault();
      handleNewSession();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNewSession]);

  useEffect(() => {
    const bridge = window.spiritDesktop;
    if (!bridge?.subscribeNewSession) {
      return;
    }
    return bridge.subscribeNewSession(handleNewSession);
  }, [handleNewSession]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (!isModShortcutPressed(event) || event.key.toLowerCase() !== "p") {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) {
        setActionPickerOpen(true);
        return;
      }
      setFilePickerOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setActionPickerOpen, setFilePickerOpen]);
}
