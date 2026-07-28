import { useTranslation } from "react-i18next";

import { EditFileLineDeltaBadge } from "@/components/edit-file-line-delta-badge";
import { desktopComposerChipSurfaceClass } from "@/lib/desktop-mica-surface";
import type { EditFileLineDelta } from "@/lib/edit-file-line-delta";
import { cn } from "@/lib/utils";

export function ComposerChangesCard({
  delta,
  onOpenGitTab,
  useMicaBackdrop = false,
}: {
  delta: EditFileLineDelta;
  onOpenGitTab: () => void;
  useMicaBackdrop?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      data-spirit-surface="composer-changes-card"
      className={cn(
        "inline-flex h-7 min-h-7 cursor-pointer items-center gap-1 rounded-full px-2.5 leading-none",
        desktopComposerChipSurfaceClass(useMicaBackdrop),
      )}
      onClick={onOpenGitTab}
      aria-label={t("composer.changesAria")}
    >
      <span className="font-sans text-xs font-normal leading-none text-muted-foreground">{t("composer.changes")}</span>
      <EditFileLineDeltaBadge delta={delta} className="font-normal" />
    </button>
  );
}
