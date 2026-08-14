import { NextResponse, type NextRequest } from "next/server";

import { renderSiteMarkdown } from "@/content/site-document";
import { isSupportedLocale } from "@/i18n/config";
import {
  acceptsOnlyMarkdown,
  detectLocaleFromAcceptLanguage,
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
    const locale = pathname.replace(/\/+$/, "").slice(1);
    if (isSupportedLocale(locale)) {
      return new NextResponse(renderSiteMarkdown(locale), {
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
  matcher: ["/", "/en-US", "/en-US/", "/zh-CN", "/zh-CN/"],
};
