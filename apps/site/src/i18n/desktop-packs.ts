import desktopDe from "../../../desktop/src/locales/de.json";
import desktopEn from "../../../desktop/src/locales/en.json";
import desktopEs from "../../../desktop/src/locales/es.json";
import desktopFr from "../../../desktop/src/locales/fr.json";
import desktopJa from "../../../desktop/src/locales/ja.json";
import desktopKo from "../../../desktop/src/locales/ko.json";
import desktopPtBR from "../../../desktop/src/locales/pt-BR.json";
import desktopRu from "../../../desktop/src/locales/ru.json";
import desktopZhCN from "../../../desktop/src/locales/zh-CN.json";
import desktopZhTW from "../../../desktop/src/locales/zh-TW.json";

const DESKTOP_PACKS = {
  "en-US": desktopEn,
  "zh-CN": desktopZhCN,
  "zh-TW": desktopZhTW,
  ja: desktopJa,
  ko: desktopKo,
  de: desktopDe,
  fr: desktopFr,
  es: desktopEs,
  "pt-BR": desktopPtBR,
  ru: desktopRu,
} as const;

export function getDesktopPack(locale: string): Record<string, unknown> {
  if (locale in DESKTOP_PACKS) {
    return DESKTOP_PACKS[locale as keyof typeof DESKTOP_PACKS] as Record<string, unknown>;
  }
  return desktopEn as Record<string, unknown>;
}
