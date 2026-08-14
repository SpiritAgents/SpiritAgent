import type { Metadata } from "next";

import { DownloadPage } from "@/components/download-page";
import { buildPageMetadata } from "@/lib/page-metadata";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata(locale, "download");
}

export default function LocaleDownloadPage() {
  return <DownloadPage />;
}
