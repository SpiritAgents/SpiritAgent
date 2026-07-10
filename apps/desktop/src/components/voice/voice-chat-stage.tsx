import { useTranslation } from "react-i18next";
import { MicOff, PhoneOff } from "lucide-react";

import { VoiceOrb } from "@/components/voice/voice-orb";
import { Button } from "@/components/ui/button";
import type { VoiceChatPhase } from "@/lib/voice-chat-phase";
import { cn } from "@/lib/utils";

export type VoiceChatStageProps = {
  active: boolean;
  phase?: VoiceChatPhase;
  onEnd: () => void;
  className?: string;
};

export type { VoiceChatPhase };

export function VoiceChatStage({
  active,
  phase = "idle",
  onEnd,
  className,
}: VoiceChatStageProps) {
  const { t } = useTranslation();

  if (!active) {
    return null;
  }

  return (
    <div
      data-spirit-surface="voice-chat-stage"
      data-testid="voice-chat-stage"
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center bg-transparent",
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6">
        <VoiceOrb phase={phase} />
        <p className="text-sm text-muted-foreground" data-testid="voice-chat-status">
          {phase === "listening"
            ? t("voice.statusListening")
            : phase === "speaking"
              ? t("voice.statusSpeaking")
              : t("voice.statusIdle")}
        </p>
      </div>

      <div className="flex w-full max-w-sm items-center justify-center gap-3 px-6 pb-8">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 rounded-full"
          disabled
          aria-label={t("voice.mute")}
        >
          <MicOff className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="min-w-32 rounded-full"
          onClick={onEnd}
          data-testid="voice-chat-end"
        >
          <PhoneOff className="size-4" aria-hidden />
          {t("voice.end")}
        </Button>
      </div>
    </div>
  );
}
