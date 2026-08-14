import type { Metadata } from "next";

import {
  DEFAULT_LOCALE,
  getLocalePath,
  isSupportedLocale,
  getOgLocale,
  SUPPORTED_LOCALES,
  type AppLocale,
} from "@/i18n/config";
import { messagesByLocale, type Messages } from "@/i18n/messages";
import { getSiteOrigin } from "@/content/site-document";

export type SitePage = "home" | "download" | "docs";

function pageCopy(
  messages: Messages,
  page: SitePage,
): { title: string; description: string; pathSuffix: string; markdown: boolean } {
  if (page === "download") {
    return {
      title: messages.download.metaTitle,
      description: messages.download.metaDescription,
      pathSuffix: "download",
      markdown: true,
    };
  }
  if (page === "docs") {
    return {
      title: messages.docs.metaTitle,
      description: messages.docs.metaDescription,
      pathSuffix: "docs",
      markdown: false,
    };
  }
  return {
    title: messages.meta.title,
    description: messages.meta.description,
    pathSuffix: "",
    markdown: true,
  };
}

export function buildPageMetadata(localeParam: string, page: SitePage): Metadata {
  const locale: AppLocale = isSupportedLocale(localeParam) ? localeParam : DEFAULT_LOCALE;
  const messages = messagesByLocale[locale];
  const siteOrigin = getSiteOrigin();
  const { title, description, pathSuffix, markdown } = pageCopy(messages, page);
  const canonicalPath = getLocalePath(locale, pathSuffix);
  const canonicalUrl = `${siteOrigin}${canonicalPath}`;
  const markdownUrl = `${siteOrigin}${canonicalPath}/index.md`;

  const languages: Record<string, string> = {};
  if (page === "home") {
    languages["x-default"] = `${siteOrigin}/`;
  }
  for (const supportedLocale of SUPPORTED_LOCALES) {
    languages[supportedLocale] = `${siteOrigin}${getLocalePath(supportedLocale, pathSuffix)}`;
  }

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages,
      ...(markdown
        ? {
            types: {
              "text/markdown": markdownUrl,
            },
          }
        : {}),
    },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonicalUrl,
      locale: getOgLocale(locale),
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}
