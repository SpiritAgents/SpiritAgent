import { useTranslation } from "react-i18next";

import { themeSelectOptions } from "@/components/settings/constants";
import type { SettingsFormState } from "@/components/settings/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { isNativeBackdropBlurSupported } from "@/lib/desktop-shell";
import { DESKTOP_SETTINGS_LABEL_CLASS } from "@/lib/desktop-typography";
import { changeLanguage, VALID_LANGUAGES } from "@/lib/i18n";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

type OnboardingAppearanceControlsProps = {
  theme: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
  settings: SettingsFormState;
  onSavePatch: (patch: Partial<SettingsFormState>) => Promise<void>;
};

/**
 * OOBE 外观步骤内容：主题三选预览卡 + 模糊效果开关 + 语言选择。
 * 所有选择即时生效，与设置页共用同一保存链路。
 */
export function OnboardingAppearanceControls({
  theme,
  onThemeChange,
  settings,
  onSavePatch,
}: OnboardingAppearanceControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex w-full max-w-md flex-col gap-7">
      <div role="radiogroup" aria-label={t("settings.theme")} className="flex justify-center gap-4">
        {themeSelectOptions.map((option) => (
          <ThemePreviewCard
            key={option.value}
            value={option.value}
            label={t(option.labelKey)}
            selected={theme === option.value}
            onSelect={() => onThemeChange(option.value)}
          />
        ))}
      </div>

      {isNativeBackdropBlurSupported() ? (
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="onboarding-blur-effect" className={DESKTOP_SETTINGS_LABEL_CLASS}>
            {t("settings.blurEffect")}
          </label>
          <Switch
            id="onboarding-blur-effect"
            checked={settings.windowsMica}
            onCheckedChange={(value) => void onSavePatch({ windowsMica: value === true })}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <label htmlFor="onboarding-locale" className={DESKTOP_SETTINGS_LABEL_CLASS}>
          {t("settings.uiLocale")}
        </label>
        <Select
          value={settings.uiLocale}
          onValueChange={(value) => {
            void changeLanguage(value);
            void onSavePatch({ uiLocale: value });
          }}
        >
          <SelectTrigger id="onboarding-locale" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VALID_LANGUAGES.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {lang === "zh-CN" ? t("settings.langZhCN") : t("settings.langEn")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ThemePreviewCard({
  value,
  label,
  selected,
  onSelect,
}: {
  value: ThemePreference;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="group/theme-card flex cursor-pointer flex-col items-center gap-2 outline-none"
    >
      <div
        className={cn(
          "relative h-[76px] w-28 overflow-hidden rounded-lg border transition-[border-color,box-shadow] duration-150",
          selected
            ? "border-primary/70 ring-2 ring-primary/40"
            : "border-border/60 group-hover/theme-card:border-border group-focus-visible/theme-card:ring-2 group-focus-visible/theme-card:ring-ring/50",
        )}
      >
        {value === "system" ? (
          <>
            {/* 竖直分割：左右各裁半宽完整预览，避免整卡亮色层在圆角边缘透出 */}
            <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-[200%]">
                <MiniAppPreview dark={false} />
              </div>
            </div>
            <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
              <div className="absolute inset-y-0 right-0 w-[200%]">
                <MiniAppPreview dark />
              </div>
            </div>
          </>
        ) : (
          <MiniAppPreview dark={value === "dark"} />
        )}
      </div>
      <span
        className={cn(
          "text-xs transition-colors",
          selected ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}

/**
 * 主界面空会话视图的迷你 mock：侧栏 + 居中问候骨架条 + 底部输入框条。
 * 固定色板（不用 dark: 变体），避免受文档级 .dark 类影响预览效果；
 * 品牌色为纯白纯黑，骨架条统一用黑/白 alpha 叠加，避免中间灰阶带出色相。
 */
function MiniAppPreview({ dark }: { dark: boolean }) {
  const c = dark
    ? {
        bg: "bg-zinc-950",
        sidebar: "border-r border-white/10 bg-zinc-900/80",
        sidebarBar: "bg-white/12",
        bar: "bg-white/18",
        barSoft: "bg-white/14",
        input: "border-white/10 bg-zinc-900/70",
      }
    : {
        bg: "bg-zinc-50",
        sidebar: "border-r border-black/5 bg-white/80",
        sidebarBar: "bg-black/8",
        bar: "bg-black/10",
        barSoft: "bg-black/8",
        input: "border-black/8 bg-white",
      };

  return (
    <div className={cn("flex h-full w-full", c.bg)} aria-hidden>
      <div className={cn("flex h-full w-[27%] flex-col gap-[5px] px-1.5 pt-2", c.sidebar)}>
        <div className={cn("h-1 w-4/5 rounded-full", c.sidebarBar)} />
        <div className={cn("h-1 w-3/5 rounded-full", c.sidebarBar)} />
        <div className={cn("h-1 w-2/3 rounded-full", c.sidebarBar)} />
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-[5px] px-2">
        <div className={cn("h-1.5 w-3/5 rounded-full", c.bar)} />
        <div className={cn("h-1 w-2/5 rounded-full", c.barSoft)} />
        <div className={cn("absolute inset-x-1.5 bottom-1.5 h-4 rounded-[5px] border", c.input)} />
      </div>
    </div>
  );
}
