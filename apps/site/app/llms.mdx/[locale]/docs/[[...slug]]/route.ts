import { notFound } from "next/navigation";

import { isSupportedLocale } from "@/i18n/config";
import { getLLMText } from "@/lib/get-llm-text";
import { source } from "@/lib/source";

export const revalidate = false;

type RouteContext = {
  params: Promise<{ locale: string; slug?: string[] }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { locale, slug } = await context.params;
  if (!isSupportedLocale(locale)) notFound();

  const page = source.getPage(slug, locale);
  if (!page) notFound();

  return new Response(await getLLMText(page), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}

export function generateStaticParams() {
  return source.generateParams("slug", "locale");
}
