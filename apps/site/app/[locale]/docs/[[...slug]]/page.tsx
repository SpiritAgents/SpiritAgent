import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocsPage } from "@/components/docs-page";
import { SUPPORTED_LOCALES } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/page-metadata";

type PageProps = {
  params: Promise<{ locale: string; slug?: string[] }>;
};

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale, slug: [] }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (slug && slug.length > 0) {
    notFound();
  }
  return buildPageMetadata(locale, "docs");
}

export default async function DocsPageRoute({ params }: PageProps) {
  const { slug } = await params;
  if (slug && slug.length > 0) {
    notFound();
  }

  return <DocsPage />;
}
