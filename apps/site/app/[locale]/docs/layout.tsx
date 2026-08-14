import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { DocsMobileSidebarHeader } from "@/components/docs-mobile-sidebar-header";
import { DocsNavTitle } from "@/components/docs-nav-title";
import { docsSidebarComponents } from "@/components/docs-sidebar";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/i18n/config";
import { messagesByLocale } from "@/i18n/messages";
import { source } from "@/lib/source";

export default async function DocsSectionLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const appLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const docsCopy = messagesByLocale[appLocale].docs;
  const tree = isSupportedLocale(locale) ? source.getPageTree(locale) : source.getPageTree();

  return (
    <div data-docs-layout="">
      <RootProvider
        theme={{ enabled: false }}
        i18n={{
          locale: appLocale,
          translations: {
            "Search(search dialog)": docsCopy.searchPlaceholder,
            "No results found(search dialog)": docsCopy.searchNoResults,
            "Search(search trigger)": docsCopy.search,
          },
        }}
      >
        <SiteNav />
        <DocsLayout
          tree={tree}
          nav={{ enabled: true }}
          searchToggle={{ enabled: false }}
          themeSwitch={{ enabled: false }}
          tabs={false}
          sidebar={{
            collapsible: false,
            components: docsSidebarComponents,
          }}
          slots={{
            header: DocsMobileSidebarHeader,
            navTitle: DocsNavTitle,
          }}
        >
          {children}
        </DocsLayout>
      </RootProvider>
      <SiteFooter />
    </div>
  );
}
