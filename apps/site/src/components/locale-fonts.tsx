import type { AppLocale } from "@/i18n/config";
import { ZhCnFonts } from "@/components/zh-cn-fonts";

/** CJK routes: zh-CN keeps bundled Noto Sans SC; others use system CJK stacks in CSS. */
export function LocaleFonts({ locale }: { locale: AppLocale }) {
  if (locale === "zh-CN") {
    return <ZhCnFonts />;
  }
  return null;
}
