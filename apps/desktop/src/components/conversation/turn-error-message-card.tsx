import { TriangleAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function TurnErrorMessageCard({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  return (
    <div className={cn("w-full max-w-[min(28rem,100%)] py-1", className)}>
      <div
        className="flex items-center gap-3 overflow-hidden rounded-md border border-border/45 bg-muted/20 px-4 py-3"
        data-spirit-surface="turn-error-card"
      >
        <TriangleAlertIcon
          className="size-4 shrink-0 self-center text-foreground"
          aria-hidden
        />
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
          {trimmed}
        </p>
      </div>
    </div>
  );
}
