import type { JsonObject, JsonValue } from '../../ports.js';
import { isJsonObject } from '../../tool-agent.js';
import type { OpenAiTransportConfig } from '../../openai/openai-compat.js';
import { fetchFormulaTools } from './formula-client.js';
import { shouldUseMoonshotFormulaWebSearch } from './formula-eligibility.js';
import {
  listMoonshotFormulaRegistrations,
  type MoonshotFormulaRegistration,
} from './formula-registry.js';
import type { FormulaToolDefinition } from './formula-types.js';

type FetchFn = typeof fetch;

type FormulaToolsCacheEntry = {
  expiresAt: number;
  tools: FormulaToolDefinition[];
};

const FORMULA_TOOLS_CACHE_TTL_MS = 5 * 60 * 1000;
const formulaToolsCache = new Map<string, FormulaToolsCacheEntry>();

function buildFormulaToolsCacheKey(config: OpenAiTransportConfig): string {
  return `${config.baseUrl ?? ''}\0${config.apiKey}`;
}

async function loadMoonshotFormulaToolsForConfig(
  config: OpenAiTransportConfig,
  fetchImpl: FetchFn,
): Promise<FormulaToolDefinition[]> {
  const cacheKey = buildFormulaToolsCacheKey(config);
  const cached = formulaToolsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tools;
  }

  const registrations = listMoonshotFormulaRegistrations();
  const mergedTools: FormulaToolDefinition[] = [];
  const seenFunctionNames = new Set<string>();

  for (const registration of registrations) {
    const tools = await fetchFormulaTools(
      {
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
      },
      registration.formulaUri,
      fetchImpl,
    );
    for (const tool of tools) {
      const functionName = tool.function.name;
      if (seenFunctionNames.has(functionName)) {
        continue;
      }
      seenFunctionNames.add(functionName);
      mergedTools.push(tool);
    }
  }

  formulaToolsCache.set(cacheKey, {
    expiresAt: Date.now() + FORMULA_TOOLS_CACHE_TTL_MS,
    tools: mergedTools,
  });
  return mergedTools;
}

export function buildMoonshotFormulaTraceToolEntries(): JsonObject[] {
  return listMoonshotFormulaRegistrations().map((registration: MoonshotFormulaRegistration) => ({
    type: 'moonshot_formula',
    formula_uri: registration.formulaUri,
    function_name: registration.functionName,
  }));
}

export function mergeMoonshotFormulaToolsIntoChatCompletionsTools(
  existingTools: unknown[],
  formulaTools: readonly FormulaToolDefinition[],
): unknown[] {
  const merged = [...existingTools];
  const seenFunctionNames = new Set(
    existingTools.flatMap((tool) => {
      if (!isJsonObject(tool as JsonValue)) {
        return [];
      }
      const record = tool as JsonObject;
      if (record.type !== 'function' || !isJsonObject(record.function as JsonValue)) {
        return [];
      }
      const name = (record.function as JsonObject).name;
      return typeof name === 'string' ? [name] : [];
    }),
  );

  for (const tool of formulaTools) {
    if (seenFunctionNames.has(tool.function.name)) {
      continue;
    }
    seenFunctionNames.add(tool.function.name);
    merged.push(tool);
  }

  return merged;
}

export function createMoonshotFormulaChatCompletionsAwareFetch(
  config: OpenAiTransportConfig,
  baseFetch: FetchFn,
): FetchFn {
  if (!shouldUseMoonshotFormulaWebSearch(config)) {
    return baseFetch;
  }

  return async (input, init) => {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : '';
    if (!requestUrl.includes('/chat/completions')) {
      return baseFetch(input, init);
    }

    const patchedInit = await patchMoonshotChatCompletionsRequestInit(config, init, baseFetch);
    return baseFetch(input, patchedInit);
  };
}

async function patchMoonshotChatCompletionsRequestInit(
  config: OpenAiTransportConfig,
  init: RequestInit | undefined,
  fetchImpl: FetchFn,
): Promise<RequestInit | undefined> {
  if (!init?.body || typeof init.body !== 'string') {
    return init;
  }

  try {
    const body = JSON.parse(init.body) as JsonObject;
    if (!isJsonObject(body as JsonValue)) {
      return init;
    }

    const formulaTools = await loadMoonshotFormulaToolsForConfig(config, fetchImpl);
    if (formulaTools.length === 0) {
      return init;
    }

    const existingTools = Array.isArray(body.tools) ? body.tools : [];
    return {
      ...init,
      body: JSON.stringify({
        ...body,
        tools: mergeMoonshotFormulaToolsIntoChatCompletionsTools(existingTools, formulaTools),
      }),
    };
  } catch {
    return init;
  }
}

/** @internal Test helper */
export function clearMoonshotFormulaToolsCacheForTests(): void {
  formulaToolsCache.clear();
}
