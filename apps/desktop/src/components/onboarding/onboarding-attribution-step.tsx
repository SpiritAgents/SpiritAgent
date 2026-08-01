import { useTranslation } from "react-i18next";

import type { SettingsFormState } from "@/components/settings/types";
import { Switch } from "@/components/ui/switch";
import { DESKTOP_SETTINGS_LABEL_CLASS } from "@/lib/desktop-typography";

type OnboardingAttributionControlsProps = {
  settings: SettingsFormState;
  onSavePatch: (patch: Partial<SettingsFormState>) => Promise<void>;
};

/**
 * OOBE Attribution 步骤内容：Commit / PR 署名开关。
 * 默认开启；与设置页共用同一保存链路，无卡片包裹。
 */
export function OnboardingAttributionControls({
  settings,
  onSavePatch,
}: OnboardingAttributionControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex w-full max-w-md flex-col gap-7">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <label htmlFor="onboarding-commit-attribution" className={DESKTOP_SETTINGS_LABEL_CLASS}>
            {t("settings.commitAttribution")}
          </label>
          <p className="text-sm text-muted-foreground">
            {t("settings.commitAttributionDescription")}
          </p>
        </div>
        <Switch
          id="onboarding-commit-attribution"
          checked={settings.commitAttributionEnabled}
          onCheckedChange={(value) =>
            void onSavePatch({ commitAttributionEnabled: value === true })
          }
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <label htmlFor="onboarding-pr-attribution" className={DESKTOP_SETTINGS_LABEL_CLASS}>
            {t("settings.prAttribution")}
          </label>
          <p className="text-sm text-muted-foreground">
            {t("settings.prAttributionDescription")}
          </p>
        </div>
        <Switch
          id="onboarding-pr-attribution"
          checked={settings.prAttributionEnabled}
          onCheckedChange={(value) =>
            void onSavePatch({ prAttributionEnabled: value === true })
          }
        />
      </div>
    </div>
  );
}
