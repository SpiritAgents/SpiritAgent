import type { Metadata } from "next";

import { HomePage } from "@/components/home-page";
import { buildPageMetadata } from "@/lib/page-metadata";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata(locale, "home");
}

export default function LocaleHomePage() {
  return <HomePage />;
}
