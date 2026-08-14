export const SUPPORTED_LOCALES = ["en-US", "zh-CN"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en-US";

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return value === "en-US" || value === "zh-CN";
}

export function detectPreferredLocale(): AppLocale {
  if (typeof navigator === "undefined") {
    return DEFAULT_LOCALE;
  }

  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  return candidates.some((value) => value.toLowerCase().startsWith("zh"))
    ? "zh-CN"
    : DEFAULT_LOCALE;
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
