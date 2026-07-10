import { SpiritGlassLogoShimmer } from "@/components/spirit-glass-logo-shimmer";
import {
  SPIRIT_GLASS_LOGO_OPTICAL_OFFSET_FRACTION,
  SPIRIT_GLASS_LOGO_VIEWBOX,
} from "@/components/spirit-glass-logo";
import type { VoiceChatPhase } from "@/lib/voice-chat-phase";
import { cn } from "@/lib/utils";

export type VoiceOrbProps = {
  className?: string;
  sizePx?: number;
  phase?: VoiceChatPhase;
};

/** Temporary placeholder orb until realtime voice visuals ship. */
export function VoiceOrb({ className, sizePx = 240, phase = "idle" }: VoiceOrbProps) {
  const logoWidth = Math.round(sizePx * 0.3);
  const logoHeight = Math.round(
    (logoWidth * SPIRIT_GLASS_LOGO_VIEWBOX.height) / SPIRIT_GLASS_LOGO_VIEWBOX.width,
  );
  const opticalOffsetX = logoWidth * SPIRIT_GLASS_LOGO_OPTICAL_OFFSET_FRACTION.x;
  const opticalOffsetY = logoHeight * SPIRIT_GLASS_LOGO_OPTICAL_OFFSET_FRACTION.y;
  const shimmer = phase === "speaking";

  return (
    <div
      data-testid="voice-orb"
      data-voice-orb-phase={phase}
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/45 bg-muted/20 transition-colors duration-200",
        className,
      )}
      style={{ width: sizePx, height: sizePx }}
    >
      <SpiritGlassLogoShimmer
        width={logoWidth}
        shimmer={shimmer}
        style={{
          transform: `translate(${opticalOffsetX}px, ${opticalOffsetY}px)`,
        }}
      />
    </div>
  );
}
