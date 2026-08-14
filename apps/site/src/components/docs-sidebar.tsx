"use client";

import type { Item, Separator } from "fumadocs-core/page-tree";
import { usePathname } from "fumadocs-core/framework";
import * as Base from "fumadocs-ui/components/sidebar/base";

import { FONT_WEIGHT_NORMAL } from "@/lib/typography";
import { cn } from "@/lib/utils";

export function DocsSidebarSeparator({ item }: { item: Separator }) {
  return (
    <Base.SidebarSeparator
      className={`mt-6 mb-1.5 px-2 text-sm text-site-muted first:mt-0 ${FONT_WEIGHT_NORMAL}`}
    >
      {item.name}
    </Base.SidebarSeparator>
  );
}

export function DocsSidebarItem({ item }: { item: Item }) {
  const pathname = usePathname();
  const active = pathname === item.url || pathname.startsWith(`${item.url}/`);

  return (
    <Base.SidebarItem
      href={item.url}
      external={item.external}
      active={active}
      className={cn(
        `flex items-center rounded-sm px-2 py-1.5 text-sm text-white ${FONT_WEIGHT_NORMAL}`,
        "transition-none hover:bg-white/5 data-[active=true]:text-white",
      )}
    >
      {item.name}
    </Base.SidebarItem>
  );
}

export const docsSidebarComponents = {
  Separator: DocsSidebarSeparator,
  Item: DocsSidebarItem,
};
