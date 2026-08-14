import { defineI18n } from "fumadocs-core/i18n";

export const docsI18n = defineI18n({
  defaultLanguage: "en-US",
  languages: ["en-US", "zh-CN"],
  parser: "dir",
  hideLocale: "never",
});
