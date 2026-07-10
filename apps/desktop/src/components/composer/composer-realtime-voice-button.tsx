import { useTranslation } from "react-i18next";
import { AudioLines } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { instantHoverMotionClass } from "@/lib/desktop-chrome";
import { cn } from "@/lib/utils";

export type ComposerRealtimeVoiceButtonProps = {
  variant: "primary" | "ghost";
  onClick?: () => void;
};

export function ComposerRealtimeVoiceButton({
  variant,
  onClick,
}: ComposerRealtimeVoiceButtonProps) {
  const { t } = useTranslation();
  const ariaLabel = t("composer.realtimeVoice");

  const button = (
    <Button
      type="button"
      variant={variant === "ghost" ? "ghost" : "default"}
      className={cn(
        "shrink-0 rounded-full p-0 shadow-none",
        instantHoverMotionClass,
        variant === "primary"
          ? "size-7 [&_svg]:size-3"
          : "size-6 text-muted-foreground hover:bg-muted/50 hover:text-foreground [&_svg]:size-3",
      )}
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={
        variant === "primary"
          ? "composer-realtime-voice-primary"
          : "composer-realtime-voice-ghost"
      }
    >
      <AudioLines
        className="size-3"
        strokeWidth={variant === "primary" ? 2.25 : 2.15}
        aria-hidden
      />
    </Button>
  );

  return (
    <Tooltip delayDuration={300} disableHoverableContent>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {ariaLabel}
      </TooltipContent>
    </Tooltip>
  );
}
