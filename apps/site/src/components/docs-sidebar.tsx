"use client";

import type { Folder, Item, Separator } from "fumadocs-core/page-tree";
import type { ReactNode } from "react";
import { usePathname } from "fumadocs-core/framework";
import * as Base from "fumadocs-ui/components/sidebar/base";

import { FONT_WEIGHT_NORMAL } from "@/lib/typography";
import { cn } from "@/lib/utils";

const folderTriggerClass = cn(
  `flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-white ${FONT_WEIGHT_NORMAL}`,
  "transition-none hover:bg-white/5 data-[active=true]:text-white",
);

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

export function DocsSidebarFolder({ item, children }: { item: Folder; children: ReactNode }) {
  const pathname = usePathname();
  const indexUrl = item.index?.url;
  const indexActive = Boolean(
    indexUrl && (pathname === indexUrl || pathname.startsWith(`${indexUrl}/`)),
  );
  const childActive = folderContainsPath(item, pathname);

  return (
    <Base.SidebarFolder
      collapsible={item.collapsible}
      active={indexActive || childActive}
      defaultOpen={item.defaultOpen}
    >
      {item.index ? (
        <Base.SidebarFolderLink
          href={item.index.url}
          active={indexActive}
          external={item.index.external}
          className={folderTriggerClass}
        >
          {item.name}
        </Base.SidebarFolderLink>
      ) : (
        <Base.SidebarFolderTrigger className={folderTriggerClass}>
          {item.name}
        </Base.SidebarFolderTrigger>
      )}
      <Base.SidebarFolderContent className="ps-2">{children}</Base.SidebarFolderContent>
    </Base.SidebarFolder>
  );
}

function folderContainsPath(folder: Folder, pathname: string): boolean {
  return folder.children.some((node) => {
    if (node.type === "page") {
      return pathname === node.url || pathname.startsWith(`${node.url}/`);
    }
    if (node.type === "folder") {
      const indexUrl = node.index?.url;
      if (indexUrl && (pathname === indexUrl || pathname.startsWith(`${indexUrl}/`))) {
        return true;
      }
      return folderContainsPath(node, pathname);
    }
    return false;
  });
}

export const docsSidebarComponents = {
  Separator: DocsSidebarSeparator,
  Item: DocsSidebarItem,
  Folder: DocsSidebarFolder,
};
