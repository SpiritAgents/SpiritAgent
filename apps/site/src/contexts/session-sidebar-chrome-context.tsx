import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { readSessionSidebarWidthPx } from "@/lib/layout-prefs";

type SessionSidebarChromeContextValue = {
  open: boolean;
  widthPx: number;
  setWidthPx(next: number): void;
  toggle(): void;
  openSidebar(): void;
};

const SessionSidebarChromeContext = createContext<SessionSidebarChromeContextValue | null>(null);

export type SessionSidebarChromeApi = {
  open: boolean;
  openSidebar(): void;
  toggle(): void;
};

export type SessionSidebarChromeProviderProps = {
  children: ReactNode;
  apiRef?: React.MutableRefObject<SessionSidebarChromeApi | null>;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialWidthPx?: number;
};

export function SessionSidebarChromeProvider({
  children,
  apiRef,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  initialWidthPx,
}: SessionSidebarChromeProviderProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [onOpenChange, openProp],
  );

  const [widthPx, setWidthPxState] = useState(() => initialWidthPx ?? readSessionSidebarWidthPx());

  const setWidthPx = useCallback((next: number) => {
    setWidthPxState(next);
  }, []);

  const toggle = useCallback(() => {
    setOpen(!open);
  }, [open, setOpen]);

  const openSidebar = useCallback(() => {
    setOpen(true);
  }, [setOpen]);

  useEffect(() => {
    if (apiRef) {
      apiRef.current = { open, openSidebar, toggle };
    }
  }, [apiRef, open, openSidebar, toggle]);

  const value = useMemo(
    () => ({
      open,
      widthPx,
      setWidthPx,
      toggle,
      openSidebar,
    }),
    [open, openSidebar, setWidthPx, toggle, widthPx],
  );

  return (
    <SessionSidebarChromeContext.Provider value={value}>
      {children}
    </SessionSidebarChromeContext.Provider>
  );
}

export function useSessionSidebarChrome(): SessionSidebarChromeContextValue {
  const value = useContext(SessionSidebarChromeContext);
  if (!value) {
    throw new Error("useSessionSidebarChrome must be used within SessionSidebarChromeProvider");
  }
  return value;
}
