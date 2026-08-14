import type { InferPageType } from "fumadocs-core/source";

import { source } from "@/lib/source";

export type DocsPage = InferPageType<typeof source>;

export async function getLLMText(page: DocsPage): Promise<string> {
  const processed = await page.data.getText("processed");
  const lines = [`# ${page.data.title}`, `URL: ${page.url}`];
  if (page.data.description?.trim()) {
    lines.push("", page.data.description.trim());
  }
  lines.push("", processed);
  return lines.join("\n");
}
