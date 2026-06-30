import { useTranslation } from "react-i18next";

import { AgentsSettingsRow } from "@/components/settings/panels/agents-settings-panel";
import type { SettingsViewProps } from "@/components/settings/types";
import { Checkbox } from "@/components/ui/checkbox";

export function TabSettingsPanel({
  settings,
  onSavePatch,
}: Pick<SettingsViewProps, "settings" | "onSavePatch">) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("settings.tab")}</h1>

      <div className="divide-y divide-border/35 rounded-lg border border-border/40 bg-background/80 px-4 sm:px-5">
        <AgentsSettingsRow
          label={t("settings.editorTabCompletion")}
          description={t("settings.editorTabCompletionDescription")}
          htmlFor="settings-editor-tab-completion"
        >
          <div className="flex justify-end">
            <Checkbox
              id="settings-editor-tab-completion"
              checked={settings.codeCompletionEnabled}
              onCheckedChange={(value) => void onSavePatch({ codeCompletionEnabled: value === true })}
              className="size-5"
            />
          </div>
        </AgentsSettingsRow>
      </div>
    </div>
  );
}
