import { DesktopMacTrafficLights } from "@/components/desktop-mac-traffic-lights";
import { LandingEditorCodePane } from "@/components/landing-editor-code-pane";
import { LandingEditorFileTree } from "@/components/landing-editor-file-tree";
import { COMPLETION_DEMO_FILE_TREE } from "@/lib/landing-code-completion-demo-script";
import { cn } from "@/lib/utils";

type LandingEditorShellProps = {
  active: boolean;
  solidText: string;
  ghostText: string | null;
  resetFading?: boolean;
  className?: string;
};

export function LandingEditorShell({
  active,
  solidText,
  ghostText,
  resetFading = false,
  className,
}: LandingEditorShellProps) {
  return (
    <div
      className={cn(
        "relative isolate flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[10px] border border-white/12 bg-[#000000] shadow-[0_24px_64px_rgba(0,0,0,0.48)] ring-1 ring-black/35",
        className,
      )}
    >
      <DesktopMacTrafficLights />
      <div className="h-8 shrink-0 border-b border-white/8 bg-[#000000]" aria-hidden />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <LandingEditorFileTree root={COMPLETION_DEMO_FILE_TREE} />
        <LandingEditorCodePane
          active={active}
          solidText={solidText}
          ghostText={ghostText}
          resetFading={resetFading}
        />
      </div>
    </div>
  );
}
