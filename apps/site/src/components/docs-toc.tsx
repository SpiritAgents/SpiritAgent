"use client";

import { TOCProvider, TOCScrollArea, useTOCItems } from "fumadocs-ui/components/toc";
import type { TOCProps, TOCProviderProps } from "fumadocs-ui/layouts/docs/page/slots/toc";
import { useEffect, useState } from "react";

import { useI18n } from "@/i18n/provider";
import { FONT_WEIGHT_NORMAL } from "@/lib/typography";
import { cn } from "@/lib/utils";

export function DocsTOCProvider(props: TOCProviderProps) {
  return <TOCProvider {...props} />;
}

function tocItemId(url: string) {
  return url.startsWith("#") ? url.slice(1) : url;
}

function readingOffset() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;height:var(--site-nav-height)";
  document.body.append(probe);
  const nav = probe.getBoundingClientRect().height;
  probe.remove();
  return (nav > 0 ? nav : 60) + 32;
}

function useDocsActiveHeadingId() {
  const items = useTOCItems();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const ids = items.map((item) => tocItemId(item.url));

    const update = () => {
      const offset = readingOffset();
      let current = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const slack = Math.max(el.offsetHeight, 16);
        if (el.getBoundingClientRect().top <= offset + slack) current = id;
      }
      setActiveId(current);
    };

    update();
    window.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("resize", update);
    window.addEventListener("hashchange", update);
    return () => {
      window.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
      window.removeEventListener("hashchange", update);
    };
  }, [items]);

  return activeId;
}

function DocsTOCList() {
  const items = useTOCItems();
  const activeId = useDocsActiveHeadingId();

  return (
    <nav className="flex flex-col">
      {items.map((item) => {
        const id = tocItemId(item.url);
        return (
          <a
            key={item.url}
            href={item.url}
            data-active={activeId === id}
            className={cn(
              `py-1.5 text-sm text-muted-foreground hover:text-white data-[active=true]:text-white ${FONT_WEIGHT_NORMAL}`,
              item.depth === 3 && "ps-3",
              item.depth >= 4 && "ps-5",
            )}
          >
            {item.title}
          </a>
        );
      })}
    </nav>
  );
}

export function DocsTOC({ container }: TOCProps) {
  const { messages } = useI18n();

  return (
    <div
      id="nd-toc"
      {...container}
      className={cn(
        "sticky top-(--fd-docs-row-1) flex h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] w-(--fd-toc-width) flex-col pt-12 pb-2 [grid-area:toc] max-xl:hidden xl:layout:[--fd-toc-width:268px]",
        container?.className,
      )}
    >
      <h3 className={`text-sm text-site-muted ${FONT_WEIGHT_NORMAL}`}>
        {messages.docs.onThisPage}
      </h3>
      <TOCScrollArea>
        <DocsTOCList />
      </TOCScrollArea>
    </div>
  );
}

/** Narrow viewports hide the sidebar TOC; do not fall back to an in-page popover. */
export function DocsTOCPopover() {
  return null;
}

