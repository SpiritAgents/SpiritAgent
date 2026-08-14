import { NextResponse, type NextRequest } from "next/server";

import { renderDownloadMarkdown, renderSiteMarkdown } from "@/content/site-document";
import {
  acceptsOnlyMarkdown,
  detectLocaleFromAcceptLanguage,
  localeFromLocalizedPath,
  markdownPageForPath,
  prefersMarkdown,
  resolveMarkdownCompanionPath,
} from "@/lib/accept";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accept = request.headers.get("Accept");

  if (pathname === "/" || pathname === "") {
    const locale = detectLocaleFromAcceptLanguage(request.headers.get("Accept-Language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    const response = NextResponse.redirect(url, 302);
    response.headers.set("Vary", "Accept, Accept-Language");
    return response;
  }

  const markdownPath = resolveMarkdownCompanionPath(pathname);

  if (prefersMarkdown(accept) && markdownPath) {
    const locale = localeFromLocalizedPath(pathname);
    const page = markdownPageForPath(pathname);
    if (locale && page) {
      const body = page === "download" ? renderDownloadMarkdown(locale) : renderSiteMarkdown(locale);
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          Vary: "Accept",
          Link: `<${markdownPath}>; rel="alternate"; type="text/markdown"`,
        },
      });
    }

    if (acceptsOnlyMarkdown(accept)) {
      return new NextResponse("Not Acceptable", {
        status: 406,
        headers: {
          Vary: "Accept",
        },
      });
    }
  }

  const response = NextResponse.next();
  response.headers.set("Vary", "Accept");
  if (markdownPath) {
    response.headers.set("Link", `<${markdownPath}>; rel="alternate"; type="text/markdown"`);
  }
  return response;
}

export const config = {
  matcher: [
    "/",
    "/en-US",
    "/en-US/",
    "/en-US/download",
    "/en-US/download/",
    "/zh-CN",
    "/zh-CN/",
    "/zh-CN/download",
    "/zh-CN/download/",
    "/zh-TW",
    "/zh-TW/",
    "/zh-TW/download",
    "/zh-TW/download/",
    "/ja",
    "/ja/",
    "/ja/download",
    "/ja/download/",
    "/ko",
    "/ko/",
    "/ko/download",
    "/ko/download/",
    "/de",
    "/de/",
    "/de/download",
    "/de/download/",
    "/fr",
    "/fr/",
    "/fr/download",
    "/fr/download/",
    "/es",
    "/es/",
    "/es/download",
    "/es/download/",
    "/pt-BR",
    "/pt-BR/",
    "/pt-BR/download",
    "/pt-BR/download/",
    "/ru",
    "/ru/",
    "/ru/download",
    "/ru/download/",
  ],
};
