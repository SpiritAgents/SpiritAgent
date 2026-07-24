import { useTranslation } from "react-i18next";
import { Check, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogFooterActions,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  WorkspaceCapabilityTrustDecision,
  WorkspaceCapabilityTrustRequest,
} from "@/types";

export type WorkspaceCapabilityTrustDialogProps = {
  pending: WorkspaceCapabilityTrustRequest | undefined;
  busy?: boolean;
  onReply(decision: WorkspaceCapabilityTrustDecision): void;
};

export function WorkspaceCapabilityTrustDialog({
  pending,
  busy = false,
  onReply,
}: WorkspaceCapabilityTrustDialogProps) {
  const { t } = useTranslation();
  const open = pending !== undefined;

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={false}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("workspaceTrust.title")}</DialogTitle>
          <DialogDescription>{t("workspaceTrust.risk")}</DialogDescription>
        </DialogHeader>

        {pending?.hashChanged ? (
          <div
            role="status"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100"
          >
            {t("workspaceTrust.hooksChanged")}
          </div>
        ) : null}

        {pending ? (
          <div className="grid gap-1.5">
            <div className="text-xs font-medium text-muted-foreground">
              {t("workspaceTrust.hooksSection")}
            </div>
            <ScrollArea
              type="always"
              className="rounded-md border border-border/50 pr-3 [&>[data-radix-scroll-area-viewport]]:max-h-40"
            >
              <ul className="divide-y divide-border/40 px-2 py-1 text-xs">
                {pending.hooks.map((hook) => (
                  <li key={`${hook.event}:${hook.command}`} className="py-1.5">
                    <div className="font-medium text-foreground">{hook.event}</div>
                    <div className="break-all text-muted-foreground">{hook.command}</div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        ) : null}

        <DialogFooter>
          <DialogFooterActions>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onReply("deny")}
            >
              <X data-icon="inline-start" />
              {t("workspaceTrust.deny")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onReply("alwaysTrust")}
            >
              <ShieldCheck data-icon="inline-start" />
              {t("workspaceTrust.alwaysTrust")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => onReply("allowOnce")}
            >
              <Check data-icon="inline-start" />
              {t("workspaceTrust.allowOnce")}
            </Button>
          </DialogFooterActions>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
