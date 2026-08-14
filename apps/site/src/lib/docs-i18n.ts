import { defineI18n } from "fumadocs-core/i18n";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/i18n/config";

export const docsI18n = defineI18n({
  defaultLanguage: DEFAULT_LOCALE,
  languages: [...SUPPORTED_LOCALES],
  parser: "dir",
  hideLocale: "never",
});
