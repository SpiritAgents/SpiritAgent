import type { Messages } from "@/i18n/messages";
import { SPIRIT_RELEASES_URL } from "@/lib/github-links";

export type SiteNavMenuKey = "features" | "resources";

export const SITE_NAV_MENU_KEYS: SiteNavMenuKey[] = ["features", "resources"];

export type SiteNavMenuLink = {
  href: string;
  label: string;
  external?: boolean;
};

export type SiteNavMenu = {
  key: SiteNavMenuKey;
  trigger: string;
  explore: string;
  links: SiteNavMenuLink[];
};

export function getSiteNavMenus(
  nav: Messages["hero"]["nav"],
  localizedPath: (suffix?: string) => string,
): SiteNavMenu[] {
  return [
    {
      key: "features",
      trigger: nav.features,
      explore: nav.exploreFeatures,
      links: [
        { href: localizedPath("#agent"), label: nav.agent },
        { href: localizedPath("#features"), label: nav.byok },
      ],
    },
    {
      key: "resources",
      trigger: nav.resources,
      explore: nav.exploreResources,
      links: [
        { href: localizedPath("/docs"), label: nav.docs },
        { href: SPIRIT_RELEASES_URL, label: nav.changelog, external: true },
      ],
    },
  ];
}
