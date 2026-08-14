import { createContext, useContext, type ReactNode } from "react";

type DesktopPreviewDensity = "default" | "nested";

const DesktopPreviewDensityContext = createContext<DesktopPreviewDensity>("default");

export function DesktopPreviewDensityProvider({
  nested,
  children,
}: {
  nested?: boolean;
  children: ReactNode;
}) {
  return (
    <DesktopPreviewDensityContext.Provider value={nested ? "nested" : "default"}>
      {children}
    </DesktopPreviewDensityContext.Provider>
  );
}

export function useDesktopPreviewDensity(): DesktopPreviewDensity {
  return useContext(DesktopPreviewDensityContext);
}

export function isNestedDesktopPreview(density: DesktopPreviewDensity): boolean {
  return density === "nested";
}
