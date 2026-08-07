import type { OpenAiLlmVendor } from "../openai/openai-compat.js";

export const ARK_LLM_VENDORS = [
  "volcengine",
  "byteplus",
] as const satisfies readonly OpenAiLlmVendor[];

const ARK_LLM_VENDOR_SET: ReadonlySet<OpenAiLlmVendor> = new Set(ARK_LLM_VENDORS);

export function isArkLlmVendor(vendor: OpenAiLlmVendor | undefined): boolean {
  return vendor !== undefined && ARK_LLM_VENDOR_SET.has(vendor);
}

export function isArkApiBase(baseUrl: string | undefined): boolean {
  if (!baseUrl) {
    return false;
  }

  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname.includes("volces.com") || hostname.includes("bytepluses.com");
  } catch {
    return false;
  }
}

export function defaultArkApiBase(vendor: OpenAiLlmVendor | undefined): string {
  if (vendor === "byteplus") {
    return "https://ark.ap-southeast.bytepluses.com/api/v3";
  }

  return "https://ark.cn-beijing.volces.com/api/v3";
}
