export const SUPPORTED_LOCALES = [
  "en-US",
  "zh-CN",
  "zh-TW",
  "ja",
  "ko",
  "de",
  "fr",
  "es",
  "pt-BR",
  "ru",
] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en-US";

const OG_LOCALE: Record<AppLocale, string> = {
  "en-US": "en_US",
  "zh-CN": "zh_CN",
  "zh-TW": "zh_TW",
  ja: "ja_JP",
  ko: "ko_KR",
  de: "de_DE",
  fr: "fr_FR",
  es: "es_ES",
  "pt-BR": "pt_BR",
  ru: "ru_RU",
};

const LOCALE_LABELS: Record<AppLocale, string> = {
  "en-US": "English (en-US)",
  "zh-CN": "中文 (zh-CN)",
  "zh-TW": "繁體中文 (zh-TW)",
  ja: "日本語 (ja)",
  ko: "한국어 (ko)",
  de: "Deutsch (de)",
  fr: "Français (fr)",
  es: "Español (es)",
  "pt-BR": "Português (pt-BR)",
  ru: "Русский (ru)",
};

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

export function getOgLocale(locale: AppLocale): string {
  return OG_LOCALE[locale];
}

export function getLocaleLabel(locale: AppLocale): string {
  return LOCALE_LABELS[locale];
}

function matchLanguageTag(tag: string): AppLocale | null {
  const normalized = tag.toLowerCase();
  if (
    normalized.startsWith("zh-hant") ||
    normalized.startsWith("zh-tw") ||
    normalized.startsWith("zh-hk")
  ) {
    return "zh-TW";
  }
  if (normalized.startsWith("zh")) {
    return "zh-CN";
  }
  if (normalized.startsWith("pt")) {
    return "pt-BR";
  }
  if (normalized.startsWith("ja")) return "ja";
  if (normalized.startsWith("ko")) return "ko";
  if (normalized.startsWith("de")) return "de";
  if (normalized.startsWith("fr")) return "fr";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("ru")) return "ru";
  if (normalized.startsWith("en")) return "en-US";
  return null;
}

export function detectPreferredLocale(): AppLocale {
  if (typeof navigator === "undefined") {
    return DEFAULT_LOCALE;
  }

  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const matched = matchLanguageTag(candidate);
    if (matched) return matched;
  }
  return DEFAULT_LOCALE;
}

export function matchLocaleFromLanguageTag(tag: string): AppLocale {
  return matchLanguageTag(tag) ?? DEFAULT_LOCALE;
}

export function getLocalePath(locale: AppLocale, suffix = ""): string {
  if (!suffix) {
    return `/${locale}`;
  }

  if (suffix.startsWith("/") || suffix.startsWith("?") || suffix.startsWith("#")) {
    return `/${locale}${suffix}`;
  }

  return `/${locale}/${suffix}`;
}
