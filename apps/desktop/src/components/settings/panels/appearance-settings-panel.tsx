import { useTranslation } from "react-i18next";

import { FontSelect } from "@/components/font-select";
import { SettingsRow } from "@/components/settings/settings-row";
import type { SettingsViewProps } from "@/components/settings/types";
import { ThemePreviewPicker } from "@/components/theme-preview-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  changeLanguage,
  isLanguagePreference,
  LANGUAGE_PREFERENCE_OPTIONS,
  LOCALE_LABEL_KEYS,
  SYSTEM_LANGUAGE,
} from "@/lib/i18n";
import { isNativeTranslucencySupported } from "@/lib/desktop-shell";
import type { ThemePreference } from "@/lib/theme";

const appearanceSelectTriggerClassName = "w-full sm:w-fit sm:max-w-full";

export function AppearanceSettingsPanel({
  theme,
  onThemeChange,
  font,
  onFontChange,
  clickablePointerCursor,
  onClickablePointerCursorChange,
  settings,
  onSavePatch,
}: Pick<
  SettingsViewProps,
  | "font"
  | "onFontChange"
  | "clickablePointerCursor"
  | "onClickablePointerCursorChange"
  | "settings"
  | "onSavePatch"
> & {
  theme: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="divide-y divide-border/35 rounded-lg border border-border/40 bg-background/80 px-4 sm:px-5">
      <SettingsRow label={t("settings.theme")} description={t("settings.themeDescription")}>
        <ThemePreviewPicker
          value={theme}
          onValueChange={onThemeChange}
          size="compact"
          ariaLabel={t("settings.theme")}
          className="shrink-0 justify-end"
        />
      </SettingsRow>

      <SettingsRow
        label={t("settings.font")}
        description={t("settings.fontDescription")}
        htmlFor="settings-font-select"
      >
        <FontSelect
          id="settings-font-select"
          value={font}
          onValueChange={onFontChange}
          triggerClassName={appearanceSelectTriggerClassName}
        />
      </SettingsRow>

      <SettingsRow
        label={t("settings.uiLocale")}
        description={t("settings.uiLocaleDescription")}
        htmlFor="settings-locale"
      >
        <Select
          value={isLanguagePreference(settings.uiLocale) ? settings.uiLocale : SYSTEM_LANGUAGE}
          onValueChange={(value) => {
            void changeLanguage(value);
            void onSavePatch({ uiLocale: value });
          }}
        >
          <SelectTrigger id="settings-locale" className={appearanceSelectTriggerClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_PREFERENCE_OPTIONS.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {t(LOCALE_LABEL_KEYS[lang])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>

      <SettingsRow
        label={t("settings.translucency")}
        description={
          isNativeTranslucencySupported()
            ? t("settings.translucencyDescription")
            : t("settings.translucencyUnsupported")
        }
        htmlFor="settings-blur-effect"
      >
        {isNativeTranslucencySupported() ? (
          <div className="flex justify-end">
            <Switch
              id="settings-blur-effect"
              checked={settings.translucency}
              onCheckedChange={(value) => void onSavePatch({ translucency: value === true })}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground sm:text-right">—</p>
        )}
      </SettingsRow>

      <SettingsRow
        label={t("settings.clickablePointerCursor")}
        description={t("settings.clickablePointerCursorDescription")}
        htmlFor="settings-clickable-pointer-cursor"
      >
        <div className="flex justify-end">
          <Switch
            id="settings-clickable-pointer-cursor"
            checked={clickablePointerCursor}
            onCheckedChange={(value) => onClickablePointerCursorChange(value === true)}
          />
        </div>
      </SettingsRow>
    </div>
  );
}
