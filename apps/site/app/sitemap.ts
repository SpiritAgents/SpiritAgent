import type { MetadataRoute } from "next";

import { getSiteOrigin } from "@/content/site-document";
import { getLocalePath, SUPPORTED_LOCALES } from "@/i18n/config";
import { source } from "@/lib/source";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();

  return [
    {
      url: `${origin}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...SUPPORTED_LOCALES.flatMap((locale) => [
      {
        url: `${origin}${getLocalePath(locale)}`,
        changeFrequency: "weekly" as const,
        priority: 0.9,
      },
      {
        url: `${origin}${getLocalePath(locale, "download")}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
    ]),
    ...source.getPages().map((page) => ({
      url: `${origin}${page.url}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
