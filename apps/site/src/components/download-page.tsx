"use client";

import { DownloadHero } from "@/components/download-hero";
import { DownloadTrioScaffold } from "@/components/download-trio-scaffold";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

export function DownloadPage() {
  return (
    <>
      <SiteNav />
      <main className="relative z-10">
        <DownloadHero />
        <DownloadTrioScaffold />
      </main>
      <SiteFooter />
    </>
  );
}
