import {
  SpiritDesktopWindow,
  type SpiritDesktopWindowProps,
} from "@/components/spirit-desktop-window";
import { useLandingSectionInView } from "@/hooks/use-landing-section-in-view";
import { cn } from "@/lib/utils";

type LandingVisibleDesktopWindowProps = SpiritDesktopWindowProps;

export function LandingVisibleDesktopWindow({
  className,
  viewportClassName,
  ...windowProps
}: LandingVisibleDesktopWindowProps) {
  const { ref, inView } = useLandingSectionInView();

  return (
    <div ref={ref} className={cn("w-full", viewportClassName)}>
      <SpiritDesktopWindow
        {...windowProps}
        demoPlaybackActive={inView}
        className={cn("h-full w-full max-w-none", className)}
        viewportClassName="h-full min-h-0"
      />
    </div>
  );
}
