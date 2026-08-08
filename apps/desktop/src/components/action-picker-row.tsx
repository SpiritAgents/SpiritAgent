import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { DESKTOP_COMMAND_PALETTE_ITEM_TONE } from "@/lib/desktop-chrome";
import { DESKTOP_LIST_ITEM_PRIMARY_CLASS } from "@/lib/desktop-typography";
import { cn } from "@/lib/utils";
import { isNewSessionAction, type ActionPaletteItem } from "@/lib/action-palette";
import { SLASH_SUGGESTION_ICONS } from "@/lib/slash-command-icons";
import type { SkillSlashSuggestionKind } from "@/lib/skill-slash";

type ActionPickerRowProps = {
  item: ActionPaletteItem;
};

function SlashCommandIcon({ kind }: { kind: SkillSlashSuggestionKind }) {
  const Icon = SLASH_SUGGESTION_ICONS[kind];
  return <Icon className={cn("size-3.5 shrink-0", DESKTOP_COMMAND_PALETTE_ITEM_TONE)} aria-hidden />;
}

const actionPickerPrimaryTitleClass = cn(
  "shrink-0 whitespace-nowrap leading-6",
  DESKTOP_COMMAND_PALETTE_ITEM_TONE,
  DESKTOP_LIST_ITEM_PRIMARY_CLASS,
  "text-popover-foreground",
);

export function ActionPickerRow({ item }: ActionPickerRowProps) {
  const { t } = useTranslation();

  if (isNewSessionAction(item)) {
    return (
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        <Plus className={cn("size-3.5 shrink-0", DESKTOP_COMMAND_PALETTE_ITEM_TONE)} aria-hidden />
        <span className={actionPickerPrimaryTitleClass}>{t(item.labelKey)}</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2 overflow-hidden">
      <SlashCommandIcon kind={item.kind} />
      <span className={actionPickerPrimaryTitleClass}>{item.paletteName ?? item.name}</span>
    </div>
  );
}
