import { useState } from "react";
import { useTranslation } from "react-i18next";

import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { DESKTOP_GIT_ACTION_BTN, instantHoverMotionClass } from "@/lib/desktop-chrome";
import { cn } from "@/lib/utils";
import type { GitClapAction, SubmitGitClapRequest } from "@/types";

export type GitClapPopoverProps = {
  action: GitClapAction;
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  triggerTitle?: string;
  onSubmit(request: SubmitGitClapRequest): Promise<boolean>;
};

export function GitClapPopover({
  action,
  disabled = false,
  busy = false,
  className,
  triggerTitle,
  onSubmit,
}: GitClapPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [extraNote, setExtraNote] = useState("");

  const label = t(`gitClap.display.${action}`);

  const handleSend = async () => {
    const trimmed = extraNote.trim();
    const ok = await onSubmit({
      action,
      ...(trimmed ? { extraNote: trimmed } : {}),
    });
    if (ok) {
      setExtraNote("");
      setOpen(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!busy) {
          setOpen(next);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="default"
          size="xs"
          className={cn(DESKTOP_GIT_ACTION_BTN, instantHoverMotionClass, className)}
          disabled={disabled || busy}
          title={triggerTitle}
        >
          {busy ? <LoaderCircle className="size-3 animate-spin" aria-hidden /> : null}
          <span>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <p className="mb-2 text-sm font-medium text-foreground">{t(`gitClap.heading.${action}`)}</p>
        <Textarea
          value={extraNote}
          onChange={(event) => setExtraNote(event.target.value)}
          placeholder={t("gitClap.extraNotePlaceholder")}
          className="min-h-16 resize-none text-sm"
          disabled={busy}
          autoComplete="off"
        />
        <div className="mt-2 flex justify-end">
          <Button type="button" size="sm" disabled={busy} onClick={() => void handleSend()}>
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
            {t("gitClap.send")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
