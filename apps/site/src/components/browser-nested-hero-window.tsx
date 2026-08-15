import { SiteGradientBackground } from "@/components/site-gradient-background";
import { SpiritDesktopWindow } from "@/components/spirit-desktop-window";

export function BrowserNestedHeroWindow() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[3px] bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <SiteGradientBackground className="absolute inset-0 block h-full w-full" />
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-2 sm:p-2.5">
        <SpiritDesktopWindow
          nestedPreview
          className="relative z-10 min-h-0 w-full max-w-none flex-1"
          viewportClassName="h-full min-h-0"
          useMicaBackdrop
          heroBaseTone
          demoPlaybackActive={false}
          initialWorkspaceToolsOpen={false}
        />
      </div>
    </div>
  );
}
