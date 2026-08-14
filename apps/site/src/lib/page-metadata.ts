import type { Metadata } from "next";

import {
  DEFAULT_LOCALE,
  getLocalePath,
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type AppLocale,
} from "@/i18n/config";
import { messagesByLocale } from "@/i18n/messages";
import { getSiteOrigin } from "@/content/site-document";

export function buildPageMetadata(localeParam: string, page: "home" | "download"): Metadata {
  const locale: AppLocale = isSupportedLocale(localeParam) ? localeParam : DEFAULT_LOCALE;
  const messages = messagesByLocale[locale];
  const siteOrigin = getSiteOrigin();
  const title = page === "download" ? messages.download.metaTitle : messages.meta.title;
  const description =
    page === "download" ? messages.download.metaDescription : messages.meta.description;
  const canonicalPath =
    page === "download" ? getLocalePath(locale, "download") : getLocalePath(locale);
  const canonicalUrl = `${siteOrigin}${canonicalPath}`;
  const markdownUrl = `${siteOrigin}${canonicalPath}/index.md`;

  const languages: Record<string, string> = {};
  if (page === "home") {
    languages["x-default"] = `${siteOrigin}/`;
  }
  for (const supportedLocale of SUPPORTED_LOCALES) {
    languages[supportedLocale] =
      page === "download"
        ? `${siteOrigin}${getLocalePath(supportedLocale, "download")}`
        : `${siteOrigin}${getLocalePath(supportedLocale)}`;
  }

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages,
      types: {
        "text/markdown": markdownUrl,
      },
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonicalUrl,
      locale: locale === "zh-CN" ? "zh_CN" : "en_US",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}
