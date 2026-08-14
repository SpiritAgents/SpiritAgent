import { loader } from "fumadocs-core/source";
import { defineDocs } from "fumadocs-mdx/macro";

import { docsI18n } from "@/lib/docs-i18n";

const docs = defineDocs({
  dir: "content/docs",
});

export const source = loader({
  baseUrl: "/docs",
  i18n: docsI18n,
  source: docs.toFumadocsSource(),
});

type RelativeLinkPage = {
  path: string;
  locale?: string;
};

/**
 * Fumadocs i18n `parser: "dir"` 会把语言目录从 storage key 里剥掉，
 * 但 `page.path` 仍是 `en-US/index.mdx`。`resolveHref` 用 `dirname(page.path)`
 * 去查 `en-US.en-US/quickstart.mdx`，相对链接全部 miss，href 原样落到
 * `/en-US/quickstart.mdx`。这里把 path 收成 storage key 再交给 createRelativeLink。
 */
export function toRelativeLinkPage<T extends RelativeLinkPage>(page: T): T {
  const locale = page.locale;
  if (!locale) return page;
  const prefix = `${locale}/`;
  if (!page.path.startsWith(prefix)) return page;
  return { ...page, path: page.path.slice(prefix.length) };
}
