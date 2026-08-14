import { llms } from "fumadocs-core/source";

import { DEFAULT_LOCALE } from "@/i18n/config";
import { source } from "@/lib/source";

export const revalidate = false;

export function GET() {
  return new Response(llms(source).index(DEFAULT_LOCALE), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
